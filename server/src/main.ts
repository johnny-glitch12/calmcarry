import './load-env'; // MUST be first - populates process.env before ./config reads it
import * as Sentry from '@sentry/node';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { config, integrations, isProd, nodeEnvIsInvalid, prodSecretGaps } from './config';

// Error aggregation - a strict no-op until SENTRY_DSN is provisioned. Init before
// anything else so even bootstrap failures after this line are captured.
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? 'development' });
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Posture must be UNAMBIGUOUS. A typo'd NODE_ENV (e.g. "prod"/"staging") would
  // silently run with every prod guard OFF (dev JWT secret, dev fallbacks), so a
  // set-but-unrecognized value is a hard boot failure. An UNSET value is allowed
  // for local dev but warned loudly - a real deployment must export NODE_ENV.
  if (nodeEnvIsInvalid()) {
    logger.error(`Refusing to start: unrecognized NODE_ENV="${process.env.NODE_ENV}". Use development | test | production.`);
    process.exit(1);
  }
  if (!process.env.NODE_ENV) {
    logger.warn('NODE_ENV is unset - running in INSECURE development posture. Set NODE_ENV=production for any deployment.');
  }

  // Fail fast in production if critical secrets are missing/default (shared gate so
  // the serverless entrypoint enforces the exact same posture).
  const missing = prodSecretGaps();
  if (missing.length) {
    logger.error(`Refusing to start in production - set: ${missing.join(', ')}`);
    process.exit(1);
  }

  // rawBody enables HMAC verification of the Shopify order webhook
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Security headers (clickjacking, MIME-sniffing, etc.)
  app.use(helmet());

  // gzip responses - throughput / payload size (catalogue + lists compress well)
  app.use(compression());

  // Cap request body size - defends against memory-exhaustion DoS. 256kb (not 64kb):
  // StoreKit 2 JWS receipts + store webhook payloads can exceed 64kb; still tiny enough to reject abuse.
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { limit: '256kb', extended: true });

  // Dev reflects the Expo web origin only; production uses an explicit allowlist.
  app.enableCors(
    isProd
      ? { origin: config.corsOrigins, credentials: false }
      : { origin: ['http://localhost:8081', 'http://localhost:3000', ...config.corsOrigins], credentials: true },
  );

  // Validate, strip unknown props, and REJECT bodies with unexpected fields
  // (defense against mass-assignment of fields like tier/status/role).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Surface unhandled 5xx errors + failed webhook verifications in the logs.
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  await app.listen(config.port, '0.0.0.0');

  // Restrict the local SQLite DB to the owner - it can hold user data + hashes.
  try {
    const { chmodSync } = await import('fs');
    chmodSync(config.dbPath, 0o600);
  } catch {
    /* file may not exist yet / non-POSIX fs - best effort */
  }

  logger.log(`CalmCarry API listening on http://localhost:${config.port}`);
  const live = Object.entries(integrations)
    .filter(([, on]) => on)
    .map(([k]) => k);
  logger.log(
    live.length
      ? `Live integrations: ${live.join(', ')}`
      : 'All integrations in DEV-FALLBACK (no keys set - see .env.example)',
  );
}

bootstrap();
