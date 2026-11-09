import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoyaltyTables1737100000000 implements MigrationInterface {
  name = 'CreateLoyaltyTables1737100000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create restaurant_loyalty_settings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "restaurant_loyalty_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "isEnabled" boolean NOT NULL DEFAULT false,
        "earnPointsPerAmount" numeric(10,2) NOT NULL DEFAULT 100.00,
        "pointsEarnedRatio" numeric(10,2) NOT NULL DEFAULT 1.00,
        "minOrderAmountToEarn" numeric(10,2) NOT NULL DEFAULT 0.00,
        "excludeTaxAndServiceCharge" boolean NOT NULL DEFAULT true,
        "redemptionValuePerPoint" numeric(10,2) NOT NULL DEFAULT 5.00,
        "minPointsToRedeem" numeric(10,2) NOT NULL DEFAULT 50.00,
        "maxDiscountPercentage" numeric(5,2) NOT NULL DEFAULT 50.00,
        "maxDiscountFixedAmount" numeric(10,2),
        "pointsExpireDays" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_loyalty_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_restaurant_loyalty_settings_restaurantId" UNIQUE ("restaurantId"),
        CONSTRAINT "FK_restaurant_loyalty_settings_restaurant" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE
      );
    `);

    // 2. Create customer_loyalty_accounts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_loyalty_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "customerPhone" varchar NOT NULL,
        "customerName" varchar,
        "totalEarned" numeric(12,2) NOT NULL DEFAULT 0.00,
        "totalRedeemed" numeric(12,2) NOT NULL DEFAULT 0.00,
        "currentBalance" numeric(12,2) NOT NULL DEFAULT 0.00,
        "tierLevel" varchar NOT NULL DEFAULT 'BRONZE',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_loyalty_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customer_loyalty_account_restaurant_phone" UNIQUE ("restaurantId", "customerPhone")
      );
    `);

    // 3. Create loyalty_transactions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "accountId" uuid NOT NULL,
        "orderId" uuid,
        "type" varchar NOT NULL,
        "points" numeric(10,2) NOT NULL,
        "amountValue" numeric(10,2) NOT NULL,
        "notes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loyalty_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_loyalty_transactions_account" FOREIGN KEY ("accountId") REFERENCES "customer_loyalty_accounts"("id") ON DELETE CASCADE
      );
    `);

    // Create Indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loyalty_transactions_accountId" ON "loyalty_transactions" ("accountId");
      CREATE INDEX IF NOT EXISTS "IDX_loyalty_transactions_orderId" ON "loyalty_transactions" ("orderId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "loyalty_transactions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_loyalty_accounts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_loyalty_settings";`);
  }
}
