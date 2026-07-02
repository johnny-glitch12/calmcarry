import './load-env'; // populate process.env before config is read
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { config, isProd, nodeEnvIsInvalid, prodSecretGaps } from './config';

/**
 * Serverless entrypoint (Vercel function). Bootstraps the Nest app once per warm
 * container and reuses it, then delegates each request to the Express instance.
 * Mirrors main.ts: the SAME prod secret-gate, body-size cap, exception filter,
 * helmet, compression, CORS, and validation — but never calls listen() (the
 * platform owns the socket).
 */
let cached: express.Express | null = null;

async function bootstrap(): Promise<express.Express> {
  if (cached) return cached;

  // Identical posture to main.ts: never silently boot prod on the dev JWT secret /
  // dev fallbacks. Throwing here makes the function return 500 on every request,
  // which is the correct fail-closed behaviour for a misconfigured deploy.
  if (nodeEnvIsInvalid()) {
    throw new Error(`Unrecognized NODE_ENV="${process.env.NODE_ENV}". Use development | test | production.`);
  }
  const missing = prodSecretGaps();
  if (missing.length) {
    throw new Error(`Refusing to serve in production — set: ${missing.join(', ')}`);
  }
  // This function is EPHEMERAL, so RetentionService's in-process daily timer never
  // fires reliably — the COPPA/data-retention purge runs ONLY via Vercel Cron hitting
  // /retention/purge, which authenticates with CRON_SECRET. Absent that secret the cron
  // 401s forever and the purge silently never runs (a 4xx the exception filter doesn't
  // even log), so a serverless prod deploy must refuse to serve without it. (Long-lived
  // `npm start` deploys don't gate this — their in-process timer runs the purge directly.)
  if (isProd && !config.cronSecret) {
    throw new Error(
      'Refusing to serve in production — set CRON_SECRET (the daily retention/COPPA purge cron authenticates with it; absent, the purge silently never runs).',
    );
  }

  const server = express();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(server), { rawBody: true });
  app.use(helmet());
  app.use(compression());
  // Cap request body size — defends against memory-exhaustion DoS (parity with main.ts).
  // 256kb: StoreKit 2 JWS receipts + store webhook payloads can exceed 64kb.
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { limit: '256kb', extended: true });
  app.enableCors(
    isProd
      ? { origin: config.corsOrigins, credentials: false }
      : { origin: ['http://localhost:8081', 'http://localhost:3000', ...config.corsOrigins], credentials: true },
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  // Surface unhandled 5xx + failed webhook verifications (parity with main.ts)
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  await app.init();
  cached = server;
  return server;
}

export default async function handler(req: express.Request, res: express.Response): Promise<void> {
  const server = await bootstrap();
  server(req, res);
}
