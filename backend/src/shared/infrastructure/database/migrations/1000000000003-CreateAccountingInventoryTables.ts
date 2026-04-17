import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountingInventoryTables1000000000003 implements MigrationInterface {
  name = 'CreateAccountingInventoryTables1000000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ledger_accounts (Chart of Accounts, 4-level hierarchy) ──
    await queryRunner.query(`
      CREATE TYPE account_type_enum AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');

      CREATE TABLE ledger_accounts (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        parent_id         UUID REFERENCES ledger_accounts(id),
        sub_department_id UUID REFERENCES sub_departments(id),
        account_code      VARCHAR(20) NOT NULL,
        account_name      VARCHAR(200) NOT NULL,
        account_type      account_type_enum NOT NULL,
        account_subtype   VARCHAR(50),
        normal_balance    VARCHAR(10) NOT NULL DEFAULT 'DEBIT',
        is_posting_account BOOLEAN NOT NULL DEFAULT true,
        is_active         BOOLEAN NOT NULL DEFAULT true,
        sort_order        INT NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, account_code)
      )
    `);

    // ── accounting_periods ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE accounting_periods (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id    UUID NOT NULL REFERENCES hotels(id),
        year        INT NOT NULL,
        month       INT NOT NULL,
        start_date  DATE NOT NULL,
        end_date    DATE NOT NULL,
        status      VARCHAR(10) NOT NULL DEFAULT 'OPEN',
        locked_at   TIMESTAMPTZ,
        locked_by   UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, year, month)
      )
    `);

    // ── journal_entries ────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE journal_status_enum AS ENUM ('DRAFT','POSTED','REVERSED');

      CREATE TABLE journal_entries (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id              UUID NOT NULL REFERENCES hotels(id),
        accounting_period_id  UUID NOT NULL REFERENCES accounting_periods(id),
        entry_number          VARCHAR(30) NOT NULL UNIQUE,
        entry_date            DATE NOT NULL,
        description           VARCHAR(500) NOT NULL,
        source_module         VARCHAR(20) NOT NULL,
        source_event          VARCHAR(100),
        source_entity_id      UUID,
        status                journal_status_enum NOT NULL DEFAULT 'DRAFT',
        reversed_by_id        UUID REFERENCES journal_entries(id),
        total_debit           DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_credit          DECIMAL(15,2) NOT NULL DEFAULT 0,
        currency_code         VARCHAR(3) NOT NULL DEFAULT 'IDR',
        created_by            UUID,
        posted_at             TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── journal_entry_lines ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE journal_entry_lines (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        journal_entry_id  UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
        sub_department_id UUID REFERENCES sub_departments(id),
        entry_type        VARCHAR(10) NOT NULL,
        amount            DECIMAL(15,2) NOT NULL,
        currency_code     VARCHAR(3) NOT NULL DEFAULT 'IDR',
        exchange_rate     DECIMAL(15,6) NOT NULL DEFAULT 1,
        description       TEXT,
        line_number       INT NOT NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── journal_rules (Rule Engine) ────────────────────────
    await queryRunner.query(`
      CREATE TABLE journal_rules (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        source_event      VARCHAR(100) NOT NULL,
        line_number       INT NOT NULL,
        entry_type        VARCHAR(10) NOT NULL,
        ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
        amount_field      VARCHAR(100) NOT NULL,
        is_active         BOOLEAN NOT NULL DEFAULT true,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── city_ledger ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE city_ledger_accounts (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id            UUID NOT NULL REFERENCES hotels(id),
        company_id          UUID NOT NULL REFERENCES companies(id),
        account_number      VARCHAR(30) NOT NULL,
        credit_limit        DECIMAL(15,2) NOT NULL DEFAULT 0,
        balance             DECIMAL(15,2) NOT NULL DEFAULT 0,
        payment_terms_days  INT NOT NULL DEFAULT 30,
        status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE city_ledger_invoices (
        id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id                  UUID NOT NULL REFERENCES hotels(id),
        city_ledger_account_id    UUID NOT NULL REFERENCES city_ledger_accounts(id),
        folio_id                  UUID REFERENCES folios(id),
        invoice_number            VARCHAR(30) NOT NULL UNIQUE,
        invoice_date              DATE NOT NULL,
        due_date                  DATE NOT NULL,
        amount                    DECIMAL(15,2) NOT NULL,
        tax_amount                DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_amount              DECIMAL(15,2) NOT NULL,
        paid_amount               DECIMAL(15,2) NOT NULL DEFAULT 0,
        balance                   DECIMAL(15,2) NOT NULL,
        status                    VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── bank_accounts & bank_transactions ──────────────────
    await queryRunner.query(`
      CREATE TABLE bank_accounts (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
        bank_name         VARCHAR(100) NOT NULL,
        account_number    VARCHAR(50) NOT NULL,
        account_name      VARCHAR(200) NOT NULL,
        currency_code     VARCHAR(3) NOT NULL DEFAULT 'IDR',
        current_balance   DECIMAL(15,2) NOT NULL DEFAULT 0,
        is_active         BOOLEAN NOT NULL DEFAULT true,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE bank_transactions (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id            UUID NOT NULL REFERENCES hotels(id),
        bank_account_id     UUID NOT NULL REFERENCES bank_accounts(id),
        transaction_date    DATE NOT NULL,
        description         TEXT NOT NULL,
        debit_amount        DECIMAL(15,2) NOT NULL DEFAULT 0,
        credit_amount       DECIMAL(15,2) NOT NULL DEFAULT 0,
        running_balance     DECIMAL(15,2) NOT NULL DEFAULT 0,
        reference_number    VARCHAR(100),
        is_reconciled       BOOLEAN NOT NULL DEFAULT false,
        journal_entry_id    UUID REFERENCES journal_entries(id),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── forex_rates ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE forex_rates (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        from_currency   VARCHAR(3) NOT NULL,
        to_currency     VARCHAR(3) NOT NULL,
        buy_rate        DECIMAL(15,6) NOT NULL,
        sell_rate       DECIMAL(15,6) NOT NULL,
        middle_rate     DECIMAL(15,6) NOT NULL,
        effective_date  DATE NOT NULL,
        is_active       BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── inventory ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE stores (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        sub_department_id UUID REFERENCES sub_departments(id),
        code              VARCHAR(20) NOT NULL,
        name              VARCHAR(100) NOT NULL,
        store_type        VARCHAR(30) NOT NULL DEFAULT 'MAIN',
        is_active         BOOLEAN NOT NULL DEFAULT true,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, code)
      );

      CREATE TABLE inventory_items (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        item_code       VARCHAR(30) NOT NULL,
        name            VARCHAR(200) NOT NULL,
        item_group      VARCHAR(50),
        item_category   VARCHAR(50),
        uom_base        VARCHAR(20) NOT NULL,
        reorder_level   DECIMAL(12,3) NOT NULL DEFAULT 0,
        reorder_qty     DECIMAL(12,3) NOT NULL DEFAULT 0,
        last_price      DECIMAL(15,2) NOT NULL DEFAULT 0,
        average_price   DECIMAL(15,2) NOT NULL DEFAULT 0,
        is_active       BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, item_code)
      );

      CREATE TABLE purchase_orders (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        company_id      UUID NOT NULL REFERENCES companies(id),
        po_number       VARCHAR(30) NOT NULL UNIQUE,
        po_date         DATE NOT NULL,
        expected_date   DATE,
        status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
        currency_code   VARCHAR(3) NOT NULL DEFAULT 'IDR',
        requested_by    UUID,
        approved_by     UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE purchase_order_items (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
        qty_ordered       DECIMAL(12,3) NOT NULL,
        qty_received      DECIMAL(12,3) NOT NULL DEFAULT 0,
        uom_code          VARCHAR(20) NOT NULL,
        unit_price        DECIMAL(15,2) NOT NULL,
        line_total        DECIMAL(15,2) NOT NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE stock_receipts (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        purchase_order_id UUID REFERENCES purchase_orders(id),
        store_id          UUID NOT NULL REFERENCES stores(id),
        receipt_number    VARCHAR(30) NOT NULL UNIQUE,
        receipt_date      DATE NOT NULL,
        status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        total_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
        journal_entry_id  UUID REFERENCES journal_entries(id),
        received_by       UUID,
        posted_at         TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE stock_receipt_items (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stock_receipt_id  UUID NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
        inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
        quantity          DECIMAL(12,3) NOT NULL,
        uom_code          VARCHAR(20) NOT NULL,
        unit_price        DECIMAL(15,2) NOT NULL,
        line_total        DECIMAL(15,2) NOT NULL,
        expiry_date       DATE,
        batch_number      VARCHAR(50),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── pos_recipes (F&B Cost Control — links POS to Inventory) ──
    await queryRunner.query(`
      CREATE TABLE pos_recipes (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        pos_item_id     UUID NOT NULL REFERENCES pos_items(id) UNIQUE,
        name            VARCHAR(200) NOT NULL,
        yield_quantity  DECIMAL(10,3) NOT NULL DEFAULT 1,
        yield_uom       VARCHAR(20) NOT NULL DEFAULT 'portion',
        total_cost      DECIMAL(15,2) NOT NULL DEFAULT 0,
        last_updated_at TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE pos_recipe_items (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pos_recipe_id     UUID NOT NULL REFERENCES pos_recipes(id) ON DELETE CASCADE,
        inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
        quantity          DECIMAL(12,3) NOT NULL,
        uom_code          VARCHAR(20) NOT NULL,
        unit_cost         DECIMAL(15,2) NOT NULL DEFAULT 0,
        line_cost         DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── fixed_assets ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE fixed_assets (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id                    UUID NOT NULL REFERENCES hotels(id),
        ledger_account_id           UUID REFERENCES ledger_accounts(id),
        sub_department_id           UUID REFERENCES sub_departments(id),
        asset_code                  VARCHAR(30) NOT NULL,
        name                        VARCHAR(200) NOT NULL,
        category                    VARCHAR(30) NOT NULL DEFAULT 'EQUIPMENT',
        acquisition_date            DATE NOT NULL,
        acquisition_cost            DECIMAL(15,2) NOT NULL,
        salvage_value               DECIMAL(15,2) NOT NULL DEFAULT 0,
        useful_life_months          INT NOT NULL DEFAULT 60,
        depreciation_method         VARCHAR(20) NOT NULL DEFAULT 'STRAIGHT_LINE',
        accumulated_depreciation    DECIMAL(15,2) NOT NULL DEFAULT 0,
        book_value                  DECIMAL(15,2) NOT NULL DEFAULT 0,
        location                    VARCHAR(100),
        status                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, asset_code)
      )
    `);

    // ── budgets ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE budgets (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        sub_department_id UUID REFERENCES sub_departments(id),
        ledger_account_id UUID REFERENCES ledger_accounts(id),
        year              INT NOT NULL,
        month             INT NOT NULL,
        budget_type       VARCHAR(10) NOT NULL DEFAULT 'INCOME',
        budgeted_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
        actual_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
        variance          DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── indexes ────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX idx_journal_entries_hotel_date ON journal_entries(hotel_id, entry_date)`);
    await queryRunner.query(`CREATE INDEX idx_journal_entries_source ON journal_entries(source_entity_id) WHERE source_entity_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id)`);
    await queryRunner.query(`CREATE INDEX idx_journal_entry_lines_account ON journal_entry_lines(ledger_account_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS budgets`);
    await queryRunner.query(`DROP TABLE IF EXISTS fixed_assets`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_recipe_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_recipes`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_receipt_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_receipts`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_order_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_orders`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS stores`);
    await queryRunner.query(`DROP TABLE IF EXISTS forex_rates`);
    await queryRunner.query(`DROP TABLE IF EXISTS bank_transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS bank_accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS city_ledger_invoices`);
    await queryRunner.query(`DROP TABLE IF EXISTS city_ledger_accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS journal_rules`);
    await queryRunner.query(`DROP TABLE IF EXISTS journal_entry_lines`);
    await queryRunner.query(`DROP TABLE IF EXISTS journal_entries`);
    await queryRunner.query(`DROP TABLE IF EXISTS accounting_periods`);
    await queryRunner.query(`DROP TABLE IF EXISTS ledger_accounts`);
    await queryRunner.query(`DROP TYPE IF EXISTS journal_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS account_type_enum`);
  }
}
