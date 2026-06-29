import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes the columns the daily retention purge filters on. Without them, the purge's
 * `DELETE ... WHERE startedAt < cutoff` / `WHERE createdAt < cutoff` are full table
 * scans that can exceed the serverless function timeout on the first or a backlogged
 * run. (analytics_events already has a composite (name, createdAt), but that can't
 * serve a bare createdAt range.) Additive + idempotent.
 */
export class AddRetentionIndexes1782800000000 implements MigrationInterface {
  name = 'AddRetentionIndexes1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_session_log_started_at" ON "session_logs" ("startedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_event_created_at" ON "analytics_events" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_event_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_session_log_started_at"`);
  }
}
