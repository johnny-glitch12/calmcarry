import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * auth_codes.id and refresh_tokens.id were created (AccountSecurity) as plain
 * `varchar PRIMARY KEY NOT NULL` with NO default. TypeORM generates uuid ids
 * client-side on SQLite but leans on a DB default on Postgres, so dev worked
 * while every prod register/login 500'd on `null value in column "id"`.
 * Postgres-only fix: give both columns a uuid default (text-cast to match the
 * varchar column type). SQLite needs nothing - the driver keeps generating ids.
 */
export class VarcharIdDefaults1784500000000 implements MigrationInterface {
  name = 'VarcharIdDefaults1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return; // SQLite dev: client-side ids, nothing to fix
    await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "id" SET DEFAULT (uuid_generate_v4()::text)`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ALTER COLUMN "id" SET DEFAULT (uuid_generate_v4()::text)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ALTER COLUMN "id" DROP DEFAULT`);
  }
}
