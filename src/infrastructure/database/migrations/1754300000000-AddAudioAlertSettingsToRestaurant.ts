import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAudioAlertSettingsToRestaurant1754300000000 implements MigrationInterface {
  name = 'AddAudioAlertSettingsToRestaurant1754300000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "alertAudioRingtone" VARCHAR(50) DEFAULT 'uber_rush',
      ADD COLUMN IF NOT EXISTS "alertAudioRingMode" VARCHAR(30) DEFAULT 'continuous',
      ADD COLUMN IF NOT EXISTS "alertAudioVolume" NUMERIC(3,2) DEFAULT 0.80,
      ADD COLUMN IF NOT EXISTS "alertStopCondition" VARCHAR(30) DEFAULT 'action_only';

      COMMENT ON COLUMN "restaurants"."alertAudioRingtone" IS 'Selected alert ringtone: uber_rush, doordash_pulse, classic_bell, cash_register, kitchen_siren, marimba, ambient_chime';
      COMMENT ON COLUMN "restaurants"."alertAudioRingMode" IS 'Ring duration mode: continuous (Uber-style loop), loop_30s (30 sec rush), triple (3x), single (1x)';
      COMMENT ON COLUMN "restaurants"."alertAudioVolume" IS 'Alert volume float between 0.10 and 1.00';
      COMMENT ON COLUMN "restaurants"."alertStopCondition" IS 'Silence condition: action_only (rings until staff accepts/closes/views order) or any_click (stops on any screen click)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "alertAudioRingtone",
      DROP COLUMN IF EXISTS "alertAudioRingMode",
      DROP COLUMN IF EXISTS "alertAudioVolume",
      DROP COLUMN IF EXISTS "alertStopCondition";
    `);
  }
}
