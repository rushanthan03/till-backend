import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSubscriptionPlanOrderAndLimitValues1670000000000 implements MigrationInterface {
  name = 'UpdateSubscriptionPlanOrderAndLimitValues1670000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE subscription_plans SET "order" = 3, "orderLimit" = NULL WHERE code = 'premium';
      UPDATE subscription_plans SET "order" = 1, "orderLimit" = 50 WHERE code = 'basic';
      UPDATE subscription_plans SET "order" = 2, "orderLimit" = 500 WHERE code = 'pro';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Optionally revert to previous values if known, or set to NULL/default
    await queryRunner.query(`
      UPDATE subscription_plans SET "order" = NULL, "orderLimit" = NULL WHERE code IN ('premium', 'basic', 'pro');
    `);
  }
}
