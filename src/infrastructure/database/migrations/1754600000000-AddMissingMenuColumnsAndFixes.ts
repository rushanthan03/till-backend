import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingMenuColumnsAndFixes1754600000000 implements MigrationInterface {
  name = 'AddMissingMenuColumnsAndFixes1754600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. menus table: Add isFeatured, featuredOrder, badges columns ──────
    await queryRunner.query(`
      ALTER TABLE "menus"
      ADD COLUMN IF NOT EXISTS "isFeatured" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "featuredOrder" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "badges" jsonb;
    `);

    // ── 2. menus table: Add note column (optional field on Menu entity) ────
    await queryRunner.query(`
      ALTER TABLE "menus"
      ADD COLUMN IF NOT EXISTS "note" character varying;
    `);

    // ── 3. orders table: Add all missing columns from Order entity ─────────
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "orderSource" character varying,
      ADD COLUMN IF NOT EXISTS "roomId" uuid,
      ADD COLUMN IF NOT EXISTS "isMerged" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "parentOrderId" uuid,
      ADD COLUMN IF NOT EXISTS "vehicleModel" character varying,
      ADD COLUMN IF NOT EXISTS "vehicleNumber" character varying,
      ADD COLUMN IF NOT EXISTS "createdBy" character varying,
      ADD COLUMN IF NOT EXISTS "createdByType" character varying NOT NULL DEFAULT 'staff',
      ADD COLUMN IF NOT EXISTS "pendingConfirmationAt" TIMESTAMP;
    `);

    // ── 4. order_items table: Add missing columns from OrderItem entity ────
    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD COLUMN IF NOT EXISTS "originalPreparationTime" integer,
      ADD COLUMN IF NOT EXISTS "tableNo" character varying,
      ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "servedAt" TIMESTAMP;
    `);

    // ── 5. restaurants table: Add missing columns from Restaurant entity ───
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "requireWaiterConfirmation" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "paymentTiming" character varying DEFAULT 'pay_at_last',
      ADD COLUMN IF NOT EXISTS "primaryColor" character varying,
      ADD COLUMN IF NOT EXISTS "secondaryColor" character varying,
      ADD COLUMN IF NOT EXISTS "tertiaryColor" character varying,
      ADD COLUMN IF NOT EXISTS "serviceChargePercentage" numeric(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "applyServiceCharge" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "serviceChargeType" character varying NOT NULL DEFAULT 'percentage',
      ADD COLUMN IF NOT EXISTS "fixedServiceCharge" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "openHours" jsonb,
      ADD COLUMN IF NOT EXISTS "openTime" character varying,
      ADD COLUMN IF NOT EXISTS "closeTime" character varying,
      ADD COLUMN IF NOT EXISTS "walletTotalEarned" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "walletTotalWithdrawn" numeric(12,2) NOT NULL DEFAULT 0;
    `);

    // ── 6. tables table: Add ALL missing columns from Table entity ────────
    await queryRunner.query(`
      ALTER TABLE "tables"
      ADD COLUMN IF NOT EXISTS "name" character varying,
      ADD COLUMN IF NOT EXISTS "qrCode" character varying,
      ADD COLUMN IF NOT EXISTS "qrCodeImage" character varying,
      ADD COLUMN IF NOT EXISTS "location" jsonb,
      ADD COLUMN IF NOT EXISTS "settings" jsonb,
      ADD COLUMN IF NOT EXISTS "qrCodeId" uuid;
    `);

    // Backfill name from tableNumber for existing rows (name is required by entity)
    await queryRunner.query(`
      UPDATE "tables"
      SET "name" = "tableNumber"
      WHERE "name" IS NULL;
    `);

    // ── 7. qr_codes table: Add missing columns ────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "qr_codes"
      ADD COLUMN IF NOT EXISTS "parkingSpot" character varying,
      ADD COLUMN IF NOT EXISTS "status" character varying NOT NULL DEFAULT 'active';
    `);

    // ── 8. payments table: Add missing columns ────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "amountTendered" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "changeReturned" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "transactionId" character varying;
    `);

    // ── 9. Create rooms table if missing ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "roomNumber" character varying NOT NULL,
        "floor" character varying,
        "type" character varying NOT NULL DEFAULT 'standard',
        "capacity" integer NOT NULL DEFAULT 2,
        "status" character varying NOT NULL DEFAULT 'available',
        "pricePerNight" numeric(10,2),
        "amenities" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rooms" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_rooms_restaurantId" ON "rooms" ("restaurantId");`);

    console.log('[Migration 1754600000000] All missing menu, order, and auxiliary columns added.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN IF EXISTS "isFeatured";`);
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN IF EXISTS "featuredOrder";`);
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN IF EXISTS "badges";`);
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN IF EXISTS "note";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rooms";`);
  }
}
