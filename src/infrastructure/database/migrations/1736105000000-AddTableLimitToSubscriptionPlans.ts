import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTableLimitToSubscriptionPlans1736105000000 implements MigrationInterface {
  name = 'AddTableLimitToSubscriptionPlans1736105000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add table limit column
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ADD COLUMN IF NOT EXISTS "tableLimit" integer NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "subscription_plans"."tableLimit" IS 'Maximum number of tables allowed (null = unlimited)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "tableLimit"`);
  }
}
