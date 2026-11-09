import { MigrationInterface, QueryRunner } from "typeorm";

export class FixOrderItemAddonUuidTypes1709292929292 implements MigrationInterface {
    name = 'FixOrderItemAddonUuidTypes1709292929292';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Fix column types to be UUID to match referenced columns
        await queryRunner.query(`ALTER TABLE "order_item_addons" ALTER COLUMN "orderItemId" TYPE uuid USING "orderItemId"::uuid`);
        await queryRunner.query(`ALTER TABLE "order_item_addons" ALTER COLUMN "addonId" TYPE uuid USING "addonId"::uuid`);

        // Ensure indices exist
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_item_addons_orderItemId" ON "order_item_addons" ("orderItemId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_item_addons_addonId" ON "order_item_addons" ("addonId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert changes if necessary (though reverting UUID to varchar is rarely needed)
        // This is a safe fallback to varchar
        await queryRunner.query(`ALTER TABLE "order_item_addons" ALTER COLUMN "orderItemId" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "order_item_addons" ALTER COLUMN "addonId" TYPE character varying`);
    }
}
