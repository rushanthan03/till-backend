import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantSettingsColumns1737000000000 implements MigrationInterface {
  name = 'AddRestaurantSettingsColumns1737000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Safely add system control & printer configuration columns to restaurants table
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "showPOSOrderSidebar" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "bypassKitchen" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "kitchenBulkMode" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "orderAlertsVisible" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "orderAlertsMuted" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "autoPrintEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "printerPaperWidth" varchar NOT NULL DEFAULT '80mm',
      ADD COLUMN IF NOT EXISTS "connectedPrinterName" varchar;
    `);

    // Safely add merged order columns to orders table
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "isMerged" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "originalOrderIds" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "showPOSOrderSidebar",
      DROP COLUMN IF EXISTS "bypassKitchen",
      DROP COLUMN IF EXISTS "kitchenBulkMode",
      DROP COLUMN IF EXISTS "orderAlertsVisible",
      DROP COLUMN IF EXISTS "orderAlertsMuted",
      DROP COLUMN IF EXISTS "autoPrintEnabled",
      DROP COLUMN IF EXISTS "printerPaperWidth",
      DROP COLUMN IF EXISTS "connectedPrinterName";
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "isMerged",
      DROP COLUMN IF EXISTS "originalOrderIds";
    `);
  }
}
