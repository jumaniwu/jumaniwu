# BRICKX Protocol — Security Model & Hardening Checklist

This document is the single source of truth for how the platform is protected and
what the operators must do to keep it safe. Read it before every deployment and
before granting anyone access.

---

## 1. Threat model — why the treasury cannot be drained via the app

**The backend never holds a private key.** The treasury is a Polygon **multisig
wallet (Gnosis Safe / safe.global)**. The server only knows the treasury *address*
(public, safe to expose) and reads it from an **environment variable on Railway**,
never from the database or any API input.

Consequences:
- A full compromise of the server **or** the database cannot move treasury funds —
  there is no key to sign a transaction with.
- Payout addresses cannot be changed through the API. The only way to change one is
  via the hosting environment (Railway), which requires separate credentials.
- The real-money control is the **multisig threshold** (e.g. 2-of-3 signers). Protect
  the signer keys; that is what guards the money.

---

## 2. Row Level Security (Supabase) — verified

RLS is enabled on **all 11 tables**. The only client-facing role is `anon`; the
backend uses the `service_role` key which bypasses RLS.

| Table | RLS | anon access |
|-------|-----|-------------|
| users | ✅ | none (locked) |
| ico_orders | ✅ | none (locked) |
| referral_bonuses | ✅ | none (locked) |
| properties | ✅ | SELECT only (public listing) |
| token_holdings | ✅ | none (locked) |
| market_listings | ✅ | none (locked) |
| yield_distributions | ✅ | SELECT only (public dividends) |
| dividend_receipts | ✅ | none (locked) |
| annual_snapshots | ✅ | none (locked) |
| ico_settings | ✅ | **none — holds treasury/contract addresses** |
| audit_logs | ✅ | none (locked) |

There are **no anon INSERT/UPDATE/DELETE policies anywhere**. If the anon key ever
leaks, the worst an attacker can do is read public property and dividend rows.

> Verify in Supabase → Table Editor: every table shows the RLS shield enabled.

---

## 3. Application-level protections (in code)

- **Auth:** JWT (30-day expiry). `JWT_SECRET` strength is enforced at startup —
  the server refuses to boot on a weak/placeholder secret and warns under 32 chars.
- **Admin:** `is_admin` is only ever set to `false` by the API. There is no endpoint
  that elevates a user to admin and no mass-assignment (`req.body` is never spread
  into an update). Admin status is granted manually in Supabase only.
- **Passwords:** bcrypt cost 12; plaintext passwords are never stored or logged.
- **Treasury & contract addresses:** environment-only. `PATCH /api/admin/settings`
  rejects these fields, so a compromised admin account cannot redirect funds.
- **Payment matching:** an on-chain payment auto-confirms an order only when the
  amount matches (±1%) **and** the sender wallet equals the order's registered
  wallet. Payments from other sources are left for manual admin confirmation —
  this prevents crediting the wrong user when amounts collide.
- **Fixed prices:** BRICK is always `$10.00` and BRX prices come from server-side
  settings — never from client input. Marketplace listings are forced to `$10.00`.
- **KYC webhook:** Sumsub signatures verified with HMAC-SHA256 + timing-safe
  compare; required in production. Forged "approved" events are rejected.
- **Transport/edge:** Helmet security headers, CORS allowlist (`*.brickxprotocol.io`
  + configured extras), 1 MB JSON body limit, rate limiting (100/15 min globally,
  10/15 min on `/api/auth`).
- **Errors:** stack traces are never returned to clients; admin actions are written
  to `audit_logs`.

---

## 4. Operator checklist — the remaining risk is operational

The code is hardened; the most realistic attack now is a stolen credential or
misconfiguration. Do all of these:

- [ ] `JWT_SECRET` generated with `openssl rand -hex 32` (32+ chars, random).
- [ ] Treasury is a **multisig (safe.global), 2-of-3 or stronger** — never a personal
      wallet. Signer keys held by different people / devices.
- [ ] `SUPABASE_SERVICE_KEY` lives **only** in Railway env. Never in the frontend,
      repo, or any HTML/JS file. (It bypasses RLS.)
- [ ] RLS shield is on for every table in Supabase.
- [ ] Admin panel is on a **non-public URL** (not an "admin" subdomain) and behind
      Vercel password protection. The URL is not shared publicly.
- [ ] **2FA enabled** on GitHub, Railway, Supabase, Vercel, and Namecheap. A hijack
      of any of these lets an attacker change env vars or DNS — the most realistic
      path in. Treat these accounts as the crown jewels.
- [ ] `SUMSUB_WEBHOOK_SECRET` set in production (KYC webhooks are rejected without it).
- [ ] Smart contracts deployed to **testnet first**; a professional audit
      (CertiK / Hacken) completed before mainnet. Every contract owner is the multisig.
- [ ] `POLYGON_RPC_URL` points at a paid/reliable RPC (Alchemy/Infura/QuickNode) so
      the 3-minute payment monitor does not get rate-limited.

---

## 5. If a credential is compromised

1. **Railway/Supabase/Vercel/GitHub account:** rotate the password, revoke sessions,
   confirm 2FA, review recent activity and env-var/DNS changes.
2. **`SUPABASE_SERVICE_KEY` leaked:** rotate it in Supabase → Settings → API, update
   Railway, redeploy. Assume all DB data was readable/writable until rotation.
3. **`JWT_SECRET` leaked:** rotate it and redeploy — this invalidates all issued
   tokens (everyone must log in again), which is the desired effect.
4. **Admin account compromised:** the attacker still cannot move funds (env-only
   treasury, no keys). Suspend the account (`is_active = false`), rotate `JWT_SECRET`,
   review `audit_logs` for any price/setting changes and revert them.
5. **Treasury signer key compromised:** because it is a multisig, a single key is not
   enough to move funds. Rotate that signer in the Safe immediately.

---

## 6. Reporting

Security issues: email **security@brickxprotocol.io**. Do not open a public GitHub
issue for vulnerabilities.
