import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Account security + UGC compliance batch:
 *  - owners.emailVerified (soft email-verification state)
 *  - auth_codes (6-digit reset/verify codes; bcrypt-hashed, expiring, attempt-limited)
 *  - refresh_tokens (rotating, SHA-256-hashed; enables real logout/revocation)
 *  - community_posts.reportsCount (App Store 1.2: member reports re-hold posts)
 * Additive only. Timestamp columns follow the dialect (SQLite dev / Postgres prod).
 */
export class AccountSecurity1783600000000 implements MigrationInterface {
  name = 'AccountSecurity1783600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const ts = process.env.DATABASE_URL ? 'TIMESTAMP' : 'datetime';
    const now = process.env.DATABASE_URL ? 'now()' : "datetime('now')";
    // boolean default MUST be `false`, not `(0)`: Postgres rejects integer 0 as a
    // boolean default (SQLite silently coerces it, which is why dev never caught it
    // and a fresh prod Postgres would crash-loop on boot). Matches Init.ts.
    await queryRunner.query(`ALTER TABLE "owners" ADD "emailVerified" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "community_posts" ADD "reportsCount" integer NOT NULL DEFAULT (0)`);
    await queryRunner.query(
      `CREATE TABLE "auth_codes" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"ownerId" text NOT NULL, ` +
        `"purpose" text NOT NULL, ` +
        `"codeHash" text NOT NULL, ` +
        `"expiresAt" ${ts} NOT NULL, ` +
        `"attempts" integer NOT NULL DEFAULT (0), ` +
        `"createdAt" ${ts} NOT NULL DEFAULT (${now}))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_auth_codes_owner" ON "auth_codes" ("ownerId")`);
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"ownerId" text NOT NULL, ` +
        `"tokenHash" text NOT NULL, ` +
        `"expiresAt" ${ts} NOT NULL, ` +
        `"revokedAt" ${ts}, ` +
        `"createdAt" ${ts} NOT NULL DEFAULT (${now}))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_owner" ON "refresh_tokens" ("ownerId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_refresh_tokens_hash" ON "refresh_tokens" ("tokenHash")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "auth_codes"`);
    await queryRunner.query(`ALTER TABLE "community_posts" DROP COLUMN "reportsCount"`);
    await queryRunner.query(`ALTER TABLE "owners" DROP COLUMN "emailVerified"`);
  }
}
