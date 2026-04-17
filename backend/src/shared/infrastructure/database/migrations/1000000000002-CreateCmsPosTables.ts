import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCmsPosTables1000000000002 implements MigrationInterface {
  name = 'CreateCmsPosTables1000000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── channels ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE channels (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        code              VARCHAR(30) NOT NULL,
        name              VARCHAR(100) NOT NULL,
        channel_type      VARCHAR(20) NOT NULL DEFAULT 'OTA',
        commission_rate   DECIMAL(5,2) NOT NULL DEFAULT 0,
        is_active         BOOLEAN NOT NULL DEFAULT true,
        api_credentials   JSONB,
        last_push_at      TIMESTAMPTZ,
        last_pull_at      TIMESTAMPTZ,
        sync_status       VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, code)
      )
    `);

    // ── rate_plans ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE rate_plans (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        room_type_id      UUID NOT NULL REFERENCES room_types(id),
        code              VARCHAR(20) NOT NULL,
        name              VARCHAR(100) NOT NULL,
        meal_plan         VARCHAR(5) NOT NULL DEFAULT 'RO',
        cancel_policy     VARCHAR(20) NOT NULL DEFAULT 'FLEXIBLE',
        min_stay          INT NOT NULL DEFAULT 1,
        max_stay          INT,
        advance_book_min  INT NOT NULL DEFAULT 0,
        advance_book_max  INT,
        is_refundable     BOOLEAN NOT NULL DEFAULT true,
        is_active         BOOLEAN NOT NULL DEFAULT true,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, code)
      )
    `);

    // ── rate_plan_rates ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE rate_plan_rates (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        rate_plan_id      UUID NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
        rate_date         DATE NOT NULL,
        rate_single       DECIMAL(15,2) NOT NULL DEFAULT 0,
        rate_double       DECIMAL(15,2) NOT NULL DEFAULT 0,
        rate_extra_adult  DECIMAL(15,2) NOT NULL DEFAULT 0,
        rate_extra_child  DECIMAL(15,2) NOT NULL DEFAULT 0,
        min_stay_override INT,
        stop_sell         BOOLEAN NOT NULL DEFAULT false,
        currency_code     VARCHAR(3) NOT NULL DEFAULT 'IDR',
        last_synced_at    TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(rate_plan_id, rate_date)
      )
    `);

    // ── availability_blocks ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE availability_blocks (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id              UUID NOT NULL REFERENCES hotels(id),
        room_type_id          UUID NOT NULL REFERENCES room_types(id),
        date                  DATE NOT NULL,
        total_rooms           INT NOT NULL DEFAULT 0,
        available_rooms       INT NOT NULL DEFAULT 0,
        booked_rooms          INT NOT NULL DEFAULT 0,
        ooo_rooms             INT NOT NULL DEFAULT 0,
        stop_sell             BOOLEAN NOT NULL DEFAULT false,
        closed_to_arrival     BOOLEAN NOT NULL DEFAULT false,
        closed_to_departure   BOOLEAN NOT NULL DEFAULT false,
        last_synced_at        TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, room_type_id, date)
      )
    `);

    // ── channel_room_mappings ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE channel_room_mappings (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id            UUID NOT NULL REFERENCES hotels(id),
        channel_id          UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        room_type_id        UUID NOT NULL REFERENCES room_types(id),
        rate_plan_id        UUID NOT NULL REFERENCES rate_plans(id),
        channel_room_code   VARCHAR(100),
        channel_rate_code   VARCHAR(100),
        markup_pct          DECIMAL(5,2) NOT NULL DEFAULT 0,
        is_active           BOOLEAN NOT NULL DEFAULT true,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── pos_outlets ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE pos_outlets (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id                UUID NOT NULL REFERENCES hotels(id),
        sub_department_id       UUID REFERENCES sub_departments(id),
        gl_revenue_account_id   UUID,
        code                    VARCHAR(20) NOT NULL,
        name                    VARCHAR(100) NOT NULL,
        outlet_type             VARCHAR(30) NOT NULL DEFAULT 'RESTAURANT',
        allow_route_to_room     BOOLEAN NOT NULL DEFAULT true,
        has_table_view          BOOLEAN NOT NULL DEFAULT false,
        is_active               BOOLEAN NOT NULL DEFAULT true,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, code)
      )
    `);

    // ── pos_tables ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE pos_tables (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        pos_outlet_id   UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
        table_number    VARCHAR(10) NOT NULL,
        capacity        INT NOT NULL DEFAULT 4,
        pos_x           DECIMAL(8,2),
        pos_y           DECIMAL(8,2),
        status          VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── pos_categories & pos_items ─────────────────────────
    await queryRunner.query(`
      CREATE TABLE pos_categories (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        pos_outlet_id   UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
        gl_account_id   UUID,
        name            VARCHAR(100) NOT NULL,
        code            VARCHAR(20) NOT NULL,
        sort_order      INT NOT NULL DEFAULT 0,
        is_active       BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE pos_items (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        pos_category_id   UUID NOT NULL REFERENCES pos_categories(id),
        sku               VARCHAR(50),
        name              VARCHAR(200) NOT NULL,
        description       TEXT,
        price             DECIMAL(15,2) NOT NULL DEFAULT 0,
        cost_price        DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_rate          DECIMAL(5,2)  NOT NULL DEFAULT 0,
        tax_code          VARCHAR(20),
        has_recipe        BOOLEAN NOT NULL DEFAULT false,
        is_available      BOOLEAN NOT NULL DEFAULT true,
        modifiers         JSONB,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── captain_orders ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE captain_orders (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        pos_outlet_id   UUID NOT NULL REFERENCES pos_outlets(id),
        pos_table_id    UUID REFERENCES pos_tables(id),
        guest_id        UUID REFERENCES guests(id),
        order_number    VARCHAR(30) NOT NULL UNIQUE,
        status          VARCHAR(30) NOT NULL DEFAULT 'OPEN',
        order_type      VARCHAR(20) NOT NULL DEFAULT 'DINE_IN',
        room_number     VARCHAR(10),
        covers          INT NOT NULL DEFAULT 1,
        served_by       UUID,
        created_by      UUID,
        ordered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── captain_order_items ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE captain_order_items (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        captain_order_id    UUID NOT NULL REFERENCES captain_orders(id) ON DELETE CASCADE,
        pos_item_id         UUID NOT NULL REFERENCES pos_items(id),
        item_name           VARCHAR(200) NOT NULL,
        unit_price          DECIMAL(15,2) NOT NULL,
        quantity            DECIMAL(10,3) NOT NULL DEFAULT 1,
        discount_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_rate            DECIMAL(5,2)  NOT NULL DEFAULT 0,
        line_total          DECIMAL(15,2) NOT NULL,
        kitchen_status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        notes               TEXT,
        modifiers_applied   JSONB,
        is_void             BOOLEAN NOT NULL DEFAULT false,
        sent_to_kitchen_at  TIMESTAMPTZ,
        served_at           TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── pos_transactions ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE pos_transactions (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        pos_outlet_id     UUID NOT NULL REFERENCES pos_outlets(id),
        captain_order_id  UUID REFERENCES captain_orders(id),
        guest_id          UUID REFERENCES guests(id),
        folio_id          UUID REFERENCES folios(id),
        company_id        UUID REFERENCES companies(id),
        transaction_no    VARCHAR(30) NOT NULL UNIQUE,
        status            VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        subtotal          DECIMAL(15,2) NOT NULL DEFAULT 0,
        discount_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_amount        DECIMAL(15,2) NOT NULL DEFAULT 0,
        service_charge    DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
        currency_code     VARCHAR(3)    NOT NULL DEFAULT 'IDR',
        exchange_rate     DECIMAL(15,6) NOT NULL DEFAULT 1,
        cashier_id        UUID,
        opened_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed_at         TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── pos_transaction_items ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE pos_transaction_items (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pos_transaction_id    UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
        pos_item_id           UUID NOT NULL REFERENCES pos_items(id),
        item_name             VARCHAR(200) NOT NULL,
        unit_price            DECIMAL(15,2) NOT NULL,
        quantity              DECIMAL(10,3) NOT NULL DEFAULT 1,
        discount_amount       DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_rate              DECIMAL(5,2)  NOT NULL DEFAULT 0,
        tax_amount            DECIMAL(15,2) NOT NULL DEFAULT 0,
        line_total            DECIMAL(15,2) NOT NULL,
        is_void               BOOLEAN NOT NULL DEFAULT false,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── pos_payments ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE pos_payments (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id              UUID NOT NULL REFERENCES hotels(id),
        pos_transaction_id    UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
        payment_method        VARCHAR(30) NOT NULL,
        amount                DECIMAL(15,2) NOT NULL,
        currency_code         VARCHAR(3)    NOT NULL DEFAULT 'IDR',
        exchange_rate         DECIMAL(15,6) NOT NULL DEFAULT 1,
        reference_number      VARCHAR(100),
        card_last_four        VARCHAR(4),
        card_brand            VARCHAR(30),
        status                VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
        gateway_response      JSONB,
        processed_by          UUID,
        processed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── indexes ────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX idx_availability_hotel_type_date ON availability_blocks(hotel_id, room_type_id, date)`);
    await queryRunner.query(`CREATE INDEX idx_pos_transactions_folio ON pos_transactions(folio_id) WHERE folio_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX idx_pos_transactions_outlet ON pos_transactions(pos_outlet_id)`);
    await queryRunner.query(`CREATE INDEX idx_captain_orders_outlet ON captain_orders(pos_outlet_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS pos_payments`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_transaction_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS captain_order_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS captain_orders`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_categories`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_tables`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_outlets`);
    await queryRunner.query(`DROP TABLE IF EXISTS channel_room_mappings`);
    await queryRunner.query(`DROP TABLE IF EXISTS availability_blocks`);
    await queryRunner.query(`DROP TABLE IF EXISTS rate_plan_rates`);
    await queryRunner.query(`DROP TABLE IF EXISTS rate_plans`);
    await queryRunner.query(`DROP TABLE IF EXISTS channels`);
  }
}
