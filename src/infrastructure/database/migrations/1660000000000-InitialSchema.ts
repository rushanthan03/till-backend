import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1660000000000 implements MigrationInterface {
    name = 'InitialSchema1660000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // Create ENUM types
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_role_enum" AS ENUM('super_admin', 'tenant_admin', 'manager', 'waiter', 'kitchen_staff');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_status_enum" AS ENUM('active', 'inactive', 'suspended');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

        // Create tenants table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "phoneNumber" character varying,
        "status" character varying NOT NULL DEFAULT 'active',
        "type" character varying NOT NULL DEFAULT 'single',
        "subscriptionPlan" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id")
      )
    `);

        // Create users table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "phoneNumber" character varying,
        "password" character varying NOT NULL,
        "name" character varying NOT NULL,
        "role" "users_role_enum" NOT NULL,
        "status" "users_status_enum" NOT NULL DEFAULT 'active',
        "avatar" character varying,
        "permissions" jsonb,
        "lastLoginAt" TIMESTAMP,
        "emailVerifiedAt" TIMESTAMP,
        "phoneVerifiedAt" TIMESTAMP,
        "refreshToken" character varying,
        "refreshTokenExpiresAt" TIMESTAMP,
        "tenantId" uuid,
        "restaurantId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

        // Create indexes for users
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_phoneNumber" ON "users" ("phoneNumber")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_tenantId" ON "users" ("tenantId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_restaurantId" ON "users" ("restaurantId")`);

        // Create restaurants table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "restaurants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "logo" character varying,
        "logoKey" character varying,
        "banner" character varying,
        "bannerKey" character varying,
        "address" jsonb,
        "contactEmail" character varying,
        "contactPhoneNumber" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "openTime" character varying,
        "closeTime" character varying,
        "openHours" jsonb,
        "status" character varying NOT NULL DEFAULT 'active',
        "paymentTiming" character varying DEFAULT 'pay_at_last',
        "requireWaiterConfirmation" boolean NOT NULL DEFAULT false,
        "walletBalance" numeric(12,2) NOT NULL DEFAULT 0,
        "walletTotalEarned" numeric(12,2) NOT NULL DEFAULT 0,
        "walletTotalWithdrawn" numeric(12,2) NOT NULL DEFAULT 0,
        "primaryColor" character varying,
        "secondaryColor" character varying,
        "tertiaryColor" character varying,
        "serviceChargePercentage" numeric(5,2) NOT NULL DEFAULT 0,
        "applyServiceCharge" boolean NOT NULL DEFAULT false,
        "serviceChargeType" character varying NOT NULL DEFAULT 'percentage',
        "fixedServiceCharge" numeric(10,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurants" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_restaurants_tenantId" ON "restaurants" ("tenantId")`);

        // Create subscription_plans table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "description" character varying,
        "priceMonthly" numeric(10,2),
        "priceYearly" numeric(10,2),
        "status" character varying NOT NULL DEFAULT 'active',
        "features" jsonb,
        "billingCycle" character varying NOT NULL DEFAULT 'monthly',
        "yearlySavingsPercent" integer DEFAULT 0,
        "orderLimit" integer,
        "qrLimit" integer,
        "userLimit" integer,
        "tableLimit" integer,
        "overageChargePerInvoice" numeric(10,2) DEFAULT 0,
        "overageChargePerUser" numeric(10,2) DEFAULT 0,
        "overageChargePerQR" numeric(10,2) DEFAULT 0,
        "overageChargePerTable" numeric(10,2) DEFAULT 0,
        "order" integer,
        "isArchived" boolean NOT NULL DEFAULT false,
        "isSpecializedPlan" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subscription_plans_code" UNIQUE ("code"),
        CONSTRAINT "PK_subscription_plans" PRIMARY KEY ("id")
      )
    `);

        // Create customers table (with phone, name, email, restaurantId)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phone" character varying,
        "phoneNumber" character varying,
        "name" character varying,
        "email" character varying,
        "restaurantId" uuid,
        "isVerified" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers" PRIMARY KEY ("id")
      )
    `);

        // Ensure columns exist if customers table was already partially created
        await queryRunner.query(`
      ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "phone" character varying,
      ADD COLUMN IF NOT EXISTS "phoneNumber" character varying,
      ADD COLUMN IF NOT EXISTS "restaurantId" uuid;
    `);

        // Populate phone from phoneNumber if phone is empty
        await queryRunner.query(`
      UPDATE "customers" SET "phone" = "phoneNumber" WHERE "phone" IS NULL AND "phoneNumber" IS NOT NULL;
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_phone" ON "customers" ("phone")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_restaurantId" ON "customers" ("restaurantId")`);

        // Create categories table (with BaseEntity audit fields)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "code" character varying,
        "description" character varying,
        "image" character varying,
        "imageKey" character varying,
        "isShowcase" boolean NOT NULL DEFAULT false,
        "displayOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "auditCreatedDateTime" TIMESTAMP NOT NULL DEFAULT now(),
        "auditCreatedBy" character varying DEFAULT 'system',
        "auditModifiedBy" character varying,
        "auditModifiedDateTime" TIMESTAMP DEFAULT now(),
        "auditDeletedBy" character varying,
        "auditDeletedDateTime" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id")
      )
    `);

        // Ensure BaseEntity columns exist on categories if table already existed
        await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "code" character varying,
      ADD COLUMN IF NOT EXISTS "isShowcase" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "displayOrder" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "auditCreatedDateTime" TIMESTAMP NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "auditCreatedBy" character varying DEFAULT 'system',
      ADD COLUMN IF NOT EXISTS "auditModifiedBy" character varying,
      ADD COLUMN IF NOT EXISTS "auditModifiedDateTime" TIMESTAMP DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "auditDeletedBy" character varying,
      ADD COLUMN IF NOT EXISTS "auditDeletedDateTime" TIMESTAMP;
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_categories_restaurantId" ON "categories" ("restaurantId")`);

        // Create menus table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "menus" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "categoryId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "note" character varying,
        "price" numeric(10,2) NOT NULL,
        "image" character varying,
        "imageKey" character varying,
        "discount" numeric(10,2) NOT NULL DEFAULT 0,
        "quantityAvailable" integer,
        "isAvailable" boolean NOT NULL DEFAULT true,
        "preparationTime" integer,
        "availableFrom" character varying,
        "availableTo" character varying,
        "variantOptions" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menus" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_menus_restaurantId" ON "menus" ("restaurantId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_menus_categoryId" ON "menus" ("categoryId")`);

        // Create addons table (with BaseEntity audit fields)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "addons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" character varying,
        "image" character varying,
        "imageKey" character varying,
        "price" numeric(10,2) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "unitPrice" numeric(10,2) NOT NULL DEFAULT 0,
        "type" character varying NOT NULL DEFAULT 'single',
        "status" character varying NOT NULL DEFAULT 'active',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isRequired" boolean NOT NULL DEFAULT false,
        "maxSelection" integer NOT NULL DEFAULT 1,
        "restaurantId" uuid NOT NULL,
        "auditCreatedDateTime" TIMESTAMP NOT NULL DEFAULT now(),
        "auditCreatedBy" character varying DEFAULT 'system',
        "auditModifiedBy" character varying,
        "auditModifiedDateTime" TIMESTAMP DEFAULT now(),
        "auditDeletedBy" character varying,
        "auditDeletedDateTime" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_addons" PRIMARY KEY ("id")
      )
    `);

        // Ensure BaseEntity columns exist on addons if table already existed
        await queryRunner.query(`
      ALTER TABLE "addons"
      ADD COLUMN IF NOT EXISTS "auditCreatedDateTime" TIMESTAMP NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "auditCreatedBy" character varying DEFAULT 'system',
      ADD COLUMN IF NOT EXISTS "auditModifiedBy" character varying,
      ADD COLUMN IF NOT EXISTS "auditModifiedDateTime" TIMESTAMP DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "auditDeletedBy" character varying,
      ADD COLUMN IF NOT EXISTS "auditDeletedDateTime" TIMESTAMP;
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_addons_restaurantId" ON "addons" ("restaurantId")`);

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "menu_addons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "menuId" uuid NOT NULL,
        "addonId" uuid NOT NULL,
        "overridePrice" numeric(10,2),
        "isRequired" boolean NOT NULL DEFAULT false,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menu_addons" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_menu_addons_menuId_addonId" UNIQUE ("menuId", "addonId")
      )
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_menu_addons_menuId_addonId" ON "menu_addons" ("menuId", "addonId")`);

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tables" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "tableNumber" character varying NOT NULL,
        "capacity" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'available',
        "qrCodeId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tables" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tables_restaurantId" ON "tables" ("restaurantId")`);

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderNumber" character varying,
        "restaurantId" uuid NOT NULL,
        "customerId" uuid NOT NULL,
        "tableNo" character varying,
        "tableId" uuid,
        "status" character varying NOT NULL DEFAULT 'pending',
        "isOnHold" boolean NOT NULL DEFAULT false,
        "holdReason" character varying,
        "orderType" character varying,
        "subtotal" numeric(10,2) NOT NULL DEFAULT 0,
        "serviceCharge" numeric(10,2) NOT NULL DEFAULT 0,
        "tax" numeric(10,2) NOT NULL DEFAULT 0,
        "discount" numeric(10,2) NOT NULL DEFAULT 0,
        "totalAmount" numeric(10,2) NOT NULL,
        "notes" text,
        "vehicleModel" character varying,
        "vehicleNumber" character varying,
        "createdBy" character varying,
        "createdByType" character varying NOT NULL DEFAULT 'staff',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_orders_orderNumber" UNIQUE ("orderNumber"),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_restaurantId" ON "orders" ("restaurantId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_customerId" ON "orders" ("customerId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_orderNumber" ON "orders" ("orderNumber")`);

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quantity" integer NOT NULL,
        "unitPrice" numeric(10,2) NOT NULL,
        "totalPrice" numeric(10,2) NOT NULL,
        "specialInstructions" text,
        "status" character varying NOT NULL DEFAULT 'pending',
        "estimatedPreparationTime" integer,
        "originalPreparationTime" integer,
        "tableNo" character varying,
        "startedAt" TIMESTAMP,
        "readyAt" TIMESTAMP,
        "servedAt" TIMESTAMP,
        "orderId" uuid NOT NULL,
        "menuId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_items_orderId" ON "order_items" ("orderId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_items_menuId" ON "order_items" ("menuId")`);

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_item_addons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quantity" integer NOT NULL DEFAULT 1,
        "unitPrice" numeric(10,2) NOT NULL,
        "totalPrice" numeric(10,2) NOT NULL,
        "orderItemId" uuid NOT NULL,
        "addonId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_item_addons" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_item_addons_orderItemId" ON "order_item_addons" ("orderItemId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_item_addons_addonId" ON "order_item_addons" ("addonId")`);

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "method" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "transactionId" character varying,
        "amountTendered" numeric(10,2),
        "changeReturned" numeric(10,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_orderId" ON "payments" ("orderId")`);

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "qr_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurantId" uuid NOT NULL,
        "code" character varying NOT NULL,
        "type" character varying NOT NULL,
        "tableNumber" character varying,
        "parkingSpot" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "status" character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_qr_codes_code" UNIQUE ("code"),
        CONSTRAINT "PK_qr_codes" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qr_codes_restaurantId" ON "qr_codes" ("restaurantId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qr_codes_code" ON "qr_codes" ("code")`);

        console.log('Initial schema created successfully');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order
        await queryRunner.query(`DROP TABLE IF EXISTS "qr_codes" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "payments" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "order_item_addons" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "order_items" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tables" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "menu_addons" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "addons" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "menus" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "categories" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "customers" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "subscription_plans" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "restaurants" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tenants" CASCADE`);

        await queryRunner.query(`DROP TYPE IF EXISTS "users_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
    }
}
