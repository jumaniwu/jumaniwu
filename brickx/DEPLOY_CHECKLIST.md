# BRICKX Protocol — Deploy Checklist (Go-Live)

Follow the steps **in order**. Do not skip the verification steps.

---

## 1. Database (Supabase) — first

1. Create a Supabase project (or use existing).
2. SQL Editor → paste the entire `backend/database-schema.sql` → Run.
3. SQL Editor → paste `backend/migration-001-dynamic-rounds.sql` → Run. This adds the
   sale-schedule columns (`sale_status`, `sale_starts_at`, per-round hard caps) that let
   the admin panel start/pause the sale and the app's countdown work. Safe to re-run.
4. Verify in Table Editor: 11 tables exist; `ico_settings` has 1 row; `properties` has the "Project Hotel Batam" row.
5. Verify RLS: every table shows the RLS shield enabled. **This is critical — without RLS the public anon key can rewrite treasury wallets.**
6. Copy `SUPABASE_URL` and the **service_role** key (Settings → API). The service key is backend-only — never put it in any frontend.

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
4. **Platform app** (`brickx/app/`) — the live registration / KYC / buy-BRX / portfolio app.
   It is a ready Vite project (no manual scaffold needed). Deploy on Vercel:
   - New Vercel project → import this repo → **Root Directory: `brickx/app`**.
   - Framework preset auto-detects **Vite**; `app/vercel.json` already sets the build
     command (`vite build`), output (`dist`), and SPA fallback. No extra config needed.
   - The API base is set in `app/index.html` (`window.BRICKX_API_URL`). Update it there if
     your Railway URL differs from `https://api.brickxprotocol.io`.
   - Add custom domain **`app.brickxprotocol.io`** to this Vercel project.
5. Verify on the live landing page: the seed progress numbers load (not "—") and the whitelist form returns the success toast.
6. Verify on the app: register → login → dashboard loads. Before the sale opens, the Buy BRX
   page shows the **countdown / "Opens Soon"** gate; once admin sets the sale **live**, the
   purchase + payment-instruction flow appears.

## 3b. DNS (Namecheap → Advanced DNS)

Point the domain at the right services. Add these records in **Domain List → Manage → Advanced DNS**:

| Type  | Host        | Value                                  | Purpose                          |
|-------|-------------|----------------------------------------|----------------------------------|
| A     | `@`         | Vercel IP (`76.76.21.21`)              | Apex → landing page (Vercel)     |
| CNAME | `whitelist` | `cname.vercel-dns.com`                 | Whitelist page (Vercel)          |
| CNAME | `app`       | `cname.vercel-dns.com`                 | Platform app (Vercel)            |
| CNAME | `docs`      | (GitBook target)                       | Whitepaper (GitBook Git Sync)    |
| CNAME | `api`       | (Railway-provided target)              | Backend API (Railway custom dom) |

Email sending (Resend) — **no MX needed**, only TXT + CNAME (exact values from the Resend dashboard):

| Type  | Host                | Value                                              |
|-------|---------------------|----------------------------------------------------|
| TXT   | `@`                 | `v=spf1 include:amazonses.com ~all`                |
| CNAME | `resend._domainkey` | (DKIM value from Resend → Domains)                 |
| TXT   | `_dmarc`            | `v=DMARC1; p=quarantine; rua=mailto:admin@brickxprotocol.io` |

After DNS propagates (5–30 min): in Vercel add each custom domain to its project; in Railway
add `api.brickxprotocol.io` under Settings → Domains; in Resend click **Verify** on the domain.
Then set `RESEND_API_KEY` + `EMAIL_FROM=noreply@brickxprotocol.io` in Railway so emails send.

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
- ETH/BNB payments are confirmed manually by admin (auto-detection covers Polygon USDT/USDC only).
