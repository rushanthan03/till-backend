import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `cashier` value to the users role enum.
 *
 * The User entity and the till code already use UserRole.CASHIER, but no earlier migration adds it, so a
 * database built from the migration chain cannot store cashier users. This is a purely additive change.
 * (TypeORM's own generated fix would rename and recreate the enum; adding a value is much safer.)
 *
 * Requires PostgreSQL 12 or newer: from 12 on, ALTER TYPE ... ADD VALUE is allowed inside the transaction
 * this project runs migrations in (the new value is not used within the same migration, which is the only
 * remaining restriction). It is idempotent, so re-running is harmless.
 */
export class AddCashierUserRole1794222950000 implements MigrationInterface {
  name = 'AddCashierUserRole1794222950000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'cashier'`);
  }

  public async down(): Promise<void> {
    // Postgres cannot remove a value from an enum, and removing it could orphan cashier users.
    // Reverting is therefore intentionally a no-op.
  }
}
