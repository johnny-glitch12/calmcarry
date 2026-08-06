import './load-env'; // populate process.env before config reads it (CLI runs too)
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { config } from './config';
import {
  AnalyticsEvent,
  AuthCode,
  CaregiverInvite,
  CaregiverLink,
  CommunityPost,
  CommunityReport,
  ContentItem,
  Device,
  Entitlement,
  Owner,
  Profile,
  Program,
  PushToken,
  RefreshToken,
  SavedMix,
  SessionLog,
  WarrantyClaim,
} from './entities';

// Single source of truth for the entity set - shared by the Nest app (app.module)
// and the TypeORM CLI (this file), so generated migrations always match runtime.
export const ENTITIES = [
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
  CommunityReport,
  PushToken,
  AnalyticsEvent,
  CaregiverLink,
  CaregiverInvite,
  AuthCode,
  RefreshToken,
];

// Used ONLY by the TypeORM CLI (migration:generate / run / revert). The runtime
// connection is configured in app.module. synchronize is OFF here - the CLI never
// mutates schema implicitly.
export const dataSourceOptions: DataSourceOptions = {
  ...(config.databaseUrl
    ? {
        type: 'postgres' as const,
        url: config.databaseUrl,
        // verified TLS - mirror of app.module.ts (COPPA-scoped data)
        ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
      }
    : { type: 'better-sqlite3' as const, database: config.dbPath }),
  entities: ENTITIES,
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
