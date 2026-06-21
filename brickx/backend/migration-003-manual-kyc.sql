-- ════════════════════════════════════════════════════════════════
-- BRICKX MIGRATION 003 — Manual KYC document upload
-- Run ONCE in Supabase → SQL Editor (safe to re-run: IF NOT EXISTS).
--
-- Lets applicants upload an ID photo + selfie for manual review when the
-- automated Sumsub flow isn't configured yet. Image files live in a PRIVATE
-- Supabase Storage bucket named "kyc-documents" (the backend auto-creates it
-- on first upload); these columns store the object PATHS, not the images.
-- Admins view them via short-lived signed URLs and approve/reject as usual.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kyc_doc_type     TEXT DEFAULT '',  -- passport | national_id | drivers_license
  ADD COLUMN IF NOT EXISTS kyc_doc_id_front TEXT DEFAULT '',  -- storage path to the ID front
  ADD COLUMN IF NOT EXISTS kyc_doc_id_back  TEXT DEFAULT '',  -- storage path to the ID back (optional)
  ADD COLUMN IF NOT EXISTS kyc_doc_selfie   TEXT DEFAULT '',  -- storage path to the live selfie
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ;      -- when the applicant submitted

-- NOTE: also create the private Storage bucket once (the backend will create
-- it automatically on the first upload, but you can pre-create it):
--   Supabase Dashboard → Storage → New bucket → name "kyc-documents",
--   "Public bucket" = OFF.
