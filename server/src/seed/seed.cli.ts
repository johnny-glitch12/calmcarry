import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

/**
 * Manual seed entrypoint: `npm run seed`.
 * The app also auto-seeds on boot if the DB is empty (SeedService.onApplicationBootstrap),
 * so this is only needed if you want to seed without starting the HTTP server.
 */
async function bootstrap() {
  const logger = new Logger('SeedCLI');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  const seedService = app.get(SeedService);
  await seedService.run();
  await app.close();
  logger.log('Seed CLI finished.');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
