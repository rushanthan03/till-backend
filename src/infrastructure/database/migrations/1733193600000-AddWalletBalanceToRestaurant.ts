import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletBalanceToRestaurant1733193600000 implements MigrationInterface {
  name = 'AddWalletBalanceToRestaurant1733193600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "walletBalance" numeric(12,2) NOT NULL DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "walletBalance";
    `);
  }
}
