import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Global exception filter - logs unhandled 5xx errors (with stack) and method/path so
 * server failures and failed store-webhook verifications are VISIBLE in the host logs.
 * This is the wiring point for an error aggregator (e.g. Sentry Node) once a DSN is
 * provisioned. Client (4xx) errors stay quiet. Preserves the normal Nest response.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  /**
   * A CLIENT error dressed as a server error must not become a 500. Two real cases a
   * red-team probe hit, both of which were logging + Sentry-firing as 500s and let any
   * caller (one of them unauthenticated) generate error-log/quota noise on demand:
   *
   *  - body-parser rejects an oversized or malformed body with an Error carrying a
   *    numeric status (413 entity.too.large, 400 entity.parse.failed). It is not an
   *    HttpException, so it fell through to 500. Honour that status.
   *  - Postgres raises 22P02 (invalid_text_representation) when a non-UUID string is
   *    cast to a uuid column - i.e. a malformed id in the URL. That is a bad request,
   *    not a server fault, so it is a 400, not a 500.
   */
  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    if (!exception || typeof exception !== 'object') return HttpStatus.INTERNAL_SERVER_ERROR;
    const e = exception as { status?: unknown; statusCode?: unknown; code?: unknown };
    const s = typeof e.status === 'number' ? e.status : typeof e.statusCode === 'number' ? e.statusCode : 0;
    if (s >= 400 && s < 600) return s;
    if (e.code === '22P02') return HttpStatus.BAD_REQUEST;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<{ method?: string; originalUrl?: string; url?: string }>();
    const status = this.resolveStatus(exception);

    if (status >= 500) {
      this.logger.error(
        `${req?.method ?? ''} ${req?.originalUrl ?? req?.url ?? ''} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Sentry.init is DSN-gated in main.ts; without a DSN this is a no-op.
      Sentry.captureException(exception, {
        extra: { method: req?.method, path: req?.originalUrl ?? req?.url, status },
      });
    }

    // Never echo an internal error's own message to the client (it can leak stack or
    // driver detail). A mapped 4xx gets a generic, honest label; a real 5xx stays
    // opaque; a genuine HttpException keeps its intended response.
    const genericFor = (s: number): string =>
      s === HttpStatus.PAYLOAD_TOO_LARGE
        ? 'Payload too large'
        : s === HttpStatus.BAD_REQUEST
          ? 'Bad request'
          : s < 500
            ? 'Request could not be processed'
            : 'Internal server error';
    const body =
      exception instanceof HttpException ? exception.getResponse() : { statusCode: status, message: genericFor(status) };
    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
