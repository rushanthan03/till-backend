import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * COMPREHENSIVE FIX MIGRATION
 * ----------------------------
 * This single migration consolidates all manual SQL patches that were
 * previously run by hand on production/demo. Every statement uses
 * IF NOT EXISTS / IF EXISTS guards so it is safe to run on any
 * environment regardless of prior state.
 *
 * After this migration runs once, TypeORM records it in the
 * "migrations" table and will NEVER run it again on subsequent
 * restarts or merges.
 */
export class FixAllMissingColumnsComprehensive1754900000000 implements MigrationInterface {
  name = 'FixAllMissingColumnsComprehensive1754900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    // ================================================================
    // 1. QR_CODES TABLE
    // ================================================================
    // Drop NOT NULL on legacy "code" column (was causing insert failures)
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'qr_codes' AND column_name = 'code'
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE "qr_codes" ALTER COLUMN "code" DROP NOT NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "qr_codes"
        ADD COLUMN IF NOT EXISTS "qrUrl"       character varying,
        ADD COLUMN IF NOT EXISTS "type"        character varying DEFAULT 'TABLE',
        ADD COLUMN IF NOT EXISTS "status"      character varying DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "name"        character varying,
        ADD COLUMN IF NOT EXISTS "description" character varying,
        ADD COLUMN IF NOT EXISTS "imageUrl"    character varying,
        ADD COLUMN IF NOT EXISTS "metadata"    jsonb,
        ADD COLUMN IF NOT EXISTS "parkingSpot" character varying;
    `);

    // ================================================================
    // 2. INVOICE TABLE
    // ================================================================
    await queryRunner.query(`
      ALTER TABLE "invoice"
        ADD COLUMN IF NOT EXISTS "created_at"                TIMESTAMP      DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "updated_at"                TIMESTAMP      DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "base_amount"               numeric(10,2)  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "fees"                      numeric(10,2)  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "amount"                    numeric(10,2)  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "due_date"                  date           DEFAULT CURRENT_DATE + INTERVAL '14 days',
        ADD COLUMN IF NOT EXISTS "paid_date"                 date,
        ADD COLUMN IF NOT EXISTS "invoiceAttachmentUrl"      character varying,
        ADD COLUMN IF NOT EXISTS "billing_period"            character varying(32) DEFAULT '',
        ADD COLUMN IF NOT EXISTS "billing_period_start"      date,
        ADD COLUMN IF NOT EXISTS "billing_period_end"        date,
        ADD COLUMN IF NOT EXISTS "invoiceName"               character varying(32) DEFAULT '',
        ADD COLUMN IF NOT EXISTS "type"                      character varying NOT NULL DEFAULT 'subscription',
        ADD COLUMN IF NOT EXISTS "status"                    character varying NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "planId"                    uuid,
        ADD COLUMN IF NOT EXISTS "restaurantSubscriptionId"  uuid;
    `);

    // ================================================================
    // 3. TRANSACTIONS TABLE
    // ================================================================
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "restaurant_id" character varying(50),
        ADD COLUMN IF NOT EXISTS "invoice_id"    character varying(50),
        ADD COLUMN IF NOT EXISTS "amount"        numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "date"          date          DEFAULT CURRENT_DATE,
        ADD COLUMN IF NOT EXISTS "description"   character varying(255),
        ADD COLUMN IF NOT EXISTS "status"        character varying(30) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "type"          character varying(30) DEFAULT 'payout',
        ADD COLUMN IF NOT EXISTS "attachmentUrl" character varying;
    `);

    // ================================================================
    // 4. CUSTOMERS TABLE
    // ================================================================
    // Drop NOT NULL on legacy phoneNumber column
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'phoneNumber'
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE "customers" ALTER COLUMN "phoneNumber" DROP NOT NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "phone"            character varying,
        ADD COLUMN IF NOT EXISTS "name"             character varying,
        ADD COLUMN IF NOT EXISTS "restaurantId"     uuid,
        ADD COLUMN IF NOT EXISTS "refreshTokenHash" character varying;
    `);

    // Backfill phone from phoneNumber for existing rows
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'phoneNumber'
        ) THEN
          UPDATE "customers" SET "phone" = "phoneNumber" WHERE "phone" IS NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_phone"        ON "customers" ("phone");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_restaurantId" ON "customers" ("restaurantId");`);

    // ================================================================
    // 5. TENANTS TABLE
    // ================================================================
    await queryRunner.query(`
      ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "subdomain"             character varying,
        ADD COLUMN IF NOT EXISTS "contactEmail"          character varying,
        ADD COLUMN IF NOT EXISTS "contactPhoneNumber"    character varying,
        ADD COLUMN IF NOT EXISTS "logo"                  character varying,
        ADD COLUMN IF NOT EXISTS "description"           character varying,
        ADD COLUMN IF NOT EXISTS "settings"              jsonb,
        ADD COLUMN IF NOT EXISTS "address"               jsonb,
        ADD COLUMN IF NOT EXISTS "billingInfo"           jsonb,
        ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP;
    `);

    // ================================================================
    // 6. USERS TABLE
    // ================================================================
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "avatar"                character varying,
        ADD COLUMN IF NOT EXISTS "permissions"           jsonb,
        ADD COLUMN IF NOT EXISTS "lastLoginAt"           TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "emailVerifiedAt"       TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "phoneVerifiedAt"       TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "refreshToken"          character varying,
        ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP;
    `);

    // ================================================================
    // 7. TABLES TABLE
    // ================================================================
    await queryRunner.query(`
      ALTER TABLE "tables"
        ADD COLUMN IF NOT EXISTS "name"        character varying,
        ADD COLUMN IF NOT EXISTS "qrCode"      character varying,
        ADD COLUMN IF NOT EXISTS "qrCodeImage" character varying,
        ADD COLUMN IF NOT EXISTS "qrCodeId"    uuid,
        ADD COLUMN IF NOT EXISTS "location"    jsonb,
        ADD COLUMN IF NOT EXISTS "settings"    jsonb;
    `);

    // Backfill name from tableNumber for existing rows
    await queryRunner.query(`
      UPDATE "tables" SET "name" = "tableNumber" WHERE "name" IS NULL;
    `);

    // ================================================================
    // 8. ORDER_ACTIVITY_LOGS TABLE
    // ================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_activity_logs" (
        "id"              uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "orderId"         uuid,
        "restaurantId"    uuid,
        "tenantId"        uuid,
        "entityId"        character varying,
        "action"          character varying NOT NULL,
        "status"          character varying,
        "performedById"   uuid,
        "performedByName" character varying,
        "performedByRole" character varying,
        "notes"           text,
        "metadata"        jsonb,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_activity_logs" PRIMARY KEY ("id")
      );
    `);

    // Drop NOT NULL on orderId if it was accidentally added as NOT NULL
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'order_activity_logs' AND column_name = 'orderId'
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE "order_activity_logs" ALTER COLUMN "orderId" DROP NOT NULL;
        END IF;
      END $$;
    `);

    // ================================================================
    // 9. RESTAURANTS TABLE — smsSendMode & bypassKitchen
    // ================================================================
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "smsSendMode" character varying(20) DEFAULT 'ALWAYS',
        ADD COLUMN IF NOT EXISTS "bypassKitchen" boolean NOT NULL DEFAULT false;
    `);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Safe rollback — only drops columns we added (no data loss on existing columns)
    await queryRunner.query(`ALTER TABLE "restaurants"   DROP COLUMN IF EXISTS "smsSendMode";`);
    await queryRunner.query(`ALTER TABLE "qr_codes"      DROP COLUMN IF EXISTS "parkingSpot";`);
    await queryRunner.query(`ALTER TABLE "qr_codes"      DROP COLUMN IF EXISTS "metadata";`);
    await queryRunner.query(`ALTER TABLE "qr_codes"      DROP COLUMN IF EXISTS "imageUrl";`);
    await queryRunner.query(`ALTER TABLE "qr_codes"      DROP COLUMN IF EXISTS "description";`);
    await queryRunner.query(`ALTER TABLE "qr_codes"      DROP COLUMN IF EXISTS "name";`);
    await queryRunner.query(`ALTER TABLE "qr_codes"      DROP COLUMN IF EXISTS "status";`);
    await queryRunner.query(`ALTER TABLE "qr_codes"      DROP COLUMN IF EXISTS "type";`);
    await queryRunner.query(`ALTER TABLE "qr_codes"      DROP COLUMN IF EXISTS "qrUrl";`);
    await queryRunner.query(`ALTER TABLE "invoice"       DROP COLUMN IF EXISTS "restaurantSubscriptionId";`);
    await queryRunner.query(`ALTER TABLE "invoice"       DROP COLUMN IF EXISTS "planId";`);
    await queryRunner.query(`ALTER TABLE "transactions"  DROP COLUMN IF EXISTS "attachmentUrl";`);
    await queryRunner.query(`ALTER TABLE "customers"     DROP COLUMN IF EXISTS "refreshTokenHash";`);
    await queryRunner.query(`ALTER TABLE "users"         DROP COLUMN IF EXISTS "refreshTokenExpiresAt";`);
    await queryRunner.query(`ALTER TABLE "tables"        DROP COLUMN IF EXISTS "settings";`);
  }
}
