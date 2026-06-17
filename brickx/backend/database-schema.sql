-- ════════════════════════════════════════════════════════════════
-- BRICKX PROTOCOL — DATABASE SCHEMA v3.0
-- Two-Phase Model: BRX ICO Ecosystem → Hotel Annual Dividend
-- PostgreSQL / Supabase
-- Run: Supabase SQL Editor → paste all → Run
-- ════════════════════════════════════════════════════════════════

-- ── USERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  country          TEXT DEFAULT '',
  phone            TEXT DEFAULT '',
  wallet_address   TEXT DEFAULT '',           -- Polygon wallet for BRX airdrop + BRICK dividends
  -- kyc_status: 'in_progress' = Sumsub session started; 'pending' = awaiting manual review
  kyc_status       TEXT DEFAULT 'not_started' CHECK (kyc_status IN ('not_started','in_progress','pending','approved','rejected')),
  kyc_applicant_id TEXT DEFAULT '',           -- Sumsub applicant ID
  referral_code    TEXT UNIQUE,               -- User's own referral code
  referred_by      UUID REFERENCES users(id), -- Who referred this user
  email_verified   BOOLEAN NOT NULL DEFAULT FALSE, -- set true after OTP confirmed
  otp_code_hash    TEXT,                       -- sha256 of the 6-digit OTP
  otp_expires_at   TIMESTAMPTZ,
  otp_attempts     INTEGER NOT NULL DEFAULT 0,
  otp_last_sent_at TIMESTAMPTZ,
  is_active        BOOLEAN DEFAULT TRUE,
  is_admin         BOOLEAN DEFAULT FALSE,
  last_login       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── ICO ORDERS (PHASE 1 — BRX) ───────────────────────────────
CREATE TABLE IF NOT EXISTS ico_orders (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id         TEXT UNIQUE NOT NULL,       -- Human-readable: ORD-1234567890
  user_id          UUID REFERENCES users(id) NOT NULL,
  usd_amount       NUMERIC(12,2) NOT NULL CHECK (usd_amount > 0),     -- USD equivalent paid
  brx_allocated    BIGINT NOT NULL CHECK (brx_allocated > 0),         -- BRX tokens allocated
  price_per_brx    NUMERIC(8,6) NOT NULL,      -- 0.008000 for seed
  -- 'dex' is the post-ICO listing price tier, not an order round — orders only exist for seed/round1/round2
  round            TEXT NOT NULL DEFAULT 'seed' CHECK (round IN ('seed','round1','round2')),
  crypto_currency  TEXT NOT NULL,              -- USDT/Polygon, USDC/Polygon, ETH, BNB
  pay_to_address   TEXT NOT NULL,              -- Treasury wallet address
  wallet_address   TEXT NOT NULL,              -- Investor's Polygon wallet (receives BRX at TGE)
  tx_hash          TEXT DEFAULT '',            -- Blockchain transaction hash
  status           TEXT DEFAULT 'pending_payment'
                   CHECK (status IN ('pending_payment','confirmed','distributed','refunded','cancelled')),
  confirmed_at     TIMESTAMPTZ,
  distributed_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── REFERRAL BONUSES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_bonuses (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id  UUID REFERENCES users(id) NOT NULL,
  referred_id  UUID REFERENCES users(id) NOT NULL,
  bonus_brx    INTEGER DEFAULT 500,           -- 500 BRX per referral
  status       TEXT DEFAULT 'pending'
               CHECK (status IN ('pending','activated','distributed')),
  activated_at TIMESTAMPTZ,                   -- When referred user makes first purchase
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROPERTIES (PHASE 2 — BRICK HOTEL TOKENS) ────────────────
CREATE TABLE IF NOT EXISTS properties (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,      -- "Project Hotel Batam" until acquisition closes
  display_name     TEXT DEFAULT 'Project Hotel Batam (Confidential)',
  location         TEXT DEFAULT 'Batam Island, Indonesia',
  property_type    TEXT DEFAULT 'Hotel',      -- Hotel, Residential, Commercial
  star_rating      INTEGER DEFAULT 4,
  total_rooms      INTEGER,
  token_price_usd  NUMERIC(10,2) DEFAULT 10.00, -- Fixed $10.00 — never changes
  total_tokens     INTEGER,                   -- = acquisition_cost_usd / 10
  tokens_sold      INTEGER DEFAULT 0,
  acquisition_cost_usd NUMERIC(15,2),         -- Up to $18,500,000
  annual_yield_pct NUMERIC(5,2),              -- Estimated APY %
  noi_margin_pct   NUMERIC(5,2) DEFAULT 55.0, -- Net Operating Income margin %
  holders_share_pct NUMERIC(5,2) DEFAULT 70.0,-- % NOI to holders (always 70%)
  status           TEXT DEFAULT 'upcoming'
                   CHECK (status IN ('upcoming','fundraising','live','closed')),
  spv_entity       TEXT,                      -- Legal entity holding hotel
  confidential     BOOLEAN DEFAULT TRUE,       -- True until acquisition closes
  fiscal_year_end  TEXT DEFAULT 'December 31',
  dividend_month   TEXT DEFAULT 'June',
  description      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── TOKEN HOLDINGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_holdings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES users(id) NOT NULL,
  property_id UUID REFERENCES properties(id) NOT NULL,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0), -- Number of BRICK tokens held
  cost_basis  NUMERIC(10,2) DEFAULT 10.00,    -- Always $10.00 fixed
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, property_id)
);

