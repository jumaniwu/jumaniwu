# BRICKX Protocol — Deploy Checklist (Go-Live)

Follow the steps **in order**. Do not skip the verification steps.

---

## 1. Database (Supabase) — first

1. Create a Supabase project (or use existing).
2. SQL Editor → paste the entire `backend/database-schema.sql` → Run.
3. Verify in Table Editor: 11 tables exist; `ico_settings` has 1 row; `properties` has the "Project Hotel Batam" row.
4. Verify RLS: every table shows the RLS shield enabled. **This is critical — without RLS the public anon key can rewrite treasury wallets.**
5. Copy `SUPABASE_URL` and the **service_role** key (Settings → API). The service key is backend-only — never put it in any frontend.

## 2. Backend API (Railway)

1. Create a Railway project → deploy from this repo, root `brickx/backend/`.
2. `npm install express cors helmet bcryptjs jsonwebtoken dotenv @supabase/supabase-js resend axios express-rate-limit node-cron ethers morgan`
3. Set ALL environment variables from `ENV_TEMPLATE.env`. The server **exits at boot** if `JWT_SECRET`, `SUPABASE_URL`, or `SUPABASE_SERVICE_KEY` is missing.
   - `JWT_SECRET`: generate with `openssl rand -hex 32`
   - `SUMSUB_WEBHOOK_SECRET`: required in production or all KYC webhooks are rejected
   - Treasury addresses: **multisig (Gnosis Safe)**, never a personal wallet
4. Deploy → open `https://<your-api>/api/health` → must return `status: ok` and `db: ok`.
5. In Sumsub dashboard: set webhook URL to `https://<your-api>/api/kyc/webhook` and configure the signing secret to match `SUMSUB_WEBHOOK_SECRET`.
6. Create the first admin: register a normal account via the API, then in Supabase set that user's `is_admin = true`.

## 3. Frontend (Vercel) — 3 static sites + app

1. All pages read the API base from `window.BRICKX_API_URL` (fallback `https://brickx-api.railway.app`). If your Railway URL differs, add before the closing `</head>` of each HTML page:
   `<script>window.BRICKX_API_URL='https://YOUR-API.up.railway.app';</script>`
2. Deploy `frontend/landing-page.html`, `frontend/whitelist-page.html` as static sites (Vercel).
3. `frontend/admin-panel.html`: deploy on a **separate, non-public URL** (e.g. password-protected Vercel project or internal domain). Admin access itself requires an `is_admin` account via the API.
4. `frontend/platform-app.jsx`: this is a React component for a Vite project:
   ```
   npm create vite@latest brickx-app -- --template react
   npm i recharts
   # copy platform-app.jsx → src/App.jsx, then npm run build
   ```
5. Verify on the live landing page: the seed progress numbers load (not "—") and the whitelist form returns the success toast.

## 4. Smart contracts — TESTNET FIRST, AUDIT BEFORE MAINNET

1. Deploy to **Polygon Amoy** testnet first (guide at the bottom of `contracts/BRICKXContracts.sol`).
2. Test: buyWithUSDC/USDT, vesting release after cliff, distributeAnnual, emergency pause.
3. **A professional audit (CertiK/Hacken) is REQUIRED before mainnet.** The contracts move real funds now.
4. Owner of every contract must be a Gnosis Safe multisig.
5. After deployment, fill the contract addresses in Railway env vars + Admin Panel → Settings.

## 5. Final go-live verification

- [ ] `GET /api/health` → `db: ok`
- [ ] Register → welcome email arrives (Resend configured)
- [ ] Whitelist form on landing + whitelist pages → success + email
- [ ] Login as admin in admin panel → dashboard loads live numbers
- [ ] Create a test order → payment instructions email arrives
- [ ] Send a small USDT/USDC test payment from the registered wallet → order auto-confirms within ~6 minutes
- [ ] KYC sandbox flow via Sumsub → webhook updates status (check signature works)
- [ ] No page anywhere displays a real hotel name — only "Project Hotel Batam (Confidential)"
- [ ] All public copy says ANNUAL dividend (June, 70% of audited NOI) — no "monthly yield"

## Known remaining items (not blockers for whitelist launch)

- Telegram bot is not in the package yet (upload `brickx-telegram-bot.js` to integrate).
- React platform app should be wired into a Vite build pipeline (step 3.4) before the ICO purchase flow opens.
- ETH/BNB payments are confirmed manually by admin (auto-detection covers Polygon USDT/USDC only).
