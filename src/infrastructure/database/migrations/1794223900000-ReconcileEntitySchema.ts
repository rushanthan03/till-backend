import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The older migrations stopped short of what the entities now need: a database built only from migrations lacked
 * `stores.status`, `tenants.type`/`status`/`subscriptionPlan` and two store settings. This adds them. Every step is
 * additive and idempotent, so it is safe on databases that already have the columns (for example ones built by
 * automatic sync in development).
 */
export class ReconcileEntitySchema1794223900000 implements MigrationInterface {
  name = 'ReconcileEntitySchema1794223900000';

  private enumType(q: QueryRunner, name: string, values: string[]) {
    const list = values.map((v) => `'${v}'`).join(', ');
    return q.query(`DO $$ BEGIN CREATE TYPE "public"."${name}" AS ENUM(${list}); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  }

  public async up(q: QueryRunner): Promise<void> {
    await this.enumType(q, 'stores_status_enum', ['active', 'inactive']);
    await q.query(`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "status" "public"."stores_status_enum" NOT NULL DEFAULT 'active'`);

    await this.enumType(q, 'stores_paymenttiming_enum', ['pay_at_first', 'pay_at_last']);
    await q.query(`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "paymentTiming" "public"."stores_paymenttiming_enum" DEFAULT 'pay_at_last'`);

    await this.enumType(q, 'stores_servicechargetype_enum', ['percentage', 'fixed']);
    await q.query(`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "serviceChargeType" "public"."stores_servicechargetype_enum" NOT NULL DEFAULT 'percentage'`);

    // Existing tenants get the only type that exists today ('restaurant' is the stored value for a store group).
    await this.enumType(q, 'tenants_type_enum', ['restaurant']);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "type" "public"."tenants_type_enum" NOT NULL DEFAULT 'restaurant'`);
    await this.enumType(q, 'tenants_status_enum', ['active', 'inactive', 'suspended']);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "status" "public"."tenants_status_enum" NOT NULL DEFAULT 'active'`);
    // Old restaurant-era column the entity no longer fills in; without this, creating a tenant fails.
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='email' AND is_nullable='NO') THEN
        ALTER TABLE "tenants" ALTER COLUMN "email" DROP NOT NULL;
      END IF;
    END $$`);
    await this.enumType(q, 'tenants_subscriptionplan_enum', ['basic', 'pro', 'enterprise']);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscriptionPlan" "public"."tenants_subscriptionplan_enum"`);
  }

  public async down(): Promise<void> {
    // Dropping columns the application needs would break it, so reverting is intentionally a no-op.
  }
}
