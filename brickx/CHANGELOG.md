# BRICKX Protocol — Changelog

## v4.1 — Go-live revision (2026-06-10)

Full audit (`/AUDIT_REPORT.md`) followed by fixes. Summary of changes per file.

### backend/server.js
- Fail-fast env validation at boot (JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY).
- `trust proxy`, morgan request logging, JSON body limit reduced to 1 MB.
- Sumsub webhook now verifies the `x-payload-digest` HMAC signature (timing-safe); unsigned webhooks rejected in production.
- Payment monitor: matches the **sender wallet** to the order (not amount alone), tx-hash idempotency, persistent block cursor (`ico_settings.last_scanned_block`), RPC retry with backoff.
- ICO orders: per-wallet max enforced **per round**; round **hard cap** enforced; `percentFilled` uses the active round's cap.
- Dividend distribution accepts **audited NOI** (`noiUsd`) instead of a hardcoded 55% estimate and writes per-holder `dividend_receipts`.
- Referral bonuses activate on the referred user's first confirmed order.
- Dec-31 cron now actually writes `annual_snapshots`; all crons pinned to Asia/Jakarta.
- New endpoints: `POST /api/whitelist` (public email capture), `GET /api/admin/orders` (paginated), `POST /api/marketplace/buy` (fixed $10, 0.5% fee).
- Central 404 + error handlers (no stack traces); health check pings the DB; neutral duplicate-email message; crypto-random referral codes; whitelist pre-registrations upgrade in place on full registration.
- Fixed latent bug: `market_listings.total_value` is a generated column and is no longer inserted explicitly.

### backend/database-schema.sql
- **RLS enabled on every table** (previously `properties`, `ico_settings`, `referral_bonuses`, `audit_logs` were writable with the public anon key — including treasury addresses).
- Unique wallet index (`users.wallet_address`, ignoring empty), unique `tx_hash` index on orders.
- CHECK constraints (positive amounts/balances), `last_scanned_block` cursor column, missing FK indexes, `updated_at` triggers.
- Seed data: confidential property description (district removed), proper `ON CONFLICT` target.

### contracts/BRICKXContracts.sol
- All token transfers implemented (previously commented out — the sale collected no money). Safe-transfer checks (USDT-compatible), inline reentrancy guards, checks-effects-interactions.
- Vesting: linear vesting now starts **after** the cliff (matches "12-month lock, then 24-month vesting").
- YieldDistributor: rewritten to the **annual push model** (Dec-31 snapshot, June payout via `distributeAnnual`); 70/30 split is now a constant (`updateShares` removed).
- BRICK price enforced at $10.00 in `addProperty`; two-step ownership transfer; `PurchaseMade` event naming; real `emergencyWithdraw` with multisig guidance.
- Deploy guide: confidential placeholders (hotel name/SPV removed), Amoy testnet, audit-required checklist.

### frontend/landing-page.html
- Fabricated stats removed ("847 investors", "$247,500 raised", "153 spots remaining"); live numbers now load from `GET /api/ico/info` with neutral placeholders on failure.
- Whitelist form actually submits (`POST /api/whitelist`) with loading state, double-submit guard, inline error messages.
- Configurable API base via `window.BRICKX_API_URL`.

### frontend/whitelist-page.html
- Confidential hotel naming restored; all "monthly yield" wording replaced with the annual June dividend (70% of audited NOI); APY corrected to ~5.1%; "275% below DEX" corrected to "+275% upside".
- Real API submission with backend-issued referral codes (no more `Math.random()` codes or fake whitelist numbers).
- Removed the self-incrementing fake counter; countdown now uses a single fixed close date and actually expires; footer/share links fixed.

### frontend/admin-panel.html
- Hardcoded `admin123` password removed; real JWT login via `POST /api/auth/login` (admin accounts only).
- All fake in-memory data replaced with live API loads; KYC/order/distribution/settings actions call the real endpoints.
- Annual dividend module (audited NOI input); single confidential property; CSV export injection-safe.

### frontend/platform-app.jsx
- Complete conversion from mock to API-driven: real auth/session, Sumsub KYC status flow, wallet registration, order → payment-instructions flow (no fake balances), real portfolio/orders, single confidential property at $10 fixed with annual dividend, error boundary, loading/error states.

### New files
- `ENV_TEMPLATE.env` — all required environment variables, documented.
- `DEPLOY_CHECKLIST.md` — ordered go-live steps + final verification list.
- `/AUDIT_REPORT.md` (repo root) — full audit findings.

### Known gaps (not blockers for whitelist launch)
- Telegram bot not in package (needs upload).
- Smart contracts require Amoy testnet testing + professional audit before mainnet.
- ETH/BNB payments confirmed manually (auto-detect is Polygon USDT/USDC only).
