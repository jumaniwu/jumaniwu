-- ════════════════════════════════════════════════════════════════
-- BRICKX MIGRATION 001 — Dynamic ICO rounds & sale schedule
-- Run this ONCE in Supabase → SQL Editor (safe to re-run: IF NOT EXISTS).
-- Adds sale scheduling + per-round hard caps so the admin panel can
-- start/pause the sale, change prices, and the frontend follows the API.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE ico_settings
  ADD COLUMN IF NOT EXISTS sale_status        TEXT NOT NULL DEFAULT 'upcoming',
  ADD COLUMN IF NOT EXISTS sale_starts_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS round1_hard_cap_usd INTEGER NOT NULL DEFAULT 1500000,
  ADD COLUMN IF NOT EXISTS round2_hard_cap_usd INTEGER NOT NULL DEFAULT 1100000;

-- sale_status: 'upcoming' (not open yet), 'live' (orders allowed),
--              'paused' (temporarily closed). Orders are only accepted
--              when status = 'live' AND (sale_starts_at IS NULL OR now() >= sale_starts_at).
ALTER TABLE ico_settings
  DROP CONSTRAINT IF EXISTS ico_settings_sale_status_check;
ALTER TABLE ico_settings
  ADD CONSTRAINT ico_settings_sale_status_check
  CHECK (sale_status IN ('upcoming', 'live', 'paused'));

-- Prices must stay positive (protects against fat-finger edits).
ALTER TABLE ico_settings
  DROP CONSTRAINT IF EXISTS ico_settings_positive_prices_check;
ALTER TABLE ico_settings
  ADD CONSTRAINT ico_settings_positive_prices_check
  CHECK (
    seed_price_usd > 0 AND round1_price_usd > 0 AND round2_price_usd > 0
    AND dex_target_price_usd > 0
    AND seed_hard_cap_usd > 0 AND round1_hard_cap_usd > 0 AND round2_hard_cap_usd > 0
    AND min_investment_usd > 0 AND max_investment_usd >= min_investment_usd
  );
