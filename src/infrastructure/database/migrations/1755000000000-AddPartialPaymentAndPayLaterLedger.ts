import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPartialPaymentAndPayLaterLedger1755000000000 implements MigrationInterface {
  name = 'AddPartialPaymentAndPayLaterLedger1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add partial and pay-later columns to orders table (both camelCase and snake_case for DB flexibility)
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "paidAmount" numeric(12, 2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS "balanceDue" numeric(12, 2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS "paymentStatus" character varying(50) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "paymentMethod" character varying(50),
        ADD COLUMN IF NOT EXISTS "isPartial" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "isPayLater" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "customerName" character varying(255),
        ADD COLUMN IF NOT EXISTS "customerPhone" character varying(50),
        ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP WITH TIME ZONE;
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "paid_amount" numeric(12, 2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS "balance_due" numeric(12, 2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS "is_partial" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "is_pay_later" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "customer_name" character varying(255),
        ADD COLUMN IF NOT EXISTS "customer_phone" character varying(50),
        ADD COLUMN IF NOT EXISTS "last_payment_at" TIMESTAMP WITH TIME ZONE;
    `);

    // 2. Create order_payment_transactions ledger table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_payment_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "restaurantId" uuid NOT NULL,
        "transactionType" character varying(50) NOT NULL,
        "amount" numeric(12, 2) NOT NULL,
        "paymentMethod" character varying(50) NOT NULL,
        "balanceRemaining" numeric(12, 2) NOT NULL,
        "collectedByUserId" uuid,
        "collectedByUserRole" character varying(50),
        "customerName" character varying(255),
        "customerPhone" character varying(50),
        "sendSmsReceipt" boolean DEFAULT false,
        "notes" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_payment_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_payment_transactions_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_payment_transactions_restaurant" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_order_payments_order_id" ON "order_payment_transactions" ("orderId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_order_payments_restaurant_id" ON "order_payment_transactions" ("restaurantId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_payment_transactions"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "lastPaymentAt";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "customerPhone";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "customerName";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "isPayLater";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "isPartial";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "balanceDue";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "paidAmount";`);
  }
}