-- ── MARKET LISTINGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_listings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id        UUID REFERENCES users(id) NOT NULL,
  property_id      UUID REFERENCES properties(id) NOT NULL,
  token_amount     INTEGER NOT NULL CHECK (token_amount > 0),
  price_per_token  NUMERIC(10,2) DEFAULT 10.00 CHECK (price_per_token = 10.00), -- ENFORCED fixed price
  total_value      NUMERIC(12,2) GENERATED ALWAYS AS (token_amount * price_per_token) STORED,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  buyer_id         UUID REFERENCES users(id),
  sold_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── ANNUAL YIELD DISTRIBUTIONS (PHASE 2) ─────────────────────
CREATE TABLE IF NOT EXISTS yield_distributions (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id              UUID REFERENCES properties(id) NOT NULL,
  fiscal_year              INTEGER NOT NULL,           -- e.g., 2027 (for June 2028 payment)
  gross_revenue_usd        NUMERIC(15,2),              -- Total hotel gross revenue
  noi_usd                  NUMERIC(15,2),              -- Net Operating Income (audited)
  holders_pool_usdc        NUMERIC(15,2),              -- 70% NOI → holders pool
  protocol_share_usdc      NUMERIC(15,2),              -- 30% NOI → protocol
  per_token_usdc           NUMERIC(10,6),              -- USDC per BRICK token
  apy_percent              NUMERIC(5,2),               -- Effective APY %
  tokens_in_circulation    INTEGER,                    -- Snapshot of tokens at Dec 31
  fiscal_close_date        DATE,                       -- December 31 each year
  audit_completed_date     DATE,                       -- When audit finished
  announcement_date        DATE,                       -- April (when dividend per token announced)
  payment_date             DATE,                       -- June 1 each year
  status                   TEXT DEFAULT 'scheduled'
                           CHECK (status IN ('scheduled','announced','paid','cancelled')),
  auditor_name             TEXT,                       -- Name of independent auditor
  audit_report_url         TEXT,                       -- Link to public audit report
  distribution_tx_hash     TEXT,                       -- Blockchain tx for USDC transfer
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (property_id, fiscal_year)
);

