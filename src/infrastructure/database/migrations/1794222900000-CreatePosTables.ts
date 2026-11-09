import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Supermarket POS tables: products, sales (+ items, payments), till sessions (shifts) and refunds
 * (+ items, payments), with their enum types, indexes and foreign keys.
 *
 * Scope is deliberately limited to these eight tables. It was derived by diffing the entities against
 * a database built from the existing migration chain, and keeping ONLY the statements for the new tables.
 * (That diff also reports a lot of unrelated pre-existing drift between the older migrations and the
 * entities, including DROP COLUMNs. None of that is applied here.)
 *
 * Safe to re-run: every statement is guarded (IF NOT EXISTS / constraint-exists checks), so databases
 * that already have these tables, for example from development schema sync, are left untouched.
 */
export class CreatePosTables1794222900000 implements MigrationInterface {
  name = 'CreatePosTables1794222900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'products_unittype_enum') THEN
          CREATE TYPE "public"."products_unittype_enum" AS ENUM('each', 'weight');
        END IF;
      END $$;`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "restaurantId" uuid NOT NULL, "name" character varying NOT NULL, "barcode" character varying NOT NULL, "sku" character varying, "department" character varying NOT NULL, "category" character varying, "brand" character varying, "unitType" "public"."products_unittype_enum" NOT NULL DEFAULT 'each', "price" numeric(10,2) NOT NULL, "costPrice" numeric(10,2), "vatRate" numeric(5,2) NOT NULL DEFAULT '20', "ageRestriction" integer NOT NULL DEFAULT '0', "stockQuantity" numeric(12,3) NOT NULL DEFAULT '0', "reorderLevel" numeric(12,3) NOT NULL DEFAULT '0', "imageUrl" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_96ec383a92a93276e146a381ae" ON "products" ("restaurantId", "department")`);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_3b8df609883d00fbd8d49e5f1f" ON "products" ("restaurantId", "barcode")`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_11a1d3b4f6f1c6630be3127391" ON "products" ("restaurantId")`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_status_enum') THEN
          CREATE TYPE "public"."sales_status_enum" AS ENUM('completed', 'partially_refunded', 'refunded', 'voided');
        END IF;
      END $$;`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "sales" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "restaurantId" uuid NOT NULL, "receiptSeq" integer NOT NULL, "receiptNumber" character varying NOT NULL, "cashierId" uuid, "cashierName" character varying, "shiftId" uuid, "status" "public"."sales_status_enum" NOT NULL DEFAULT 'completed', "total" numeric(12,2) NOT NULL, "netTotal" numeric(12,2) NOT NULL, "vatTotal" numeric(12,2) NOT NULL, "changeDue" numeric(12,2) NOT NULL DEFAULT '0', "refundedTotal" numeric(12,2) NOT NULL DEFAULT '0', "itemCount" integer NOT NULL, "ageVerified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4f0bc990ae81dba46da680895ea" PRIMARY KEY ("id"))`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3c214a714a6034173e64f71d16" ON "sales" ("restaurantId", "createdAt")`);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_a7a9e4f639ab22ac08c73ce93b" ON "sales" ("restaurantId", "receiptSeq")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "sale_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "saleId" uuid NOT NULL, "productId" uuid, "name" character varying NOT NULL, "barcode" character varying NOT NULL, "quantity" numeric(12,3) NOT NULL, "unitPrice" numeric(10,2) NOT NULL, "vatRate" numeric(5,2) NOT NULL, "lineTotal" numeric(12,2) NOT NULL, "vatAmount" numeric(12,2) NOT NULL, "ageRestriction" integer NOT NULL DEFAULT '0', "refundedQuantity" numeric(12,3) NOT NULL DEFAULT '0', "refundedAmount" numeric(12,2) NOT NULL DEFAULT '0', "refundedVat" numeric(12,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_5a7dc5b4562a9e590528b3e08ab" PRIMARY KEY ("id"))`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_c642be08de5235317d4cf3deb4" ON "sale_items" ("saleId")`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_payments_method_enum') THEN
          CREATE TYPE "public"."sale_payments_method_enum" AS ENUM('cash', 'card');
        END IF;
      END $$;`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "sale_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "saleId" uuid NOT NULL, "method" "public"."sale_payments_method_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "tendered" numeric(12,2), "reference" character varying, CONSTRAINT "PK_1117d02608a00d131b95f60a58e" PRIMARY KEY ("id"))`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ad8e4736c560dc015611d3b7fc" ON "sale_payments" ("saleId")`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shifts_status_enum') THEN
          CREATE TYPE "public"."shifts_status_enum" AS ENUM('open', 'closed');
        END IF;
      END $$;`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "shifts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "restaurantId" uuid NOT NULL, "userId" uuid NOT NULL, "cashierName" character varying NOT NULL, "status" "public"."shifts_status_enum" NOT NULL DEFAULT 'open', "openedAt" TIMESTAMP NOT NULL DEFAULT now(), "closedAt" TIMESTAMP, "openingFloat" numeric(12,2) NOT NULL, "openingNote" character varying, "countedCash" numeric(12,2), "expectedCash" numeric(12,2), "variance" numeric(12,2), "closeNote" character varying, "transactionCount" integer, "refundCount" integer, "grossSales" numeric(12,2), "vatTotal" numeric(12,2), "cashSales" numeric(12,2), "cardSales" numeric(12,2), "refundsTotal" numeric(12,2), "cashRefunds" numeric(12,2), "cardRefunds" numeric(12,2), CONSTRAINT "PK_84d692e367e4d6cdf045828768c" PRIMARY KEY ("id"))`);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_shifts_one_open_per_user" ON "shifts" ("restaurantId", "userId") WHERE "status" = 'open'`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_88c8e01546be7b2a7a3d3fd146" ON "shifts" ("restaurantId", "openedAt")`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refunds_reason_enum') THEN
          CREATE TYPE "public"."refunds_reason_enum" AS ENUM('faulty', 'damaged', 'wrong_item', 'changed_mind', 'price_error', 'other');
        END IF;
      END $$;`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "refunds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "restaurantId" uuid NOT NULL, "refundSeq" integer NOT NULL, "refundNumber" character varying NOT NULL, "saleId" uuid NOT NULL, "originalReceiptNumber" character varying NOT NULL, "shiftId" uuid NOT NULL, "processedById" uuid, "processedByName" character varying, "reason" "public"."refunds_reason_enum" NOT NULL, "note" character varying, "total" numeric(12,2) NOT NULL, "vatTotal" numeric(12,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5106efb01eeda7e49a78b869738" PRIMARY KEY ("id"))`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_57d2f9b489e1f1e7715a702807" ON "refunds" ("shiftId")`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0c4485d119bfcdc8d9ba260e02" ON "refunds" ("saleId")`);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_a45d44379283cdfc5eff1a0aa8" ON "refunds" ("restaurantId", "refundSeq")`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_items_disposition_enum') THEN
          CREATE TYPE "public"."refund_items_disposition_enum" AS ENUM('restock', 'waste', 'damaged');
        END IF;
      END $$;`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "refund_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "refundId" uuid NOT NULL, "saleItemId" uuid NOT NULL, "productId" uuid, "name" character varying NOT NULL, "quantity" numeric(12,3) NOT NULL, "lineTotal" numeric(12,2) NOT NULL, "vatAmount" numeric(12,2) NOT NULL, "disposition" "public"."refund_items_disposition_enum" NOT NULL, CONSTRAINT "PK_ef892918375a6101948b90f1140" PRIMARY KEY ("id"))`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_52e8cb62be2884dde2eef2eb1c" ON "refund_items" ("refundId")`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_payments_method_enum') THEN
          CREATE TYPE "public"."refund_payments_method_enum" AS ENUM('cash', 'card');
        END IF;
      END $$;`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "refund_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "refundId" uuid NOT NULL, "method" "public"."refund_payments_method_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "reference" character varying, CONSTRAINT "PK_db53cfd27f412535c4eb492d466" PRIMARY KEY ("id"))`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_34fff0d240030f38879357c86d" ON "refund_payments" ("refundId")`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_11a1d3b4f6f1c6630be3127391d') THEN
          ALTER TABLE "products" ADD CONSTRAINT "FK_11a1d3b4f6f1c6630be3127391d" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_e1624dc578911462b7bbc69319a') THEN
          ALTER TABLE "sales" ADD CONSTRAINT "FK_e1624dc578911462b7bbc69319a" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_c642be08de5235317d4cf3deb40') THEN
          ALTER TABLE "sale_items" ADD CONSTRAINT "FK_c642be08de5235317d4cf3deb40" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_d675aea38a16313e844662c48f8') THEN
          ALTER TABLE "sale_items" ADD CONSTRAINT "FK_d675aea38a16313e844662c48f8" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ad8e4736c560dc015611d3b7fc2') THEN
          ALTER TABLE "sale_payments" ADD CONSTRAINT "FK_ad8e4736c560dc015611d3b7fc2" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_d9051ee3207b592348c5dacd168') THEN
          ALTER TABLE "shifts" ADD CONSTRAINT "FK_d9051ee3207b592348c5dacd168" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_a5f31f2fdce049e922845b3a1fb') THEN
          ALTER TABLE "refunds" ADD CONSTRAINT "FK_a5f31f2fdce049e922845b3a1fb" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_0c4485d119bfcdc8d9ba260e02b') THEN
          ALTER TABLE "refunds" ADD CONSTRAINT "FK_0c4485d119bfcdc8d9ba260e02b" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_52e8cb62be2884dde2eef2eb1c4') THEN
          ALTER TABLE "refund_items" ADD CONSTRAINT "FK_52e8cb62be2884dde2eef2eb1c4" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;`);

    await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_34fff0d240030f38879357c86d9') THEN
          ALTER TABLE "refund_payments" ADD CONSTRAINT "FK_34fff0d240030f38879357c86d9" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping a table removes its indexes and foreign keys. Children first, then parents.
    await queryRunner.query(`DROP TABLE IF EXISTS "refund_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refund_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refunds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shifts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."refund_payments_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."refund_items_disposition_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."refunds_reason_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."shifts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sale_payments_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sales_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."products_unittype_enum"`);
  }
}
