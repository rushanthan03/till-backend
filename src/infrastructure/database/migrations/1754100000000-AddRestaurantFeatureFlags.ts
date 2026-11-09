import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantFeatureFlags1754100000000 implements MigrationInterface {
  name = 'AddRestaurantFeatureFlags1754100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "isRoomsEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "isLoyaltyEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "isAppearanceEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "isWhatsAppEnabled" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP COLUMN IF EXISTS "isWhatsAppEnabled",
        DROP COLUMN IF EXISTS "isAppearanceEnabled",
        DROP COLUMN IF EXISTS "isLoyaltyEnabled",
        DROP COLUMN IF EXISTS "isRoomsEnabled"
    `);
  }
}
