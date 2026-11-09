import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsAppConfigToRestaurant1754200000000 implements MigrationInterface {
  name = 'AddWhatsAppConfigToRestaurant1754200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" varchar NULL,
        ADD COLUMN IF NOT EXISTS "whatsappBusinessAccountId" varchar NULL,
        ADD COLUMN IF NOT EXISTS "whatsappAccessToken" varchar NULL,
        ADD COLUMN IF NOT EXISTS "whatsappTemplates" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP COLUMN IF EXISTS "whatsappPhoneNumberId",
        DROP COLUMN IF EXISTS "whatsappBusinessAccountId",
        DROP COLUMN IF EXISTS "whatsappAccessToken",
        DROP COLUMN IF EXISTS "whatsappTemplates"
    `);
  }
}
