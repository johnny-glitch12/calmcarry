import './load-env'; // populate process.env before config is read
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config, isProd } from './config';

/**
 * Serverless entrypoint (Vercel function). Bootstraps the Nest app once per warm
 * container and reuses it, then delegates each request to the Express instance.
 * Mirrors the middleware in main.ts (helmet, compression, CORS, validation) but
 * never calls listen() — the platform owns the socket.
 */
let cached: express.Express | null = null;

async function bootstrap(): Promise<express.Express> {
  if (cached) return cached;
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { rawBody: true });
  app.use(helmet());
  app.use(compression());
  app.enableCors(
    isProd
      ? { origin: config.corsOrigins, credentials: false }
      : { origin: ['http://localhost:8081', 'http://localhost:3000', ...config.corsOrigins], credentials: true },
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();
  cached = server;
  return server;
}

export default async function handler(req: express.Request, res: express.Response): Promise<void> {
  const server = await bootstrap();
  server(req, res);
}
