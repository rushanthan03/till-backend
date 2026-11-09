import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentOrderIdToOrders1736833000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add parentOrderId column to orders table
        await queryRunner.query(`
            ALTER TABLE "orders" 
            ADD COLUMN "parentOrderId" uuid
        `);

        // Add foreign key constraint to parentOrderId referencing orders(id)
        await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "FK_orders_parentOrderId" 
            FOREIGN KEY ("parentOrderId") 
            REFERENCES "orders"("id") 
            ON DELETE SET NULL
        `);

        // Create index on parentOrderId for query optimization
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_orders_parentOrderId" 
            ON "orders" ("parentOrderId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_orders_parentOrderId"
        `);

        // Drop foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "orders" 
            DROP CONSTRAINT IF EXISTS "FK_orders_parentOrderId"
        `);

        // Drop column
        await queryRunner.query(`
            ALTER TABLE "orders" 
            DROP COLUMN IF EXISTS "parentOrderId"
        `);
    }
}
