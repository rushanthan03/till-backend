import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelRoomsFeature1754000000000 implements MigrationInterface {
  name = 'AddHotelRoomsFeature1754000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Create room_type enum ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "public"."rooms_roomtype_enum" AS ENUM(
        'STANDARD', 'DELUXE', 'SUITE', 'PENTHOUSE', 'VILLA'
      )
    `);

    // ── 2. Create room_status enum ───────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "public"."rooms_status_enum" AS ENUM(
        'AVAILABLE', 'OCCUPIED', 'HOUSEKEEPING', 'DO_NOT_DISTURB', 'MAINTENANCE'
      )
    `);

    // ── 3. Create rooms table ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id"             uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "name"           character varying NOT NULL,
        "roomNumber"     character varying NOT NULL,
        "floor"          integer           NOT NULL DEFAULT 1,
        "roomType"       "public"."rooms_roomtype_enum" NOT NULL DEFAULT 'STANDARD',
        "capacity"       integer           NOT NULL DEFAULT 2,
        "status"         "public"."rooms_status_enum"  NOT NULL DEFAULT 'AVAILABLE',
        "guestName"      character varying,
        "checkInAt"      TIMESTAMP WITH TIME ZONE,
        "checkOutAt"     TIMESTAMP WITH TIME ZONE,
        "restaurantId"   uuid              NOT NULL,
        "createdAt"      TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rooms_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rooms_restaurant_roomNumber" UNIQUE ("restaurantId", "roomNumber")
      )
    `);

    // ── 4. Add FK: rooms -> restaurants ─────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "rooms"
        ADD CONSTRAINT "FK_rooms_restaurant"
        FOREIGN KEY ("restaurantId")
        REFERENCES "restaurants"("id")
        ON DELETE CASCADE
    `);

    // ── 5. Index on restaurantId for fast queries ────────────────────
    await queryRunner.query(`
      CREATE INDEX "IDX_rooms_restaurantId" ON "rooms" ("restaurantId")
    `);

    // ── 6. Add order_source enum to orders table ─────────────────────
    await queryRunner.query(`
      CREATE TYPE "public"."orders_ordersource_enum" AS ENUM(
        'TABLE', 'ROOM', 'TAKEAWAY', 'PARKING'
      )
    `);

    // ── 7. Add roomId column to orders ───────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "roomId" uuid,
        ADD COLUMN "orderSource" "public"."orders_ordersource_enum"
    `);

    // ── 8. Add FK: orders.roomId -> rooms.id ────────────────────────
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "FK_orders_room"
        FOREIGN KEY ("roomId")
        REFERENCES "rooms"("id")
        ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_room"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "orderSource"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "roomId"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."orders_ordersource_enum"`);
    await queryRunner.query(`DROP INDEX "IDX_rooms_restaurantId"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_restaurant"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."rooms_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."rooms_roomtype_enum"`);
  }
}
