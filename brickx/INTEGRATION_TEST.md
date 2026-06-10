# BRICKX Protocol — Integration Test Plan & Results

**Status:** Code-level verification done in this repo. End-to-end (E2E) tests
below require a deployed stack (Supabase + Railway) and must be run once
**after** following `TUTORIAL_GO_LIVE.md`, before public launch.

---

## A. Verified in this repository (done ✓)

| Check | Result |
|---|---|
| `server.js` parses (`node --check`) | ✓ pass |
| `platform-app.jsx` compiles (esbuild) | ✓ pass |
| Repo-wide: no confidential hotel name, no `admin123`, no "monthly yield" | ✓ 0 occurrences |
| Schema: RLS enabled on all 11 tables, cursor column, unique wallet/tx indexes | ✓ present |
| Contracts: transfers implemented, reentrancy guards, constant 70/30, post-cliff vesting | ✓ present |
| Frontend pages call live API with loading/error states, no fabricated stats | ✓ present |

---

## B. End-to-end tests — run after deploy (use Sumsub sandbox + small amounts)

### TEST 1 — Registration flow
1. Open `https://domainanda.com` → submit whitelist email →
   **expect**: success toast + welcome email with referral code.
2. Register full account via the React app (or `POST /api/auth/register`) using
   the same email → **expect**: 201, JWT returned, the whitelist row upgrades
   (login works afterward).
3. `GET /api/auth/me` with the token → **expect**: correct user, no
   `password_hash` / `kyc_applicant_id` in response.

### TEST 2 — KYC flow
1. `POST /api/kyc/init` (auth) → **expect**: Sumsub access token, status
   becomes `in_progress`.
2. Complete sandbox verification → Sumsub fires webhook →
   **expect**: webhook with valid `x-payload-digest` accepted, status
   `approved`, approval email sent.
3. Replay the same webhook with a tampered body → **expect**: 401 rejected.

### TEST 3 — Purchase flow
1. Without KYC approved: `POST /api/ico/order` → **expect**: 403.
2. Approve KYC, set wallet (`PUT /api/auth/wallet`), order $100 USDT/Polygon →
   **expect**: 201 with `payTo` treasury address + instruction email.
3. Order $99 → **expect**: 400 (min $100). Order that pushes wallet total in
   the round past $50,000 → **expect**: 400.
4. Send the exact USDT amount **from the registered wallet** to the treasury →
   **expect**: order auto-confirms within ~6 min, confirmation email, `tx_hash`
   recorded; sending from a *different* wallet must NOT confirm it.
5. Referral check: referred user's first confirmed order →
   `referral_bonuses.status` becomes `activated`.

### TEST 4 — Admin flow
1. Open admin panel → login with non-admin account → **expect**: rejected.
2. Login with `is_admin` account → dashboard shows live totals.
3. Approve a KYC, confirm an order with a real 66-char tx hash (random string
   must be rejected), run batch distribution → **expect**: each action returns
   success, emails sent, rows appear in `audit_logs`.

### TEST 5 — Dividend flow (Phase 2, can be tested with dummy data)
1. Admin panel → Annual Dividend → submit fiscalYear + audited NOI + tokens in
   circulation → **expect**: `yield_distributions` row `scheduled`,
   `dividend_receipts` rows created per holder, returned per-token/APY shown.
2. Verify the math: perToken = (NOI × 0.70) / tokens; APY = perToken / $10.

### TEST 6 — Security spot-checks
1. Using the Supabase **anon** key directly: try `UPDATE ico_settings` →
   **expect**: denied (RLS).
2. `GET /api/health` → `db: ok`. Unknown route → JSON 404. Forced error →
   generic 500, no stack trace.
3. Frontend from a foreign origin → **expect**: CORS blocked.

Record results in this file (pass/fail + date) before announcing the sale.
