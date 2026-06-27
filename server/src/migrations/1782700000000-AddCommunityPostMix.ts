import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds community_posts.mix — an optional, anonymous shared sound-machine mix
 * (name + per-sound levels), stored as JSON text. Additive + nullable; ordinary
 * text wins leave it null.
 */
export class AddCommunityPostMix1782700000000 implements MigrationInterface {
  name = 'AddCommunityPostMix1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "community_posts" ADD "mix" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "community_posts" DROP COLUMN "mix"`);
  }
}
