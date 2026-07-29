import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * owners.email was a case-SENSITIVE unique varchar, and only the social-login path
 * lowercased, so "Mason@Glowco.com" and "mason@glowco.com" were different accounts:
 * a correct password could be rejected, password reset silently did nothing, and
 * duplicate accounts were possible on one address.
 *
 * UsersService now normalizes on read and write. This backfills existing rows so
 * they remain findable, and adds a functional unique index so two casings of the
 * same address can never diverge again at the database level.
 *
 * Safe on a collision: if two rows already differ only by case, the unique index
 * creation fails loudly rather than silently merging identities - that needs a
 * human decision about which account is real.
 */
export class LowercaseOwnerEmails1784600000001 implements MigrationInterface {
  name = 'LowercaseOwnerEmails1784600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return; // SQLite dev
    await queryRunner.query(`UPDATE "owners" SET "email" = lower("email") WHERE "email" <> lower("email")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_owner_email_lower" ON "owners" (lower("email"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_owner_email_lower"`);
    // the lowercasing itself is not reversible - original casing is not retained
  }
}
