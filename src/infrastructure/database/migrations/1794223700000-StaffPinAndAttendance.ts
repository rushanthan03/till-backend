import { MigrationInterface, QueryRunner } from 'typeorm';

/** Employee numbers for PIN sign-in, and clock in/out entries. Additive and idempotent. */
export class StaffPinAndAttendance1794223700000 implements MigrationInterface {
  name = 'StaffPinAndAttendance1794223700000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employeeNumber" character varying`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_employee_number" ON "users" ("tenantId","employeeNumber") WHERE "employeeNumber" IS NOT NULL`);
    await q.query(`CREATE TABLE IF NOT EXISTS "time_entries" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "storeId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "userName" character varying NOT NULL,
      "clockedInAt" TIMESTAMP NOT NULL,
      "clockedOutAt" TIMESTAMP,
      "note" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_time_entries" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_time_entries_store_in" ON "time_entries" ("storeId","clockedInAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_time_entries_user_in" ON "time_entries" ("userId","clockedInAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "time_entries"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_users_employee_number"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "employeeNumber"`);
  }
}
