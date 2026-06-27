import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

/**
 * Global exception filter — logs unhandled 5xx errors (with stack) and method/path so
 * server failures and failed store-webhook verifications are VISIBLE in the host logs.
 * This is the wiring point for an error aggregator (e.g. Sentry Node) once a DSN is
 * provisioned. Client (4xx) errors stay quiet. Preserves the normal Nest response.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<{ method?: string; originalUrl?: string; url?: string }>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error(
        `${req?.method ?? ''} ${req?.originalUrl ?? req?.url ?? ''} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // TODO: forward to Sentry/error aggregator here once SENTRY_DSN is provisioned.
    }

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };
    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
