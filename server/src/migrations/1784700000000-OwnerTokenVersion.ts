import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * owners.tokenVersion - the session-invalidation counter.
 *
 * Changing or resetting a password deleted every refresh token but nothing
 * invalidated already-issued ACCESS tokens, and JwtAuthGuard verified only the
 * signature and expiry. So a pre-change token kept working for the rest of its
 * 7-day life and could still export the account's data or delete the account -
 * exactly backwards for the "someone else has my password" case.
 *
 * Every access token now carries `tv`; the guard rejects it once this counter moves.
 * Defaults to 0 so existing tokens remain valid until the owner next changes their
 * password (no forced sign-out on deploy).
 */
export class OwnerTokenVersion1784700000000 implements MigrationInterface {
  name = 'OwnerTokenVersion1784700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return; // SQLite dev uses synchronize
    await queryRunner.query(`ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "tokenVersion" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    await queryRunner.query(`ALTER TABLE "owners" DROP COLUMN IF EXISTS "tokenVersion"`);
  }
}
