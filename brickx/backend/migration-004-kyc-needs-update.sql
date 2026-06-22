-- ════════════════════════════════════════════════════════════════
-- BRICKX MIGRATION 004 — KYC "needs_update" status
-- Run ONCE in Supabase → SQL Editor (safe to re-run).
--
-- Adds a softer 'needs_update' status used by the admin "Request Fix" action:
-- the applicant is asked (by email) to re-upload with a specific correction,
-- without a hard "rejected". The in-app upload form reopens for this status.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_kyc_status_check;
ALTER TABLE users ADD CONSTRAINT users_kyc_status_check
  CHECK (kyc_status IN ('not_started','in_progress','pending','approved','rejected','needs_update'));
