import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class ResetSuperAdminPassword1754700000000 implements MigrationInterface {
  name = 'ResetSuperAdminPassword1754700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const adminEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@till.local').toLowerCase();
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const existingUsers = await queryRunner.query(
      `SELECT id FROM "users" WHERE email = $1`,
      [adminEmail]
    );

    if (existingUsers.length === 0) {
      await queryRunner.query(
        `INSERT INTO "users" ("id", "email", "password", "name", "role", "status", "emailVerifiedAt", "createdAt", "updatedAt")
         VALUES (uuid_generate_v4(), $1, $2, 'Super Admin', 'super_admin', 'active', now(), now(), now())`,
        [adminEmail, hashedPassword]
      );
      console.log('[Migration 1754700000000] Super Admin user created with email:', adminEmail);
    } else {
      await queryRunner.query(
        `UPDATE "users" SET "password" = $1, "status" = 'active', "role" = 'super_admin' WHERE email = $2`,
        [hashedPassword, adminEmail]
      );
      console.log('[Migration 1754700000000] Super Admin password reset successfully for:', adminEmail);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op
  }
}
