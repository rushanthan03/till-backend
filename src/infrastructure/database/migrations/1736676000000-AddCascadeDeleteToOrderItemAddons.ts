import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCascadeDeleteToOrderItemAddons1736676000000 implements MigrationInterface {
    name = 'AddCascadeDeleteToOrderItemAddons1736676000000';
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop existing foreign key constraint (actual constraint name from production)
        await queryRunner.query(`
      ALTER TABLE "order_item_addons" 
      DROP CONSTRAINT IF EXISTS "FK_e41b6ae79c55ce4a4740fc79e22"
    `);

        // Add foreign key constraint with CASCADE delete
        await queryRunner.query(`
      ALTER TABLE "order_item_addons"
      ADD CONSTRAINT "FK_e41b6ae79c55ce4a4740fc79e22"
      FOREIGN KEY ("orderItemId") 
      REFERENCES "order_items"("id") 
      ON DELETE CASCADE
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop CASCADE constraint
        await queryRunner.query(`
      ALTER TABLE "order_item_addons" 
      DROP CONSTRAINT IF EXISTS "FK_e41b6ae79c55ce4a4740fc79e22"
    `);

        // Restore original constraint without CASCADE
        await queryRunner.query(`
      ALTER TABLE "order_item_addons"
      ADD CONSTRAINT "FK_e41b6ae79c55ce4a4740fc79e22"
      FOREIGN KEY ("orderItemId") 
      REFERENCES "order_items"("id")
    `);
    }
}
