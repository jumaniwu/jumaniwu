import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePmsTables1000000000001 implements MigrationInterface {
  name = 'CreatePmsTables1000000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── room_types ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE room_types (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id      UUID NOT NULL REFERENCES hotels(id),
        code          VARCHAR(20) NOT NULL,
        name          VARCHAR(100) NOT NULL,
        max_occupancy INT NOT NULL DEFAULT 2,
        base_adults   INT NOT NULL DEFAULT 2,
        bed_type      VARCHAR(20) NOT NULL DEFAULT 'DOUBLE',
        base_rate     DECIMAL(15,2) NOT NULL DEFAULT 0,
        amenities     JSONB,
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, code)
      )
    `);

    // ── rooms ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE hk_status_enum AS ENUM ('CLEAN','DIRTY','INSPECTED','OOO','OOS');
      CREATE TYPE occupancy_status_enum AS ENUM ('VACANT','OCCUPIED');

      CREATE TABLE rooms (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        room_type_id      UUID NOT NULL REFERENCES room_types(id),
        room_number       VARCHAR(10) NOT NULL,
        floor             INT,
        building          VARCHAR(50),
        pos_x             DECIMAL(8,2),
        pos_y             DECIMAL(8,2),
        hk_status         hk_status_enum NOT NULL DEFAULT 'CLEAN',
        occupancy_status  occupancy_status_enum NOT NULL DEFAULT 'VACANT',
        is_active         BOOLEAN NOT NULL DEFAULT true,
        last_cleaned_at   TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, room_number)
      )
    `);

    // ── guests ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE guests (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id      UUID NOT NULL REFERENCES hotels(id),
        title         VARCHAR(10),
        first_name    VARCHAR(100) NOT NULL,
        last_name     VARCHAR(100) NOT NULL,
        email         VARCHAR(200),
        phone         VARCHAR(30),
        date_of_birth DATE,
        nationality   VARCHAR(50),
        id_type       VARCHAR(20),
        id_number     VARCHAR(50),
        guest_type    VARCHAR(20) NOT NULL DEFAULT 'FIT',
        loyalty_tier  VARCHAR(20) NOT NULL DEFAULT 'NONE',
        loyalty_points INT NOT NULL DEFAULT 0,
        visit_count   INT NOT NULL DEFAULT 0,
        notes         TEXT,
        preferences   JSONB,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── reservations ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE reservation_status_enum AS ENUM (
        'TENTATIVE','CONFIRMED','WAITLIST','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW'
      );
      CREATE TYPE payment_status_enum AS ENUM (
        'PENDING','DEPOSIT_PAID','FULLY_PAID','REFUNDED'
      );

      CREATE TABLE reservations (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        guest_id          UUID NOT NULL REFERENCES guests(id),
        guest_group_id    UUID,
        channel_id        UUID,
        company_id        UUID REFERENCES companies(id),
        voucher_id        UUID,
        confirmation_no   VARCHAR(30) NOT NULL UNIQUE,
        ota_booking_ref   VARCHAR(100),
        status            reservation_status_enum NOT NULL DEFAULT 'TENTATIVE',
        arrival_date      DATE NOT NULL,
        departure_date    DATE NOT NULL,
        adults            INT NOT NULL DEFAULT 1,
        children          INT NOT NULL DEFAULT 0,
        source            VARCHAR(30) NOT NULL DEFAULT 'DIRECT',
        total_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
        deposit_paid      DECIMAL(15,2) NOT NULL DEFAULT 0,
        payment_status    payment_status_enum NOT NULL DEFAULT 'PENDING',
        special_requests  TEXT,
        cancel_reason     TEXT,
        cancelled_at      TIMESTAMPTZ,
        created_by        UUID,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── reservation_rooms ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE reservation_rooms (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id            UUID NOT NULL REFERENCES hotels(id),
        reservation_id      UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        room_id             UUID REFERENCES rooms(id),
        room_type_id        UUID NOT NULL REFERENCES room_types(id),
        rate_plan_id        UUID,
        package_id          UUID,
        check_in_date       DATE NOT NULL,
        check_out_date      DATE NOT NULL,
        adults              INT NOT NULL DEFAULT 1,
        children            INT NOT NULL DEFAULT 0,
        rate_per_night      DECIMAL(15,2) NOT NULL DEFAULT 0,
        meal_plan           VARCHAR(5) NOT NULL DEFAULT 'RO',
        breakfast_included  BOOLEAN NOT NULL DEFAULT false,
        status              VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
        actual_check_in_at  TIMESTAMPTZ,
        actual_check_out_at TIMESTAMPTZ,
        checked_in_by       UUID,
        checked_out_by      UUID,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── folios ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE folio_type_enum AS ENUM ('MASTER','DESK','CITY_LEDGER');
      CREATE TYPE folio_status_enum AS ENUM ('OPEN','CLOSED','SETTLED','TRANSFERRED');

      CREATE TABLE folios (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        reservation_id  UUID REFERENCES reservations(id),
        guest_id        UUID NOT NULL REFERENCES guests(id),
        company_id      UUID REFERENCES companies(id),
        parent_folio_id UUID,
        folio_number    VARCHAR(30) NOT NULL UNIQUE,
        folio_type      folio_type_enum NOT NULL DEFAULT 'MASTER',
        status          folio_status_enum NOT NULL DEFAULT 'OPEN',
        total_charges   DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_payments  DECIMAL(15,2) NOT NULL DEFAULT 0,
        balance         DECIMAL(15,2) NOT NULL DEFAULT 0,
        credit_limit    DECIMAL(15,2) NOT NULL DEFAULT 0,
        currency_code   VARCHAR(3) NOT NULL DEFAULT 'IDR',
        notes           TEXT,
        opened_by       UUID,
        opened_at       TIMESTAMPTZ,
        closed_by       UUID,
        closed_at       TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── folio_items ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE folio_item_type_enum AS ENUM (
        'ROOM_RATE','POS_CHARGE','BREAKFAST','TAX','SERVICE_CHARGE',
        'FEE','DISCOUNT','PAYMENT','DEPOSIT','ADJUSTMENT','TRANSFER'
      );

      CREATE TABLE folio_items (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id              UUID NOT NULL REFERENCES hotels(id),
        folio_id              UUID NOT NULL REFERENCES folios(id),
        pos_transaction_id    UUID,
        reservation_room_id   UUID REFERENCES reservation_rooms(id),
        captain_order_id      UUID,
        sub_department_id     UUID REFERENCES sub_departments(id),
        item_type             folio_item_type_enum NOT NULL,
        description           VARCHAR(300) NOT NULL,
        charge_date           DATE NOT NULL,
        unit_price            DECIMAL(15,2) NOT NULL DEFAULT 0,
        quantity              DECIMAL(10,3) NOT NULL DEFAULT 1,
        amount                DECIMAL(15,2) NOT NULL,
        tax_amount            DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_code              VARCHAR(20),
        currency_code         VARCHAR(3) NOT NULL DEFAULT 'IDR',
        exchange_rate         DECIMAL(15,6) NOT NULL DEFAULT 1,
        is_void               BOOLEAN NOT NULL DEFAULT false,
        voided_by             UUID,
        voided_at             TIMESTAMPTZ,
        void_reason           TEXT,
        created_by            UUID,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── night_audit_runs ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE night_audit_runs (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id            UUID NOT NULL REFERENCES hotels(id),
        audit_date          DATE NOT NULL,
        status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        rooms_processed     INT NOT NULL DEFAULT 0,
        folios_posted       INT NOT NULL DEFAULT 0,
        total_room_revenue  DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_fnb_revenue   DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_tax           DECIMAL(15,2) NOT NULL DEFAULT 0,
        notes               TEXT,
        run_by              UUID,
        started_at          TIMESTAMPTZ,
        completed_at        TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, audit_date)
      )
    `);

    // ── indexes ────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX idx_reservations_hotel_dates ON reservations(hotel_id, arrival_date, departure_date)`);
    await queryRunner.query(`CREATE INDEX idx_reservations_guest ON reservations(guest_id)`);
    await queryRunner.query(`CREATE INDEX idx_reservation_rooms_reservation ON reservation_rooms(reservation_id)`);
    await queryRunner.query(`CREATE INDEX idx_reservation_rooms_room ON reservation_rooms(room_id)`);
    await queryRunner.query(`CREATE INDEX idx_folios_reservation ON folios(reservation_id)`);
    await queryRunner.query(`CREATE INDEX idx_folio_items_folio ON folio_items(folio_id)`);
    await queryRunner.query(`CREATE INDEX idx_folio_items_pos_tx ON folio_items(pos_transaction_id) WHERE pos_transaction_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX idx_guests_hotel_email ON guests(hotel_id, email) WHERE email IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX idx_rooms_hotel_number ON rooms(hotel_id, room_number)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS night_audit_runs`);
    await queryRunner.query(`DROP TABLE IF EXISTS folio_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS folios`);
    await queryRunner.query(`DROP TABLE IF EXISTS reservation_rooms`);
    await queryRunner.query(`DROP TABLE IF EXISTS reservations`);
    await queryRunner.query(`DROP TABLE IF EXISTS guests`);
    await queryRunner.query(`DROP TABLE IF EXISTS rooms`);
    await queryRunner.query(`DROP TABLE IF EXISTS room_types`);
    await queryRunner.query(`DROP TYPE IF EXISTS folio_item_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS folio_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS folio_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS reservation_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS occupancy_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS hk_status_enum`);
  }
}
