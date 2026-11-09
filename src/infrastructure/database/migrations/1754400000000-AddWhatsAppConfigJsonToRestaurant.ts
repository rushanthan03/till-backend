import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsAppConfigJsonToRestaurant1754400000000 implements MigrationInterface {
  name = 'AddWhatsAppConfigJsonToRestaurant1754400000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "whatsappConfig" jsonb DEFAULT '{"status":"DISCONNECTED","connectedNumber":null,"autoSendInvoice":true,"autoSendOTP":true,"autoSendLoyalty":true,"fallbackToSMS":true}';

      COMMENT ON COLUMN "restaurants"."whatsappConfig" IS 'WhatsApp Automation Preferences and Pairing State';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "whatsappConfig";
    `);
  }
}
