import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit log table, and who approved each refund. Role permissions live in tenants.settings (jsonb, already there),
 * so they need no schema change. Additive and idempotent.
 */
export class AuditLogAndPermissions1794224300000 implements MigrationInterface {
  name = 'AuditLogAndPermissions1794224300000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid,
        "storeId" uuid,
        "userId" uuid,
        "userName" character varying(150),
        "userRole" character varying(30),
        "action" character varying(60) NOT NULL,
        "entityType" character varying(40),
        "entityId" character varying(80),
        "summary" character varying(500) NOT NULL,
        "details" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenant_created" ON "audit_logs" ("tenantId", "createdAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_store_created" ON "audit_logs" ("storeId", "createdAt")`);
    await q.query(`ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "approvedById" uuid`);
    await q.query(`ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "approvedByName" character varying`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "refunds" DROP COLUMN IF EXISTS "approvedByName"`);
    await q.query(`ALTER TABLE "refunds" DROP COLUMN IF EXISTS "approvedById"`);
    await q.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
