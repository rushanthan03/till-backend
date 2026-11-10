import { MigrationInterface, QueryRunner } from 'typeorm';

/** Promotions, loyalty customers, and the sale columns that record them. Additive and idempotent. */
export class AddPromotionsAndCustomers1794223300000 implements MigrationInterface {
  name = 'AddPromotionsAndCustomers1794223300000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN CREATE TYPE "public"."promotions_type_enum" AS ENUM('percent_off','multibuy'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`DO $$ BEGIN CREATE TYPE "public"."promotions_scope_enum" AS ENUM('product','department'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`CREATE TABLE IF NOT EXISTS "promotions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "restaurantId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "type" "public"."promotions_type_enum" NOT NULL,
      "scope" "public"."promotions_scope_enum" NOT NULL,
      "productId" uuid,
      "department" character varying,
      "percentOff" numeric(5,2),
      "buyQty" integer,
      "bundlePrice" numeric(10,2),
      "startsAt" TIMESTAMP,
      "endsAt" TIMESTAMP,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_promotions" PRIMARY KEY ("id"),
      CONSTRAINT "FK_promotions_store" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_promotions_store_active" ON "promotions" ("restaurantId","isActive")`);

    // Databases built from the old restaurant app already have a "customers" table (diner accounts). Set it
    // aside as "legacy_customers" (data kept) so the loyalty table can take the name.
    await q.query(`DO $$ BEGIN
      IF to_regclass('public.customers') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='cardNumber')
         AND to_regclass('public.legacy_customers') IS NULL THEN
        ALTER TABLE "customers" RENAME TO "legacy_customers";
        ALTER INDEX IF EXISTS "PK_customers" RENAME TO "PK_legacy_customers";
      END IF;
    END $$`);
    await q.query(`CREATE TABLE IF NOT EXISTS "customers" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "restaurantId" uuid NOT NULL,
      "cardNumber" character varying NOT NULL,
      "name" character varying NOT NULL,
      "phone" character varying,
      "email" character varying,
      "marketingConsent" boolean NOT NULL DEFAULT false,
      "pointsBalance" integer NOT NULL DEFAULT 0,
      "totalSpend" numeric(12,2) NOT NULL DEFAULT 0,
      "visitCount" integer NOT NULL DEFAULT 0,
      "lastVisitAt" TIMESTAMP,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_customers" PRIMARY KEY ("id"),
      CONSTRAINT "FK_customers_store" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customers_store_card" ON "customers" ("restaurantId","cardNumber")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_store_phone" ON "customers" ("restaurantId","phone")`);

    await q.query(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "customerId" uuid`);
    await q.query(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "customerName" character varying`);
    await q.query(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "pointsEarned" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "promoDiscount" numeric(12,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "promotionName" character varying`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "promotionName"`);
    await q.query(`ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "promoDiscount"`);
    await q.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "pointsEarned"`);
    await q.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "customerName"`);
    await q.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "customerId"`);
    await q.query(`DROP TABLE IF EXISTS "customers"`);
    await q.query(`DROP TABLE IF EXISTS "promotions"`);
    await q.query(`DROP TYPE IF EXISTS "public"."promotions_scope_enum"`);
    await q.query(`DROP TYPE IF EXISTS "public"."promotions_type_enum"`);
  }
}
