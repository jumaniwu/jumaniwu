import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockMovements1000000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE stock_movements (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
        store_id          UUID NOT NULL REFERENCES stores(id),
        movement_type     VARCHAR(20) NOT NULL,
        quantity          DECIMAL(12,3) NOT NULL,
        unit_cost         DECIMAL(15,2) NOT NULL DEFAULT 0,
        reference_number  VARCHAR(50),
        notes             TEXT,
        created_by        UUID,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_stock_movements_item ON stock_movements(inventory_item_id)`);
    await queryRunner.query(`CREATE INDEX idx_stock_movements_store ON stock_movements(store_id)`);
    await queryRunner.query(`CREATE INDEX idx_stock_movements_hotel_date ON stock_movements(hotel_id, created_at)`);

    // ── store_requisitions ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE store_requisitions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        from_store_id   UUID NOT NULL REFERENCES stores(id),
        to_store_id     UUID NOT NULL REFERENCES stores(id),
        req_number      VARCHAR(30) NOT NULL UNIQUE,
        req_date        DATE NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        requested_by    UUID,
        approved_by     UUID,
        issued_by       UUID,
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE store_requisition_items (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_requisition_id  UUID NOT NULL REFERENCES store_requisitions(id) ON DELETE CASCADE,
        inventory_item_id     UUID NOT NULL REFERENCES inventory_items(id),
        qty_requested         DECIMAL(12,3) NOT NULL,
        qty_issued            DECIMAL(12,3) NOT NULL DEFAULT 0,
        uom_code              VARCHAR(20) NOT NULL,
        unit_cost             DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── stock_opnames (physical count) ────────────────────
    await queryRunner.query(`
      CREATE TABLE stock_opnames (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        store_id        UUID NOT NULL REFERENCES stores(id),
        opname_number   VARCHAR(30) NOT NULL UNIQUE,
        opname_date     DATE NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        counted_by      UUID,
        approved_by     UUID,
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE stock_opname_items (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stock_opname_id   UUID NOT NULL REFERENCES stock_opnames(id) ON DELETE CASCADE,
        inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
        book_qty          DECIMAL(12,3) NOT NULL DEFAULT 0,
        actual_qty        DECIMAL(12,3) NOT NULL DEFAULT 0,
        variance_qty      DECIMAL(12,3) GENERATED ALWAYS AS (actual_qty - book_qty) STORED,
        unit_cost         DECIMAL(15,2) NOT NULL DEFAULT 0,
        variance_value    DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── users (auth) ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id      UUID NOT NULL REFERENCES hotels(id),
        email         VARCHAR(200) NOT NULL,
        password_hash VARCHAR(200) NOT NULL,
        full_name     VARCHAR(200) NOT NULL,
        role          VARCHAR(30) NOT NULL DEFAULT 'STAFF',
        is_active     BOOLEAN NOT NULL DEFAULT true,
        last_login_at TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, email)
      )
    `);

    // Seed demo admin user (password: Admin@1234)
    // Hash pre-computed with bcrypt cost 12
    await queryRunner.query(`
      INSERT INTO users (id, hotel_id, email, password_hash, full_name, role, is_active)
      VALUES (
        '00000000-0000-0000-0001-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'admin@alava.dev',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgQG4yxzV8XzOdS/K0hBhW',
        'Hotel Admin',
        'HOTEL_ADMIN',
        true
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_opname_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_opnames`);
    await queryRunner.query(`DROP TABLE IF EXISTS store_requisition_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS store_requisitions`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_movements`);
  }
}
