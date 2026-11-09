import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSmsSendModeToRestaurant1754800000000 implements MigrationInterface {
  name = 'AddSmsSendModeToRestaurant1754800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "smsSendMode" character varying(20) DEFAULT 'ALWAYS';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "smsSendMode";
    `);
  }
}
