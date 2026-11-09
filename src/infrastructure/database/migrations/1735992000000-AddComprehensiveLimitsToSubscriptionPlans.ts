import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComprehensiveLimitsToSubscriptionPlans1735992000000 implements MigrationInterface {
  name = 'AddComprehensiveLimitsToSubscriptionPlans1735992000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add QR limit column
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ADD COLUMN IF NOT EXISTS "qrLimit" integer NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "subscription_plans"."qrLimit" IS 'Maximum number of QR codes allowed (null = unlimited)'
    `);

    // Add user limit column
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ADD COLUMN IF NOT EXISTS "userLimit" integer NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "subscription_plans"."userLimit" IS 'Maximum number of users allowed (null = unlimited)'
    `);

    // Add overage charge per invoice column
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ADD COLUMN IF NOT EXISTS "overageChargePerInvoice" numeric(10,2) NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "subscription_plans"."overageChargePerInvoice" IS 'Overage charge per additional invoice/order (in LKR or USD)'
    `);

    // Add overage charge per user column
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ADD COLUMN IF NOT EXISTS "overageChargePerUser" numeric(10,2) NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "subscription_plans"."overageChargePerUser" IS 'Overage charge per additional user per month (in USD)'
    `);

    // Update comment for orderLimit to clarify it's for invoices
    await queryRunner.query(`
      COMMENT ON COLUMN "subscription_plans"."orderLimit" IS 'Maximum number of orders/invoices allowed per month (null = unlimited)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "overageChargePerUser"`);
    await queryRunner.query(`ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "overageChargePerInvoice"`);
    await queryRunner.query(`ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "userLimit"`);
    await queryRunner.query(`ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "qrLimit"`);
  }
}
