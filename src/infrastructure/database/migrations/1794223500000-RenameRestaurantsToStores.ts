import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The shop used to be called a "restaurant" in the database. Renames the table to `stores` and the
 * `restaurantId` column to `storeId` on every till table. Renames keep all data, keys and indexes.
 * Idempotent: safe to run on a database that is already renamed.
 */
const TABLES = ['users', 'products', 'sales', 'shifts', 'refunds', 'cash_movements', 'stock_movements', 'promotions', 'customers'];

export class RenameRestaurantsToStores1794223500000 implements MigrationInterface {
  name = 'RenameRestaurantsToStores1794223500000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN
      IF to_regclass('public.restaurants') IS NOT NULL AND to_regclass('public.stores') IS NULL THEN
        ALTER TABLE "restaurants" RENAME TO "stores";
      END IF;
    END $$`);
    for (const t of TABLES) {
      await q.query(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' AND column_name='restaurantId')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' AND column_name='storeId') THEN
          ALTER TABLE "${t}" RENAME COLUMN "restaurantId" TO "storeId";
        END IF;
      END $$`);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of TABLES) {
      await q.query(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' AND column_name='storeId') THEN
          ALTER TABLE "${t}" RENAME COLUMN "storeId" TO "restaurantId";
        END IF;
      END $$`);
    }
    await q.query(`DO $$ BEGIN
      IF to_regclass('public.stores') IS NOT NULL AND to_regclass('public.restaurants') IS NULL THEN
        ALTER TABLE "stores" RENAME TO "restaurants";
      END IF;
    END $$`);
  }
}
