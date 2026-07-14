import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds owners.appleRefreshToken - stored solely to revoke a user's Sign in with
 * Apple tokens on account deletion (Apple App Store requirement). Additive + nullable.
 */
export class AddAppleRefreshToken1782600000000 implements MigrationInterface {
  name = 'AddAppleRefreshToken1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "owners" ADD "appleRefreshToken" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "owners" DROP COLUMN "appleRefreshToken"`);
  }
}
