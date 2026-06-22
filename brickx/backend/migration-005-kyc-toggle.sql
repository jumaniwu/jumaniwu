-- migration-005-kyc-toggle.sql
-- Admin-toggleable KYC requirement.
--
-- The column is part of the base schema (ico_settings.kyc_required), but older
-- databases created before it was added won't have it. Run this once in the Supabase
-- SQL editor to be sure — it is safe to re-run.
--
-- Default is TRUE (KYC required to purchase AND to receive tokens). To DEFER KYC
-- during the seed raise, either toggle it OFF in Admin → Settings, or run the
-- UPDATE below. Turn it back ON (with Sumsub) before distributing BRX.

ALTER TABLE ico_settings
  ADD COLUMN IF NOT EXISTS kyc_required boolean NOT NULL DEFAULT true;

-- Optional: defer KYC right now (uncomment to run).
-- UPDATE ico_settings SET kyc_required = false;
