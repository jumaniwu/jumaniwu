-- ════════════════════════════════════════════════════════════════
-- BRICKX MIGRATION 002 — Email verification (OTP at registration)
-- Run ONCE in Supabase → SQL Editor (safe to re-run: IF NOT EXISTS).
-- Adds a 6-digit email OTP so accounts must confirm a real, reachable
-- email before the account is usable (payment instructions go by email).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS otp_code_hash    TEXT,
  ADD COLUMN IF NOT EXISTS otp_expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_attempts     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_last_sent_at TIMESTAMPTZ;

-- Grandfather in accounts that already existed before OTP was introduced
-- (admins/testers), so they are not locked out. New signups default to FALSE.
UPDATE users SET email_verified = TRUE WHERE otp_code_hash IS NULL AND created_at < NOW();
