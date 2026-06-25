import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config, isProd } from './config';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CommunityModule } from './community/community.module';
import { HealthController } from './common/health.controller';
import { ContentModule } from './content/content.module';
import { CaregiversModule } from './caregivers/caregivers.module';
import { DevicesModule } from './devices/devices.module';
import { EventsModule } from './events/events.module';
import { HouseholdModule } from './household/household.module';
import {
  AnalyticsEvent,
  CaregiverInvite,
  CaregiverLink,
  CommunityPost,
  ContentItem,
  Device,
  Entitlement,
  Owner,
  Profile,
  Program,
  PushToken,
  SavedMix,
  SessionLog,
  WarrantyClaim,
} from './entities';
import { IntegrationsModule } from './integrations/integrations.module';
import { LogsModule } from './logs/logs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OwnershipModule } from './ownership/ownership.module';
import { ProfilesModule } from './profiles/profiles.module';
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
            ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
          }
        : { type: 'better-sqlite3' as const, database: config.dbPath }),
      entities: [
        Owner,
        Entitlement,
        Device,
        WarrantyClaim,
        ContentItem,
        Program,
        SessionLog,
        Profile,
        SavedMix,
        CommunityPost,
        PushToken,
        AnalyticsEvent,
        CaregiverLink,
        CaregiverInvite,
      ],
      // auto-create schema in dev; in prod it's OFF (use migrations) unless DB_SYNC=true
      // is set for a one-time bootstrap of a fresh database.
      synchronize: !isProd || config.dbSync,
    }),
    // Global DoS backstop: 300 requests / 10s / IP — generous enough for a normal
    // app-open burst + shared (NAT) networks, still caps sustained abuse. Auth
    // routes are tightened to 10/min; /health is skipped (monitoring pings it).
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
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
