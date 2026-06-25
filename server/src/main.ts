import './load-env'; // MUST be first — populates process.env before ./config reads it
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config, integrations, isProd } from './config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Posture must be UNAMBIGUOUS. A typo'd NODE_ENV (e.g. "prod"/"staging") would
  // silently run with every prod guard OFF (dev JWT secret, dev fallbacks), so a
  // set-but-unrecognized value is a hard boot failure. An UNSET value is allowed
  // for local dev but warned loudly — a real deployment must export NODE_ENV.
  const rawEnv = process.env.NODE_ENV;
  if (rawEnv && !['development', 'test', 'production'].includes(rawEnv)) {
    logger.error(`Refusing to start: unrecognized NODE_ENV="${rawEnv}". Use development | test | production.`);
    process.exit(1);
  }
  if (!rawEnv) {
    logger.warn('NODE_ENV is unset — running in INSECURE development posture. Set NODE_ENV=production for any deployment.');
  }

  // Fail fast in production if critical secrets are missing/default. We guard the
  // secrets the app actually uses (NOT DATABASE_URL — the app runs on SQLite).
  if (isProd) {
    const missing: string[] = [];
    if (!process.env.JWT_SECRET || config.jwtSecret.includes('change-me')) missing.push('JWT_SECRET');
    if (config.cmsAdminKey === 'dev-cms-key') missing.push('CMS_ADMIN_KEY');
    // Prod must run on a real (Postgres) DB, not the local SQLite file.
    if (!config.databaseUrl) missing.push('DATABASE_URL');
    // Without CDN signing, "locked" audio would be served as unsigned public URLs.
    if (!config.cdn.baseUrl || !config.cdn.signingKey) missing.push('CDN_BASE_URL + CDN_SIGNING_KEY');
    if (!config.corsOrigins.length) missing.push('CORS_ORIGINS');
    // Sign-in & billing fail closed (503) without these; refuse a prod deploy that
    // would silently ship with social login / receipt validation disabled.
    if (!config.apple.signInClientId && !config.google.signInClientId) missing.push('APPLE_SIGNIN_CLIENT_ID or GOOGLE_SIGNIN_CLIENT_ID');
    if (!integrations.appleIap && !integrations.googleIap) missing.push('APPLE_IAP_SHARED_SECRET or GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    if (missing.length) {
      logger.error(`Refusing to start in production — set: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  // rawBody enables HMAC verification of the Shopify order webhook
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Security headers (clickjacking, MIME-sniffing, etc.)
  app.use(helmet());

  // gzip responses — throughput / payload size (catalogue + lists compress well)
  app.use(compression());

  // Cap request body size — defends against memory-exhaustion DoS
  app.useBodyParser('json', { limit: '64kb' });
  app.useBodyParser('urlencoded', { limit: '64kb', extended: true });

  // Dev reflects the Expo web origin only; production uses an explicit allowlist.
  app.enableCors(
    isProd
      ? { origin: config.corsOrigins, credentials: false }
      : { origin: ['http://localhost:8081', 'http://localhost:3000'], credentials: true },
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

  await app.listen(config.port, '0.0.0.0');

  // Restrict the local SQLite DB to the owner — it can hold user data + hashes.
  try {
    const { chmodSync } = await import('fs');
    chmodSync(config.dbPath, 0o600);
  } catch {
    /* file may not exist yet / non-POSIX fs — best effort */
  }

  logger.log(`CalmCarry API listening on http://localhost:${config.port}`);
  const live = Object.entries(integrations)
    .filter(([, on]) => on)
    .map(([k]) => k);
  logger.log(
    live.length
      ? `Live integrations: ${live.join(', ')}`
      : 'All integrations in DEV-FALLBACK (no keys set — see .env.example)',
  );
}

bootstrap();
