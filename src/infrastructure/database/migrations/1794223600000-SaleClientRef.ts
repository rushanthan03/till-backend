import { MigrationInterface, QueryRunner } from 'typeorm';

/** Id a till gives each sale so resending an offline sale can never create a second copy. Additive and idempotent. */
export class SaleClientRef1794223600000 implements MigrationInterface {
  name = 'SaleClientRef1794223600000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "clientRef" character varying`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sales_client_ref" ON "sales" ("storeId","clientRef") WHERE "clientRef" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "UQ_sales_client_ref"`);
    await q.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "clientRef"`);
  }
}
