import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderAlertAcknowledgements1754350000000 implements MigrationInterface {
  name = 'CreateOrderAlertAcknowledgements1754350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_alert_acknowledgements" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "alertId"        character varying NOT NULL,
        "orderId"        character varying,
        "alertType"      character varying,
        "userId"         character varying NOT NULL,
        "userName"       character varying,
        "userRole"       character varying,
        "restaurantId"   character varying NOT NULL,
        "notes"          text,
        "acknowledgedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_alert_acknowledgements" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ack_restaurant_acknowledgedAt" ON "order_alert_acknowledgements" ("restaurantId", "acknowledgedAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ack_alertId" ON "order_alert_acknowledgements" ("alertId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ack_userId" ON "order_alert_acknowledgements" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_alert_acknowledgements"`);
  }
}
