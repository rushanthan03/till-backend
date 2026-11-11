import { MigrationInterface, QueryRunner } from 'typeorm';

/** Spending loyalty points: points discount per sale and line, points given back on refunds. Additive and idempotent. */
export class LoyaltyRedemption1794224200000 implements MigrationInterface {
  name = 'LoyaltyRedemption1794224200000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "pointsRedeemed" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "pointsDiscount" numeric(12,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "pointsDiscount" numeric(12,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "refundedPointsDiscount" numeric(12,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "pointsReturned" integer NOT NULL DEFAULT 0`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "refunds" DROP COLUMN IF EXISTS "pointsReturned"`);
    await q.query(`ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "refundedPointsDiscount"`);
    await q.query(`ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "pointsDiscount"`);
    await q.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "pointsDiscount"`);
    await q.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "pointsRedeemed"`);
  }
}
