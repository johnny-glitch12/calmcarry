import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * owners.prefs - cross-device preference sync (allow-listed keys only; the
 * service layer rejects anything else, and mood/feeling is never accepted).
 * Additive only; simple-json maps to text in both SQLite and Postgres.
 */
export class OwnerPrefs1783700000000 implements MigrationInterface {
  name = 'OwnerPrefs1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "owners" ADD "prefs" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "owners" DROP COLUMN "prefs"`);
  }
}
