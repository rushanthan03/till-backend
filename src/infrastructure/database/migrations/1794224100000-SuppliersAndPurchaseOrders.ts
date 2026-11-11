import { MigrationInterface, QueryRunner } from 'typeorm';

/** Suppliers (per company), purchase orders (per store) and a product's usual supplier. Additive and idempotent. */
export class SuppliersAndPurchaseOrders1794224100000 implements MigrationInterface {
  name = 'SuppliersAndPurchaseOrders1794224100000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "suppliers" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "tenantId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "contactName" character varying,
      "email" character varying,
      "phone" character varying,
      "address" text,
      "accountNumber" character varying,
      "leadTimeDays" integer,
      "notes" text,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_suppliers" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_suppliers_tenant_name" ON "suppliers" ("tenantId","name")`);

    await q.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplierId" uuid`);

    await q.query(`DO $$ BEGIN CREATE TYPE "public"."purchase_orders_status_enum" AS ENUM('draft','ordered','partial','received','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`CREATE TABLE IF NOT EXISTS "purchase_orders" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "storeId" uuid NOT NULL,
      "supplierId" uuid NOT NULL,
      "seq" integer NOT NULL,
      "number" character varying NOT NULL,
      "status" "public"."purchase_orders_status_enum" NOT NULL DEFAULT 'draft',
      "expectedDate" date,
      "notes" text,
      "totalCost" numeric(12,2) NOT NULL DEFAULT 0,
      "receivedCost" numeric(12,2) NOT NULL DEFAULT 0,
      "createdById" uuid,
      "createdByName" character varying,
      "orderedAt" TIMESTAMP,
      "closedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id"),
      CONSTRAINT "FK_purchase_orders_supplier" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_purchase_orders_store_seq" ON "purchase_orders" ("storeId","seq")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_purchase_orders_store_status" ON "purchase_orders" ("storeId","status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_purchase_orders_supplier" ON "purchase_orders" ("supplierId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "purchase_order_lines" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "purchaseOrderId" uuid NOT NULL,
      "productId" uuid NOT NULL,
      "productName" character varying NOT NULL,
      "barcode" character varying NOT NULL,
      "quantity" numeric(12,3) NOT NULL,
      "unitCost" numeric(10,2) NOT NULL,
      "receivedQuantity" numeric(12,3) NOT NULL DEFAULT 0,
      "sortOrder" integer NOT NULL DEFAULT 0,
      CONSTRAINT "PK_purchase_order_lines" PRIMARY KEY ("id"),
      CONSTRAINT "FK_purchase_order_lines_order" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_purchase_order_lines_order" ON "purchase_order_lines" ("purchaseOrderId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "purchase_order_lines"`);
    await q.query(`DROP TABLE IF EXISTS "purchase_orders"`);
    await q.query(`DROP TYPE IF EXISTS "public"."purchase_orders_status_enum"`);
    await q.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "supplierId"`);
    await q.query(`DROP TABLE IF EXISTS "suppliers"`);
  }
}
