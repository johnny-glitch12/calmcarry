import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * entitlements.lastEventAt / lastEventUid - replay + ordering protection for store
 * subscription webhooks.
 *
 * Apple retries any App Store Server Notification it does not get a 2xx for, and
 * Google Pub/Sub is explicitly at-least-once. Neither guarantees order. The handler
 * applied whatever arrived last, so a retried EXPIRED that lost a race with a later
 * DID_RENEW would revoke a subscriber who is paying right now - and churn analytics
 * counted one cancellation again on every redelivery.
 *
 * lastEventAt is the store's own clock for the last applied event (Apple signedDate,
 * Play eventTimeMillis), which orders two events. lastEventUid is the store's id for
 * it (Apple notificationUUID, Pub/Sub messageId), which identifies an exact retry.
 *
 * Both are nullable with no default: existing rows have never seen a stamped event,
 * so the first notification after deploy is applied normally rather than being
 * rejected as stale.
 */
export class EntitlementEventOrdering1784800000000 implements MigrationInterface {
  name = 'EntitlementEventOrdering1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return; // SQLite dev uses synchronize
    await queryRunner.query(`ALTER TABLE "entitlements" ADD COLUMN IF NOT EXISTS "lastEventAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "entitlements" ADD COLUMN IF NOT EXISTS "lastEventUid" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    await queryRunner.query(`ALTER TABLE "entitlements" DROP COLUMN IF EXISTS "lastEventUid"`);
    await queryRunner.query(`ALTER TABLE "entitlements" DROP COLUMN IF EXISTS "lastEventAt"`);
  }
}
