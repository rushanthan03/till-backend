import { MigrationInterface, QueryRunner } from 'typeorm';

/** Card terminal charges: a card payment on a sale must match an approved charge here. Additive and idempotent. */
export class CardCharges1794223800000 implements MigrationInterface {
  name = 'CardCharges1794223800000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN CREATE TYPE "public"."card_charges_status_enum" AS ENUM('approved','declined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`CREATE TABLE IF NOT EXISTS "card_charges" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "storeId" uuid NOT NULL,
      "provider" character varying NOT NULL,
      "reference" character varying NOT NULL,
      "clientRef" character varying NOT NULL,
      "status" "public"."card_charges_status_enum" NOT NULL,
      "amount" numeric(12,2) NOT NULL,
      "scheme" character varying,
      "last4" character varying,
      "authCode" character varying,
      "declineReason" character varying,
      "saleId" uuid,
      "userId" uuid,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_card_charges" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_card_charges_store_reference" ON "card_charges" ("storeId","reference")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_card_charges_client_ref" ON "card_charges" ("storeId","clientRef")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "card_charges"`);
    await q.query(`DROP TYPE IF EXISTS "public"."card_charges_status_enum"`);
  }
}