-- ── DIVIDEND RECEIPTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dividend_receipts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES users(id) NOT NULL,
  property_id     UUID REFERENCES properties(id) NOT NULL,
  distribution_id UUID REFERENCES yield_distributions(id) NOT NULL,
  fiscal_year     INTEGER NOT NULL,
  tokens_held     INTEGER NOT NULL,           -- Tokens held at snapshot date
  usdc_amount     NUMERIC(12,6) NOT NULL CHECK (usdc_amount >= 0), -- USDC received
  wallet_address  TEXT NOT NULL,              -- Wallet that received payment
  tx_hash         TEXT,                       -- On-chain tx hash
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ANNUAL SNAPSHOTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annual_snapshots (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date   DATE NOT NULL,              -- December 31 each year
  property_id     UUID REFERENCES properties(id) NOT NULL,
  user_id         UUID REFERENCES users(id) NOT NULL,
  tokens_held     INTEGER NOT NULL,           -- Balance at snapshot
  wallet_address  TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (snapshot_date, property_id, user_id)
);

-- ── ICO SETTINGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ico_settings (
  id                          INTEGER PRIMARY KEY DEFAULT 1,
  -- Phase 1: BRX ICO
  active_round                TEXT DEFAULT 'seed',
  sale_status                 TEXT NOT NULL DEFAULT 'upcoming'
                              CHECK (sale_status IN ('upcoming','live','paused')),
  sale_starts_at              TIMESTAMPTZ,
  seed_price_usd              NUMERIC(8,6) DEFAULT 0.008000,
  round1_price_usd            NUMERIC(8,6) DEFAULT 0.015000,
  round2_price_usd            NUMERIC(8,6) DEFAULT 0.022000,
  dex_target_price_usd        NUMERIC(8,6) DEFAULT 0.030000,
  seed_hard_cap_usd           INTEGER DEFAULT 640000,
  round1_hard_cap_usd         INTEGER NOT NULL DEFAULT 1500000,
  round2_hard_cap_usd         INTEGER NOT NULL DEFAULT 1100000,
  ico_total_target_usd        INTEGER DEFAULT 2000000,
  min_investment_usd          INTEGER DEFAULT 100,
  max_investment_usd          INTEGER DEFAULT 50000,
  referral_bonus_brx          INTEGER DEFAULT 500,
  kyc_required                BOOLEAN DEFAULT TRUE,
  tge_date                    DATE,
  last_scanned_block          BIGINT DEFAULT 0,     -- Payment monitor cursor (Polygon block height)
  -- Treasury wallets
  treasury_usdt_polygon       TEXT DEFAULT '',
  treasury_usdc_polygon       TEXT DEFAULT '',
  treasury_eth                TEXT DEFAULT '',
  treasury_bnb                TEXT DEFAULT '',
  -- Contract addresses (set after deployment)
  brx_token_address           TEXT DEFAULT '',
  brick_token_address         TEXT DEFAULT '',
  ico_vault_address           TEXT DEFAULT '',
  yield_distributor_address   TEXT DEFAULT '',
  -- Phase 2: Hotel
  hotel_budget_max_usd        NUMERIC(15,2) DEFAULT 18500000.00,
  brick_token_price_usd       NUMERIC(10,2) DEFAULT 10.00,
  noi_holders_share_pct       NUMERIC(5,2) DEFAULT 70.00,
  platform_fee_rate           NUMERIC(5,4) DEFAULT 0.0050,
  -- Dividend settings
  fiscal_year_end_month       INTEGER DEFAULT 12,   -- December
  dividend_payment_month      INTEGER DEFAULT 6,    -- June
  exchange_rate_idr_usd       NUMERIC(10,2) DEFAULT 16200.00,
  -- Contact
  support_email               TEXT DEFAULT 'support@brickxprotocol.io',
  telegram_url                TEXT DEFAULT 'https://t.me/brickxprotocol',
  twitter_url                 TEXT DEFAULT 'https://twitter.com/brickxprotocol',
  whitepaper_url              TEXT DEFAULT 'https://docs.brickxprotocol.io',
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- SEED DATA
-- ════════════════════════════════════════════════════════════════

-- Default ICO settings
INSERT INTO ico_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Phase 2: Project Hotel Batam (confidential until acquisition closes)
INSERT INTO properties (
  name, display_name, location, property_type, star_rating,
  total_rooms, token_price_usd, total_tokens,
  acquisition_cost_usd, annual_yield_pct, noi_margin_pct,
  holders_share_pct, status, confidential,
  fiscal_year_end, dividend_month, description
) VALUES (
  'Project Hotel Batam',
  'Project Hotel Batam (Confidential — Under Acquisition)',
  'Batam Island, Indonesia',
  'Hotel',
  4,
  100,
  10.00,
  1850000,                    -- $18.5M / $10 = 1,850,000 tokens
  18500000.00,                -- $18.5M = Rp 300 Billion at 16,200
  5.10,                       -- ~5.1% estimated APY at max budget
  55.00,
  70.00,
  'upcoming',
  TRUE,
  'December 31',
  'June',
  'First hotel acquisition. Existing operating 3-4 star hotel in Batam; name and exact location disclosed after SPA signing. Budget up to $18.5M USD. Annual dividend 70% of NOI paid each June.'
) ON CONFLICT (name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════
-- email is already UNIQUE on users — no separate index needed
-- Unique wallet per user, but allow multiple unset ('') wallets
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet  ON users(wallet_address) WHERE wallet_address <> '';
CREATE INDEX IF NOT EXISTS idx_users_kyc            ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_referral_code  ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_ico_orders_user      ON ico_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_ico_orders_status    ON ico_orders(status);
CREATE INDEX IF NOT EXISTS idx_ico_orders_round     ON ico_orders(round);
CREATE INDEX IF NOT EXISTS idx_ico_orders_monitor   ON ico_orders(status, crypto_currency, created_at);
-- One blockchain tx can only ever confirm one order (empty hashes excluded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ico_orders_tx ON ico_orders(tx_hash) WHERE tx_hash <> '';
CREATE INDEX IF NOT EXISTS idx_referral_referrer    ON referral_bonuses(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_referred    ON referral_bonuses(referred_id);
CREATE INDEX IF NOT EXISTS idx_holdings_user        ON token_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_property    ON token_holdings(property_id);
CREATE INDEX IF NOT EXISTS idx_listings_property    ON market_listings(property_id);
CREATE INDEX IF NOT EXISTS idx_listings_status      ON market_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_seller      ON market_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_yield_property_year  ON yield_distributions(property_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_dividend_user        ON dividend_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_dividend_distribution ON dividend_receipts(distribution_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_date        ON annual_snapshots(snapshot_date, property_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_user        ON annual_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin          ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created        ON audit_logs(created_at);

-- ════════════════════════════════════════════════════════════════
-- TRIGGERS — keep updated_at fresh
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_holdings_updated_at ON token_holdings;
CREATE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON token_holdings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ico_settings_updated_at ON ico_settings;
CREATE TRIGGER trg_ico_settings_updated_at
  BEFORE UPDATE ON ico_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (Supabase)
-- ════════════════════════════════════════════════════════════════
-- RLS enabled on ALL tables — without it the public anon key can read/write everything
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ico_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_bonuses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_holdings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_listings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_receipts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ico_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;

-- Service role (backend) bypasses RLS — never expose service key to frontend
-- anon role gets SELECT only (no INSERT/UPDATE/DELETE policies anywhere)
-- DROP first so the whole schema is safe to re-run (CREATE POLICY has no IF NOT EXISTS).
DROP POLICY IF EXISTS "Public read properties" ON properties;
CREATE POLICY "Public read properties" ON properties FOR SELECT TO anon USING (TRUE);
DROP POLICY IF EXISTS "Public read distributions" ON yield_distributions;
CREATE POLICY "Public read distributions" ON yield_distributions FOR SELECT TO anon USING (TRUE);
-- NOTE: ico_settings has NO anon policy on purpose — it holds treasury wallets and
-- contract addresses. Public ICO info (round, prices, caps) is served by the backend
-- via GET /api/ico/info using the service role.
