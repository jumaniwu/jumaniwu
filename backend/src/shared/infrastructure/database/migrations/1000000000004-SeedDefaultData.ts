import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds default Chart of Accounts and journal rules for an Indonesian hotel.
 * Uses a fixed demo hotel ID. Production hotels are set up via the admin wizard.
 */
export class SeedDefaultData1000000000004 implements MigrationInterface {
  name = 'SeedDefaultData1000000000004';

  private readonly HOTEL = '00000000-0000-0000-0000-000000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Demo hotel ──────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO hotels (id, name, slug, city, country_code, timezone, currency_code)
      VALUES ('${this.HOTEL}', 'Alava Demo Hotel', 'alava-demo', 'Jakarta', 'IDN', 'Asia/Jakarta', 'IDR')
      ON CONFLICT (id) DO NOTHING
    `);

    // ── 2. Chart of Accounts ───────────────────────────────
    // Level 1 — Account Groups (non-posting)
    await queryRunner.query(`
      INSERT INTO ledger_accounts
        (id, hotel_id, account_code, account_name, account_type, level, is_posting_account, is_active, sort_order)
      VALUES
        ('1000-0000-0000-0000-000000000001', '${this.HOTEL}', '1000', 'Assets',        'ASSET',     1, false, true, 10),
        ('2000-0000-0000-0000-000000000001', '${this.HOTEL}', '2000', 'Liabilities',   'LIABILITY', 1, false, true, 20),
        ('3000-0000-0000-0000-000000000001', '${this.HOTEL}', '3000', 'Equity',        'EQUITY',    1, false, true, 30),
        ('4000-0000-0000-0000-000000000001', '${this.HOTEL}', '4000', 'Revenue',       'REVENUE',   1, false, true, 40),
        ('5000-0000-0000-0000-000000000001', '${this.HOTEL}', '5000', 'Expenses',      'EXPENSE',   1, false, true, 50)
      ON CONFLICT DO NOTHING
    `);

    // Level 2 — Sub-Groups
    await queryRunner.query(`
      INSERT INTO ledger_accounts
        (id, hotel_id, parent_id, account_code, account_name, account_type, level, is_posting_account, is_active, sort_order)
      VALUES
        ('1100-0000-0000-0000-000000000001', '${this.HOTEL}', '1000-0000-0000-0000-000000000001', '1100', 'Current Assets',     'ASSET',     2, false, true, 11),
        ('1200-0000-0000-0000-000000000001', '${this.HOTEL}', '1000-0000-0000-0000-000000000001', '1200', 'Fixed Assets',       'ASSET',     2, false, true, 12),
        ('2100-0000-0000-0000-000000000001', '${this.HOTEL}', '2000-0000-0000-0000-000000000001', '2100', 'Current Liabilities','LIABILITY', 2, false, true, 21),
        ('4100-0000-0000-0000-000000000001', '${this.HOTEL}', '4000-0000-0000-0000-000000000001', '4100', 'Rooms Revenue',      'REVENUE',   2, false, true, 41),
        ('4200-0000-0000-0000-000000000001', '${this.HOTEL}', '4000-0000-0000-0000-000000000001', '4200', 'F&B Revenue',        'REVENUE',   2, false, true, 42),
        ('5100-0000-0000-0000-000000000001', '${this.HOTEL}', '5000-0000-0000-0000-000000000001', '5100', 'Cost of Sales',      'EXPENSE',   2, false, true, 51),
        ('5200-0000-0000-0000-000000000001', '${this.HOTEL}', '5000-0000-0000-0000-000000000001', '5200', 'Operating Expenses', 'EXPENSE',   2, false, true, 52)
      ON CONFLICT DO NOTHING
    `);

    // Level 3 — Categories
    await queryRunner.query(`
      INSERT INTO ledger_accounts
        (id, hotel_id, parent_id, account_code, account_name, account_type, level, is_posting_account, is_active, sort_order)
      VALUES
        ('1110-0000-0000-0000-000000000001', '${this.HOTEL}', '1100-0000-0000-0000-000000000001', '1110', 'Cash & Bank',              'ASSET',     3, false, true, 111),
        ('1120-0000-0000-0000-000000000001', '${this.HOTEL}', '1100-0000-0000-0000-000000000001', '1120', 'Accounts Receivable',      'ASSET',     3, false, true, 112),
        ('2110-0000-0000-0000-000000000001', '${this.HOTEL}', '2100-0000-0000-0000-000000000001', '2110', 'Tax Payable',              'LIABILITY', 3, false, true, 211),
        ('2120-0000-0000-0000-000000000001', '${this.HOTEL}', '2100-0000-0000-0000-000000000001', '2120', 'Guest Advances & Deposits','LIABILITY', 3, true,  true, 212)
      ON CONFLICT DO NOTHING
    `);

    // Level 4 — Posting Accounts (actual ledger entries go here)
    await queryRunner.query(`
      INSERT INTO ledger_accounts
        (id, hotel_id, parent_id, account_code, account_name, account_type, level, is_posting_account, normal_balance, is_active, sort_order)
      VALUES
        -- Cash & AR
        ('1111-0000-0000-0000-000000000001', '${this.HOTEL}', '1110-0000-0000-0000-000000000001', '1111', 'Cash on Hand',           'ASSET',     4, true, 'DEBIT',  true, 1111),
        ('1112-0000-0000-0000-000000000001', '${this.HOTEL}', '1110-0000-0000-0000-000000000001', '1112', 'Bank BCA',               'ASSET',     4, true, 'DEBIT',  true, 1112),
        ('1121-0000-0000-0000-000000000001', '${this.HOTEL}', '1120-0000-0000-0000-000000000001', '1121', 'Guest Ledger / Folio AR','ASSET',     4, true, 'DEBIT',  true, 1121),
        ('1122-0000-0000-0000-000000000001', '${this.HOTEL}', '1120-0000-0000-0000-000000000001', '1122', 'City Ledger AR',         'ASSET',     4, true, 'DEBIT',  true, 1122),
        -- Tax Payable
        ('2111-0000-0000-0000-000000000001', '${this.HOTEL}', '2110-0000-0000-0000-000000000001', '2111', 'VAT Output (11%)',       'LIABILITY', 4, true, 'CREDIT', true, 2111),
        -- Revenue — Rooms
        ('4110-0000-0000-0000-000000000001', '${this.HOTEL}', '4100-0000-0000-0000-000000000001', '4110', 'Room Rate Revenue',      'REVENUE',   4, true, 'CREDIT', true, 4110),
        ('4120-0000-0000-0000-000000000001', '${this.HOTEL}', '4100-0000-0000-0000-000000000001', '4120', 'Service Charge — Rooms', 'REVENUE',   4, true, 'CREDIT', true, 4120),
        -- Revenue — F&B
        ('4210-0000-0000-0000-000000000001', '${this.HOTEL}', '4200-0000-0000-0000-000000000001', '4210', 'Restaurant Revenue',     'REVENUE',   4, true, 'CREDIT', true, 4210),
        ('4220-0000-0000-0000-000000000001', '${this.HOTEL}', '4200-0000-0000-0000-000000000001', '4220', 'Bar & Beverage Revenue', 'REVENUE',   4, true, 'CREDIT', true, 4220),
        ('4230-0000-0000-0000-000000000001', '${this.HOTEL}', '4200-0000-0000-0000-000000000001', '4230', 'Room Service Revenue',   'REVENUE',   4, true, 'CREDIT', true, 4230),
        ('4240-0000-0000-0000-000000000001', '${this.HOTEL}', '4200-0000-0000-0000-000000000001', '4240', 'Service Charge — F&B',  'REVENUE',   4, true, 'CREDIT', true, 4240),
        -- Expenses
        ('5110-0000-0000-0000-000000000001', '${this.HOTEL}', '5100-0000-0000-0000-000000000001', '5110', 'F&B Cost of Goods',      'EXPENSE',   4, true, 'DEBIT',  true, 5110),
        ('5210-0000-0000-0000-000000000001', '${this.HOTEL}', '5200-0000-0000-0000-000000000001', '5210', 'Salaries & Wages',       'EXPENSE',   4, true, 'DEBIT',  true, 5210),
        ('5220-0000-0000-0000-000000000001', '${this.HOTEL}', '5200-0000-0000-0000-000000000001', '5220', 'Utilities',              'EXPENSE',   4, true, 'DEBIT',  true, 5220),
        ('5230-0000-0000-0000-000000000001', '${this.HOTEL}', '5200-0000-0000-0000-000000000001', '5230', 'Depreciation',           'EXPENSE',   4, true, 'DEBIT',  true, 5230),
        -- Tax shadow accounts (used by journal rule engine for tax lines)
        ('T110-0000-0000-0000-000000000001', '${this.HOTEL}', '2110-0000-0000-0000-000000000001', 'TAX_4110', 'Tax Payable — Room Rate',    'LIABILITY', 4, true, 'CREDIT', true, 9110),
        ('T210-0000-0000-0000-000000000001', '${this.HOTEL}', '2110-0000-0000-0000-000000000001', 'TAX_4210', 'Tax Payable — Restaurant',   'LIABILITY', 4, true, 'CREDIT', true, 9210),
        ('T230-0000-0000-0000-000000000001', '${this.HOTEL}', '2110-0000-0000-0000-000000000001', 'TAX_4230', 'Tax Payable — Room Service', 'LIABILITY', 4, true, 'CREDIT', true, 9230)
      ON CONFLICT DO NOTHING
    `);

    // ── 3. Default Journal Rules ───────────────────────────
    await queryRunner.query(`
      INSERT INTO journal_rules (hotel_id, event_name, description, debit_account_code, credit_account_code, priority)
      VALUES
        -- Night Audit room rate post → DR Guest Ledger AR  CR Room Rate Revenue
        ('${this.HOTEL}', 'pms.night_audit.room_charge', 'Room Rate Night Audit Post', '1121', '4110', 1),
        -- POS charge routed to room → DR Guest Ledger AR  CR Restaurant Revenue
        ('${this.HOTEL}', 'pos.charge.posted_to_room',   'POS Route to Room Charge',   '1121', '4210', 1),
        -- POS transaction closed (cash payment) → DR Cash on Hand  CR Restaurant Revenue
        ('${this.HOTEL}', 'pos.transaction.closed',      'POS Direct Cash Sale',       '1111', '4210', 1),
        -- Generic folio charge → DR Guest Ledger AR  CR Room Rate Revenue (default)
        ('${this.HOTEL}', 'pms.folio.charge_posted',     'Folio Charge Auto-Post',     '1121', '4110', 1)
      ON CONFLICT DO NOTHING
    `);

    // ── 4. Open accounting period (Jan 2025) ───────────────
    await queryRunner.query(`
      INSERT INTO accounting_periods (hotel_id, year, month, start_date, end_date, status)
      VALUES ('${this.HOTEL}', 2025, 1, '2025-01-01', '2025-01-31', 'OPEN')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM journal_rules     WHERE hotel_id = '${this.HOTEL}'`);
    await queryRunner.query(`DELETE FROM accounting_periods WHERE hotel_id = '${this.HOTEL}'`);
    await queryRunner.query(`DELETE FROM ledger_accounts   WHERE hotel_id = '${this.HOTEL}'`);
    await queryRunner.query(`DELETE FROM hotels            WHERE id       = '${this.HOTEL}'`);
  }
}
