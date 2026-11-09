import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCustomerPhoneAndBaseEntityAuditColumns1754500000000 implements MigrationInterface {
  name = 'FixCustomerPhoneAndBaseEntityAuditColumns1754500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Fix customers table: Add phone, restaurantId, and refreshTokenHash ──
    await queryRunner.query(`
      ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "phone" character varying,
      ADD COLUMN IF NOT EXISTS "restaurantId" uuid,
      ADD COLUMN IF NOT EXISTS "refreshTokenHash" character varying;
    `);

    await queryRunner.query(`
      UPDATE "customers"
      SET "phone" = "phoneNumber"
      WHERE "phone" IS NULL AND "phoneNumber" IS NOT NULL;
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_phone" ON "customers" ("phone");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_restaurantId" ON "customers" ("restaurantId");`);

    // ── 2. Create customer_ratings table ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_ratings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customerId" uuid NOT NULL,
        "restaurantId" uuid NOT NULL,
        "orderId" uuid,
        "rating" integer NOT NULL DEFAULT 5,
        "comment" text,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_ratings" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customer_ratings_customerId" ON "customer_ratings" ("customerId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customer_ratings_restaurantId" ON "customer_ratings" ("restaurantId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customer_ratings_orderId" ON "customer_ratings" ("orderId");`);

    // ── 3. Fix categories table: BaseEntity audit fields + code/displayOrder ─
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "code" character varying DEFAULT '',
      ADD COLUMN IF NOT EXISTS "isShowcase" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "displayOrder" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "auditCreatedDateTime" TIMESTAMP NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "auditCreatedBy" character varying DEFAULT 'system',
      ADD COLUMN IF NOT EXISTS "auditModifiedBy" character varying,
      ADD COLUMN IF NOT EXISTS "auditModifiedDateTime" TIMESTAMP DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "auditDeletedBy" character varying,
      ADD COLUMN IF NOT EXISTS "auditDeletedDateTime" TIMESTAMP;
    `);

    // ── 4. Fix addons table: BaseEntity audit fields ───────────────────────
    await queryRunner.query(`
      ALTER TABLE "addons"
      ADD COLUMN IF NOT EXISTS "auditCreatedDateTime" TIMESTAMP NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "auditCreatedBy" character varying DEFAULT 'system',
      ADD COLUMN IF NOT EXISTS "auditModifiedBy" character varying,
      ADD COLUMN IF NOT EXISTS "auditModifiedDateTime" TIMESTAMP DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "auditDeletedBy" character varying,
      ADD COLUMN IF NOT EXISTS "auditDeletedDateTime" TIMESTAMP;
    `);

    // ── 5. Create bank_details table ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_details" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "bankName" character varying,
        "accountName" character varying,
        "accountNumber" character varying,
        "branch" character varying,
        "iban" character varying,
        "swiftCode" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bank_details" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bank_details_restaurantId" UNIQUE ("restaurantId")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_bank_details_restaurantId" ON "bank_details" ("restaurantId");`);

    // ── 6. Create order_activity_logs table ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_activity_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "action" character varying NOT NULL,
        "userId" character varying,
        "details" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_activity_logs" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_activity_logs_orderId" ON "order_activity_logs" ("orderId");`);

    // ── 7. Create food_court_cart table ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "food_court_cart" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sessionId" character varying NOT NULL,
        "tableNo" character varying,
        "restaurantId" character varying,
        "items" jsonb NOT NULL DEFAULT '[]',
        "totalAmount" numeric(10,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_food_court_cart" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_food_court_cart_sessionId" ON "food_court_cart" ("sessionId");`);

    // ── 8. Create restaurant_subscriptions table ──────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "restaurant_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "planId" uuid NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date,
        "billingCycle" character varying NOT NULL DEFAULT 'monthly',
        "isAutoRenew" boolean NOT NULL DEFAULT true,
        "status" character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_subscriptions" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_restaurant_subscriptions_restaurant" ON "restaurant_subscriptions" ("restaurantId", "status");`);

    // ── 9. Create order_usage table ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_usage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "month" character varying(7) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "totalOrders" integer NOT NULL DEFAULT 0,
        "totalUserCount" integer NOT NULL DEFAULT 0,
        "totalTableCount" integer NOT NULL DEFAULT 0,
        "totalQRCount" integer NOT NULL DEFAULT 0,
        "planId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_usage" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_usage_restaurant_month" ON "order_usage" ("restaurantId", "month");`);

    // ── 10. Create invoice table ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceName" character varying(32) NOT NULL,
        "restaurantId" uuid NOT NULL,
        "planId" uuid,
        "restaurantSubscriptionId" uuid,
        "type" character varying NOT NULL DEFAULT 'subscription',
        "billing_period" character varying(32) NOT NULL,
        "billing_period_start" date,
        "billing_period_end" date,
        "amount" numeric(10,2) NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice" PRIMARY KEY ("id")
      );
    `);

    // ── 11. Create transactions table ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurant_id" character varying(50) NOT NULL,
        "invoice_id" character varying(50),
        "amount" numeric(12,2) NOT NULL DEFAULT 0,
        "date" date NOT NULL DEFAULT CURRENT_DATE,
        "description" character varying(255),
        "status" character varying(30) NOT NULL DEFAULT 'pending',
        "type" character varying(30) NOT NULL DEFAULT 'payout',
        "attachmentUrl" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      );
    `);

    // ── 12. Create badges table ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "badges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "description" character varying,
        "icon" character varying,
        "backgroundColor" character varying NOT NULL DEFAULT '#FF5722',
        "textColor" character varying NOT NULL DEFAULT '#FFFFFF',
        "displayOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "isSystem" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_badges" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_badges_restaurantId" ON "badges" ("restaurantId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "badges";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_usage";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_subscriptions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "food_court_cart";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_activity_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_details";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_ratings";`);
  }
}
