import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stock ledger: every change to a product's stock level. Additive and idempotent. */
export class AddStockMovements1794223200000 implements MigrationInterface {
  name = 'AddStockMovements1794223200000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN CREATE TYPE "public"."stock_movements_type_enum" AS ENUM('opening','goods_receipt','adjustment','waste','damaged','expired','stocktake','sale','refund_restock'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`CREATE TABLE IF NOT EXISTS "stock_movements" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "restaurantId" uuid NOT NULL,
      "productId" uuid NOT NULL,
      "type" "public"."stock_movements_type_enum" NOT NULL,
      "quantity" numeric(12,3) NOT NULL,
      "quantityAfter" numeric(12,3) NOT NULL,
      "unitCost" numeric(10,2),
      "reason" character varying,
      "reference" character varying,
      "supplier" character varying,
      "userId" uuid,
      "userName" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id"),
      CONSTRAINT "FK_stock_movements_store" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_stock_movements_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_stock_movements_store_created" ON "stock_movements" ("restaurantId","createdAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_stock_movements_product_created" ON "stock_movements" ("productId","createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "stock_movements"`);
    await q.query(`DROP TYPE IF EXISTS "public"."stock_movements_type_enum"`);
  }
}
