import { MigrationInterface, QueryRunner } from 'typeorm';

/** Cash movements (paid in/out, safe drops, no sale) and their totals on shifts. Additive and idempotent. */
export class AddCashMovements1794223100000 implements MigrationInterface {
  name = 'AddCashMovements1794223100000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN CREATE TYPE "public"."cash_movements_type_enum" AS ENUM('paid_in','paid_out','safe_drop','no_sale'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cash_movements" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "restaurantId" uuid NOT NULL,
      "shiftId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "userName" character varying NOT NULL,
      "type" "public"."cash_movements_type_enum" NOT NULL,
      "amount" numeric(12,2) NOT NULL DEFAULT 0,
      "reason" character varying NOT NULL,
      "approvedById" uuid,
      "approvedByName" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_cash_movements" PRIMARY KEY ("id"),
      CONSTRAINT "FK_cash_movements_store" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_cash_movements_shift" ON "cash_movements" ("shiftId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_cash_movements_store_created" ON "cash_movements" ("restaurantId","createdAt")`);
    await q.query(`ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "paidIn" numeric(12,2)`);
    await q.query(`ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "paidOut" numeric(12,2)`);
    await q.query(`ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "safeDrops" numeric(12,2)`);
    await q.query(`ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "noSaleCount" integer`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "noSaleCount"`);
    await q.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "safeDrops"`);
    await q.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "paidOut"`);
    await q.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "paidIn"`);
    await q.query(`DROP TABLE IF EXISTS "cash_movements"`);
    await q.query(`DROP TYPE IF EXISTS "public"."cash_movements_type_enum"`);
  }
}
