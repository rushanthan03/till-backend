import { MigrationInterface, QueryRunner } from 'typeorm';

/** Extra barcodes / pack sizes per product. Additive and idempotent. */
export class ProductBarcodes1794224000000 implements MigrationInterface {
  name = 'ProductBarcodes1794224000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "product_barcodes" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "storeId" uuid NOT NULL,
      "productId" uuid NOT NULL,
      "barcode" character varying NOT NULL,
      "packQuantity" integer NOT NULL DEFAULT 1,
      "label" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_product_barcodes" PRIMARY KEY ("id"),
      CONSTRAINT "FK_product_barcodes_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_barcodes_store_barcode" ON "product_barcodes" ("storeId","barcode")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_product_barcodes_product" ON "product_barcodes" ("productId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "product_barcodes"`);
  }
}
