import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixSubscriptionLogInitiatorAndUuid1736108000000 implements MigrationInterface {
  name = 'FixSubscriptionLogInitiatorAndUuid1736108000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure uuid-ossp extension exists
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // 2. Update the CHECK constraint for initiatedBy to include 'tenant_admin'
    // We'll drop all check constraints on the initiatedBy column and re-add the correct one.
    // This is safer than guessing the name.

    await queryRunner.query(`
            DO $$ 
            DECLARE 
                r RECORD;
            BEGIN
                FOR r IN (
                    SELECT conname
                    FROM pg_constraint con
                    JOIN pg_attribute att ON att.attnum = ANY (con.conkey)
                    JOIN pg_class cls ON cls.oid = con.conrelid
                    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
                    WHERE nsp.nspname = 'public' 
                    AND cls.relname = 'subscription_change_logs'
                    AND att.attname = 'initiatedBy'
                    AND con.contype = 'c'
                ) LOOP
                    EXECUTE 'ALTER TABLE subscription_change_logs DROP CONSTRAINT ' || quote_ident(r.conname);
                END LOOP;
            END $$;
        `);

    await queryRunner.query(`
            ALTER TABLE "subscription_change_logs" 
            ADD CONSTRAINT "subscription_change_logs_initiatedBy_check" 
            CHECK ("initiatedBy" IN ('super_admin', 'tenant_admin', 'restaurant_admin', 'system'))
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "subscription_change_logs" 
            DROP CONSTRAINT IF EXISTS "subscription_change_logs_initiatedBy_check"
        `);

    await queryRunner.query(`
            ALTER TABLE "subscription_change_logs" 
            ADD CONSTRAINT "subscription_change_logs_initiatedBy_check" 
            CHECK ("initiatedBy" IN ('super_admin', 'restaurant_admin', 'system'))
        `);
  }
}
