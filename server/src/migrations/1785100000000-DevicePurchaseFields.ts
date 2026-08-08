import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * devices.purchaseDate / devices.retailer - the two fields the registration form
 * collects and the server was throwing away.
 *
 * The app sent {serial, purchaseDate, retailer}; the controller passed only the
 * serial, so a user who typed their purchase date and retailer to activate a warranty
 * had that data silently discarded. Both nullable (the form marks them optional).
 */
export class DevicePurchaseFields1785100000000 implements MigrationInterface {
  name = 'DevicePurchaseFields1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return; // SQLite dev uses synchronize
    await queryRunner.query(`ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "purchaseDate" text`);
    await queryRunner.query(`ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "retailer" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    await queryRunner.query(`ALTER TABLE "devices" DROP COLUMN IF EXISTS "retailer"`);
    await queryRunner.query(`ALTER TABLE "devices" DROP COLUMN IF EXISTS "purchaseDate"`);
  }
}
