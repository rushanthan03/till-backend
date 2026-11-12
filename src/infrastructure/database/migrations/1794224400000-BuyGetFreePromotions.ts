import { MigrationInterface, QueryRunner } from 'typeorm';

/** Buy X get Y free offers: a new promotion type and the number of free items. */
export class BuyGetFreePromotions1794224400000 implements MigrationInterface {
  name = 'BuyGetFreePromotions1794224400000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE "public"."promotions_type_enum" ADD VALUE IF NOT EXISTS 'buy_get_free'`);
    await q.query(`ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "freeQty" integer`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Postgres cannot drop one enum value, so the type keeps 'buy_get_free'; the offers themselves are removed.
    await q.query(`DELETE FROM "promotions" WHERE "type"::text = 'buy_get_free'`);
    await q.query(`ALTER TABLE "promotions" DROP COLUMN IF EXISTS "freeQty"`);
  }
}
