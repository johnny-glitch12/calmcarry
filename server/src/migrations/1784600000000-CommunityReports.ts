import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-reporter report records, so a member can report a given post only once.
 *
 * Without this, /community/report carried no reporter identity and no dedupe, so a
 * single account could report every visible post past the rejection threshold and
 * permanently empty the wins wall. The unique (postId, ownerId) index is what makes
 * the moderation thresholds mean "N distinct members objected".
 */
export class CommunityReports1784600000000 implements MigrationInterface {
  name = 'CommunityReports1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return; // SQLite dev uses synchronize
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" uuid NOT NULL,
        "ownerId" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_reports" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_community_report" ON "community_reports" ("postId", "ownerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_community_report"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_reports"`);
  }
}
