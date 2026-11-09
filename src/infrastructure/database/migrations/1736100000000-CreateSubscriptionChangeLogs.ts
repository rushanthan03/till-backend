import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptionChangeLogs1736100000000 implements MigrationInterface {
  name = 'CreateSubscriptionChangeLogs1736100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create subscription_change_logs table
    await queryRunner.query(`
      CREATE TABLE "subscription_change_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "oldPlanId" uuid NULL,
        "newPlanId" uuid NULL,
        "changeType" varchar NOT NULL CHECK ("changeType" IN (
          'plan_assigned',
          'plan_changed',
          'plan_upgraded',
          'plan_downgraded',
          'plan_cancelled',
          'plan_renewed',
          'plan_expired'
        )),
        "initiatedBy" varchar NOT NULL CHECK ("initiatedBy" IN (
          'super_admin',
          'restaurant_admin',
          'system'
        )),
        "userId" uuid NULL,
        "reason" text NULL,
        "metadata" jsonb NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),

        CONSTRAINT "fk_subscription_change_logs_restaurant"
          FOREIGN KEY ("restaurantId")
          REFERENCES "restaurants"("id")
          ON DELETE CASCADE,

        CONSTRAINT "fk_subscription_change_logs_old_plan"
          FOREIGN KEY ("oldPlanId")
          REFERENCES "subscription_plans"("id")
          ON DELETE SET NULL,

        CONSTRAINT "fk_subscription_change_logs_new_plan"
          FOREIGN KEY ("newPlanId")
          REFERENCES "subscription_plans"("id")
          ON DELETE SET NULL,

        CONSTRAINT "fk_subscription_change_logs_user"
          FOREIGN KEY ("userId")
          REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX "idx_subscription_change_logs_restaurant_created"
      ON "subscription_change_logs" ("restaurantId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_subscription_change_logs_change_type_created"
      ON "subscription_change_logs" ("changeType", "createdAt")
    `);

    // Add comments
    await queryRunner.query(`
      COMMENT ON TABLE "subscription_change_logs" IS 'Audit log for all subscription plan changes'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "subscription_change_logs"."changeType" IS 'Type of subscription change'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "subscription_change_logs"."initiatedBy" IS 'Who initiated the change'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "subscription_change_logs"."metadata" IS 'Additional context (old/new prices, limits, etc.)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscription_change_logs_change_type_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscription_change_logs_restaurant_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_change_logs"`);
  }
}
