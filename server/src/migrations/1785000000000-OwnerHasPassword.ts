import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * owners.hasPassword - whether the account's owner set their own password.
 *
 * A social-only account (Sign in with Apple / Google) is created with a random
 * password it can never type, so account-password verification always fails for it.
 * The parent gate offered "Forgot PIN?" to any account with an email - which every
 * social account has - and its only recovery path is that failing password check, so a
 * social parent who forgot their PIN was permanently locked out of leaving Kids Mode,
 * deleting the account, or removing a child profile.
 *
 * Defaults true so existing email/password accounts keep recovery. Backfills known
 * social accounts to false: an Apple account is identifiable by its stored
 * appleRefreshToken. Google-only accounts cannot be distinguished retroactively, but
 * there are effectively none pre-launch, and any such account corrects itself the next
 * time it sets a password.
 */
export class OwnerHasPassword1785000000000 implements MigrationInterface {
  name = 'OwnerHasPassword1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return; // SQLite dev uses synchronize
    await queryRunner.query(`ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "hasPassword" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`UPDATE "owners" SET "hasPassword" = false WHERE "appleRefreshToken" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    await queryRunner.query(`ALTER TABLE "owners" DROP COLUMN IF EXISTS "hasPassword"`);
  }
}
