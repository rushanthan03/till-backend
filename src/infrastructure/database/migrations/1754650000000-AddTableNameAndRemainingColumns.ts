import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class AddTableNameAndRemainingColumns1754650000000 implements MigrationInterface {
  name = 'AddTableNameAndRemainingColumns1754650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. tables: Add name, qrCode, qrCodeImage, location, settings ──────
    await queryRunner.query(`
      ALTER TABLE "tables"
      ADD COLUMN IF NOT EXISTS "name" character varying,
      ADD COLUMN IF NOT EXISTS "qrCode" character varying,
      ADD COLUMN IF NOT EXISTS "qrCodeImage" character varying,
      ADD COLUMN IF NOT EXISTS "location" jsonb,
      ADD COLUMN IF NOT EXISTS "settings" jsonb,
      ADD COLUMN IF NOT EXISTS "qrCodeId" uuid;
    `);

    // Backfill name from tableNumber for existing rows
    await queryRunner.query(`
      UPDATE "tables"
      SET "name" = "tableNumber"
      WHERE "name" IS NULL;
    `);

    // ── 2. tenants: Add all missing columns from Tenant entity ───────────
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "subdomain" character varying,
      ADD COLUMN IF NOT EXISTS "contactEmail" character varying,
      ADD COLUMN IF NOT EXISTS "contactPhoneNumber" character varying,
      ADD COLUMN IF NOT EXISTS "logo" character varying,
      ADD COLUMN IF NOT EXISTS "description" character varying,
      ADD COLUMN IF NOT EXISTS "settings" jsonb,
      ADD COLUMN IF NOT EXISTS "address" jsonb,
      ADD COLUMN IF NOT EXISTS "billingInfo" jsonb,
      ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP;
    `);

    // Backfill contactEmail and contactPhoneNumber from legacy columns if they existed
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'email') THEN
          UPDATE "tenants" SET "contactEmail" = "email" WHERE "contactEmail" IS NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'phoneNumber') THEN
          UPDATE "tenants" SET "contactPhoneNumber" = "phoneNumber" WHERE "contactPhoneNumber" IS NULL;
        END IF;
      END $$;
    `);

    // ── 3. users: Add all missing columns from User entity ─────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "avatar" character varying,
      ADD COLUMN IF NOT EXISTS "permissions" jsonb,
      ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "refreshToken" character varying,
      ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "passwordResetToken" character varying,
      ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "lastLoginIp" character varying,
      ADD COLUMN IF NOT EXISTS "profilePicture" character varying;
    `);

    // ── 4. restaurants: Add all missing columns from Restaurant entity ─────
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "logo" character varying,
      ADD COLUMN IF NOT EXISTS "logoKey" character varying,
      ADD COLUMN IF NOT EXISTS "banner" character varying,
      ADD COLUMN IF NOT EXISTS "bannerKey" character varying,
      ADD COLUMN IF NOT EXISTS "address" jsonb,
      ADD COLUMN IF NOT EXISTS "contactEmail" character varying,
      ADD COLUMN IF NOT EXISTS "contactPhoneNumber" character varying,
      ADD COLUMN IF NOT EXISTS "openHours" jsonb,
      ADD COLUMN IF NOT EXISTS "openTime" character varying,
      ADD COLUMN IF NOT EXISTS "closeTime" character varying,
      ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "isDeliveryEnabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "isPickupEnabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "isDineInEnabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "isRoomServiceEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isParkingServiceEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isRoomsEnabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "isLoyaltyEnabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "isAppearanceEnabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "isWhatsAppEnabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" character varying,
      ADD COLUMN IF NOT EXISTS "whatsappBusinessAccountId" character varying,
      ADD COLUMN IF NOT EXISTS "whatsappAccessToken" character varying,
      ADD COLUMN IF NOT EXISTS "whatsappApiToken" character varying,
      ADD COLUMN IF NOT EXISTS "defaultKdsMode" character varying DEFAULT 'uber_rush',
      ADD COLUMN IF NOT EXISTS "kdsTimerMode" character varying DEFAULT 'continuous',
      ADD COLUMN IF NOT EXISTS "kdsUrgencyThreshold" numeric(3,2) DEFAULT 0.80,
      ADD COLUMN IF NOT EXISTS "kdsAlertMode" character varying DEFAULT 'action_only',
      ADD COLUMN IF NOT EXISTS "requireWaiterConfirmation" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "paymentTiming" character varying DEFAULT 'pay_at_last',
      ADD COLUMN IF NOT EXISTS "defaultPrinterWidth" character varying DEFAULT '80mm',
      ADD COLUMN IF NOT EXISTS "walletBalance" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "walletTotalEarned" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "walletTotalWithdrawn" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "primaryColor" character varying,
      ADD COLUMN IF NOT EXISTS "secondaryColor" character varying,
      ADD COLUMN IF NOT EXISTS "tertiaryColor" character varying,
      ADD COLUMN IF NOT EXISTS "serviceChargePercentage" numeric(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "applyServiceCharge" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "serviceChargeType" character varying NOT NULL DEFAULT 'percentage',
      ADD COLUMN IF NOT EXISTS "fixedServiceCharge" numeric(10,2);
    `);

    // ── 5. order_activity_logs: Ensure correct schema and nullable orderId ─
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_activity_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid,
        "restaurantId" uuid,
        "tenantId" uuid,
        "entityId" character varying,
        "action" character varying NOT NULL,
        "status" character varying,
        "performedById" uuid,
        "performedByName" character varying,
        "performedByRole" character varying,
        "notes" text,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_activity_logs" PRIMARY KEY ("id")
      );
    `);

    // If order_activity_logs already exists, ensure all columns and nullable orderId
    await queryRunner.query(`
      ALTER TABLE "order_activity_logs"
      ALTER COLUMN "orderId" DROP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "order_activity_logs"
      ADD COLUMN IF NOT EXISTS "restaurantId" uuid,
      ADD COLUMN IF NOT EXISTS "tenantId" uuid,
      ADD COLUMN IF NOT EXISTS "entityId" character varying,
      ADD COLUMN IF NOT EXISTS "status" character varying,
      ADD COLUMN IF NOT EXISTS "performedById" uuid,
      ADD COLUMN IF NOT EXISTS "performedByName" character varying,
      ADD COLUMN IF NOT EXISTS "performedByRole" character varying,
      ADD COLUMN IF NOT EXISTS "notes" text,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    `);

    // ── 6. orders: orderSource enum type + columns ────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_source_enum') THEN
          CREATE TYPE "order_source_enum" AS ENUM ('qr_code', 'waiter', 'online', 'pos', 'kiosk', 'food_court');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "orderSource" character varying,
      ADD COLUMN IF NOT EXISTS "roomId" uuid,
      ADD COLUMN IF NOT EXISTS "isMerged" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "pendingConfirmationAt" TIMESTAMP;
    `);

    // ── 7. payments: missing columns ──────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "amountTendered" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "changeReturned" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "transactionId" character varying;
    `);

    // ── 8. qr_codes: parkingSpot + status ────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "qr_codes"
      ADD COLUMN IF NOT EXISTS "parkingSpot" character varying,
      ADD COLUMN IF NOT EXISTS "status" character varying NOT NULL DEFAULT 'active';
    `);

    // ── 9. Ensure Super Admin exists with credentials ─────────────────────
    const adminEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@till.local').toLowerCase();
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const existingUsers = await queryRunner.query(
      `SELECT id, password FROM "users" WHERE email = $1`,
      [adminEmail]
    );

    if (existingUsers.length === 0) {
      await queryRunner.query(
        `INSERT INTO "users" ("id", "email", "password", "name", "role", "status", "emailVerifiedAt", "createdAt", "updatedAt")
         VALUES (uuid_generate_v4(), $1, $2, 'Super Admin', 'super_admin', 'active', now(), now(), now())`,
        [adminEmail, hashedPassword]
      );
      console.log('[Migration 1754650000000] Super Admin user created with email:', adminEmail);
    } else {
      // Update password to ensure valid hash
      await queryRunner.query(
        `UPDATE "users" SET "password" = $1, "status" = 'active' WHERE email = $2`,
        [hashedPassword, adminEmail]
      );
      console.log('[Migration 1754650000000] Super Admin password refreshed.');
    }

    console.log('[Migration 1754650000000] tables, tenants, users, restaurants, and activity logs schema fully synchronized.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN IF EXISTS "name";`);
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN IF EXISTS "qrCode";`);
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN IF EXISTS "qrCodeImage";`);
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN IF EXISTS "location";`);
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN IF EXISTS "settings";`);
  }
}
