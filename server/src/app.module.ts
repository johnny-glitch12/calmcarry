import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { FlyThrottlerGuard } from './common/fly-throttler.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config, isProd } from './config';
import { ENTITIES } from './data-source';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CommunityModule } from './community/community.module';
import { HealthController } from './common/health.controller';
import { ContentModule } from './content/content.module';
import { CaregiversModule } from './caregivers/caregivers.module';
import { DevicesModule } from './devices/devices.module';
import { EventsModule } from './events/events.module';
import { HouseholdModule } from './household/household.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LogsModule } from './logs/logs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OwnershipModule } from './ownership/ownership.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RetentionModule } from './retention/retention.module';
import { SeedModule } from './seed/seed.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // Postgres in production (set DATABASE_URL); file-based SQLite for local dev.
      ...(config.databaseUrl
        ? {
            type: 'postgres' as const,
            url: config.databaseUrl,
            // VERIFIED TLS - this DB holds COPPA-scoped data (kid first names).
            // Neon/hosted PG present valid certs; never skip verification.
            ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
          }
        : { type: 'better-sqlite3' as const, database: config.dbPath }),
      entities: ENTITIES,
      // Committed migrations live in src/migrations (compiled to dist/migrations).
      migrations: [__dirname + '/migrations/*.js'],
      // Local SQLite dev auto-creates the schema. ANY Postgres connection (dev or
      // prod) NEVER synchronizes (that can silently ALTER/DROP a populated DB) and
      // instead applies committed migrations on boot.
      synchronize: !config.databaseUrl && !isProd,
      migrationsRun: !!config.databaseUrl,
    }),
    // Global DoS backstop: 300 requests / 10s / IP - generous enough for a normal
    // app-open burst + shared (NAT) networks, still caps sustained abuse. Auth
    // routes are tightened to 10/min; /health is skipped (monitoring pings it).
    // NOTE: storage is in-memory (per instance) - on serverless/multi-instance these
    // counters don't hold across machines. Set REDIS_URL + a shared ThrottlerStorage
    // (e.g. @nest-lab/throttler-storage-redis) before scaling horizontally.
    ThrottlerModule.forRoot([{ ttl: 10_000, limit: 300 }]),
    IntegrationsModule,
    AuthModule,
    UsersModule,
    ContentModule,
    DevicesModule,
    LogsModule,
    SeedModule,
    BillingModule,
    ProfilesModule,
    CommunityModule,
    NotificationsModule,
    OwnershipModule,
    EventsModule,
    HouseholdModule,
    CaregiversModule,
    RetentionModule,
  ],
  controllers: [HealthController],
  // FlyThrottlerGuard: rate-limit buckets keyed on Fly-Client-IP behind Fly's
  // proxy (default socket-address tracking would bucket ALL clients together)
  providers: [{ provide: APP_GUARD, useClass: FlyThrottlerGuard }],
})
export class AppModule {}
