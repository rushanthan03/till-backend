import { MigrationInterface, QueryRunner } from 'typeorm';

/** Manager approval PIN on users, and discount/override details on sales and sale lines. Additive and idempotent. */
export class AddApprovalsAndDiscounts1794223000000 implements MigrationInterface {
  name = 'AddApprovalsAndDiscounts1794223000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pinHash" character varying`);
    await q.query(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "discountTotal" numeric(12,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "approvedById" uuid`);
    await q.query(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "approvedByName" character varying`);
    await q.query(`ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "originalUnitPrice" numeric(10,2)`);
    await q.query(`ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "adjustmentReason" character varying`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "adjustmentReason"`);
    await q.query(`ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "originalUnitPrice"`);
    await q.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "approvedByName"`);
    await q.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "approvedById"`);
    await q.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "discountTotal"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "pinHash"`);
  }
}
