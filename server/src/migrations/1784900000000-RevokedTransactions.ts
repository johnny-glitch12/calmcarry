import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * revoked_transactions - a permanent denylist of store transactions that must never
 * grant premium again.
 *
 * Closes a receipt-replay worth a free subscription indefinitely. A StoreKit 2 JWS is
 * immutable and stays cryptographically valid forever, so a buyer could capture their
 * own receipt (the app posts it in plaintext), take a refund from Apple, and re-post
 * the identical body onto a fresh account. Checking the transaction's own
 * revocationDate does not help: the captured JWS was signed BEFORE the refund and
 * never carries one.
 *
 * The revocation therefore has to be remembered on our side, and it has to outlive the
 * account - account deletion used to drop the entitlement row holding
 * status='revoked' and the unique transactionRef, which reset the attack.
 *
 * Holds no personal data: a store transaction id detached from any account is not
 * personal information, so the table is compatible with an erasure request.
 */
export class RevokedTransactions1784900000000 implements MigrationInterface {
  name = 'RevokedTransactions1784900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return; // SQLite dev uses synchronize
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "revoked_transactions" (
        "transactionRef" text PRIMARY KEY,
        "reason" text NOT NULL,
        "recordedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    // Backfill from entitlements already marked revoked, so existing refunds are
    // covered the moment this ships rather than only from the next webhook onward.
    await queryRunner.query(`
      INSERT INTO "revoked_transactions" ("transactionRef", "reason")
      SELECT DISTINCT "transactionRef", 'backfill_revoked'
      FROM "entitlements"
      WHERE "status" = 'revoked' AND "transactionRef" IS NOT NULL
      ON CONFLICT ("transactionRef") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    await queryRunner.query(`DROP TABLE IF EXISTS "revoked_transactions"`);
  }
}
