import { MigrationInterface, QueryRunner } from 'typeorm';

/** Loyalty customers belong to the company (tenant), so every store of a company shares them. Idempotent. */
export class CustomersPerTenant1794223400000 implements MigrationInterface {
  name = 'CustomersPerTenant1794223400000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "tenantId" uuid`);
    await q.query(`UPDATE "customers" c SET "tenantId" = r."tenantId"::uuid FROM "restaurants" r WHERE r.id = c."restaurantId" AND c."tenantId" IS NULL`);
    await q.query(`ALTER TABLE "customers" ALTER COLUMN "tenantId" SET NOT NULL`);
    await q.query(`DROP INDEX IF EXISTS "IDX_customers_store_card"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_customers_store_phone"`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customers_tenant_card" ON "customers" ("tenantId","cardNumber")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_tenant_phone" ON "customers" ("tenantId","phone")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_customers_tenant_phone"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_customers_tenant_card"`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customers_store_card" ON "customers" ("restaurantId","cardNumber")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_store_phone" ON "customers" ("restaurantId","phone")`);
    await q.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "tenantId"`);
  }
}
