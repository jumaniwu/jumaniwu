# BRICKX PROTOCOL — FULL CODE AUDIT REPORT
**Package:** BRICKX_Complete_Package_v4.zip · **Date:** 2026-06-10 · **Auditor:** Claude Code

Scope: `brickx/backend/server.js`, `brickx/backend/database-schema.sql`,
`brickx/contracts/BRICKXContracts.sol`, `brickx/frontend/platform-app.jsx`,
`brickx/frontend/landing-page.html`, `brickx/frontend/whitelist-page.html`,
`brickx/frontend/admin-panel.html`. The Telegram bot was **not** in the v4
package and could not be audited.

Severity legend — **Critical**: exploitable now / loses funds / violates a
never-change business rule in public. **High**: must fix before launch.
**Medium**: fix soon. **Low**: quality/polish.

---

## 1. EXECUTIVE SUMMARY

The package is a well-organized prototype, but **it is not production-ready**.
The three most dangerous problems:

1. **The smart contracts do not move any money.** Every USDC/BRX transfer in
   all 5 contracts is commented out. `buyWithUSDC()` records a purchase and
   emits events **without collecting payment**. Vesting `release()` marks
   tokens as released without sending them. `claimYield()` always reverts
   because `getClaimable()` is an empty loop returning 0. Deploying these
   as-is would create a sale that takes no money and a vesting contract that
   pays nothing.
2. **The KYC webhook and the database are wide open.**
   `POST /api/kyc/webhook` has no signature verification — anyone who learns
   an `applicantId` (or guesses the `brickx_<uuid>_<ts>` format) can approve
   their own KYC. Separately, RLS is never enabled on `properties`,
   `ico_settings`, `referral_bonuses`, and `audit_logs`, so anyone holding the
   public Supabase anon key can **rewrite the treasury wallet addresses** in
   `ico_settings` and redirect all investor payments.
3. **The confidential hotel name is leaked** ("The Horizon Hotel Batam",
   Nagoya Business District) in the contracts deployment guide and throughout
   the React app — a direct violation of never-change rule #7. The React app
   also contradicts the core business model (monthly yield instead of annual
   June dividend, non-$10 token prices, $3.4M target, "ICO funds hotel
   construction").

Issue counts: see per-file sections below.

---

## 2. BACKEND — `brickx/backend/server.js`

### Critical
- **C-B1. Unauthenticated KYC webhook** (`POST /api/kyc/webhook`, line ~321).
  No Sumsub signature check (`x-payload-digest` HMAC). Anyone can POST
  `{type:'applicantReviewed', applicantId, reviewResult:{reviewAnswer:'GREEN'}}`
  and approve arbitrary applicants. KYC becomes decorative.
- **C-B2. Payment monitor matches by amount only** (`checkPendingPayments`,
  line ~1075). A Transfer to the treasury is matched to a pending order by
  USD amount ±1% — the **sender address is never compared** to the order's
  user wallet. Consequences: (a) attacker creates an order for $X, waits for
  any other investor's $X deposit, and gets credited; (b) two same-amount
  orders are racing for one payment; (c) one on-chain payment can confirm a
  different user's order. Must match `event.args.from` against the payer and
  store/`UNIQUE`-check `tx_hash` to prevent double-crediting.
- **C-B3. Payment monitor scans 150 blocks (~5 min) every 3 min with no
  processed-block cursor** — overlapping windows can confirm the same
  transfer twice across restarts; combined with C-B2, one tx can confirm
  multiple orders. Polygon ~2s blocks also means gaps if the cron is delayed.
- **C-B4. ETH and BNB payment options are offered but never monitored.**
  Orders created with `crypto_currency: 'ETH'|'BNB'` can never auto-confirm;
  money arrives at treasury with no reconciliation path except manual admin
  confirm. Either remove the options or implement watchers.
- **C-B5. No startup validation of env vars.** With `JWT_SECRET` undefined,
  `jwt.sign`/`verify` throw at runtime (500s); with `SUPABASE_*` undefined the
  client is created against `undefined`. Must fail fast on boot.

### High
- **H-B1. `POST /api/admin/dividend/distribute` ignores the audited NOI**: it
  computes `noi = grossRevenue * 0.55` (hardcoded estimate) even though the
  whole model is "audited NOI". Dividends would be paid on an estimate.
  Should accept `noi` (audited) as input, not derive it.
- **H-B2. Per-wallet max is enforced across ALL rounds combined**
  (`/api/ico/order`): spec says $50,000 *per wallet per round*; the code sums
  every order ever made. Conversely nothing limits per *wallet* — limits are
  per user account; one person with two accounts/wallets bypasses the cap.
- **H-B3. `percentFilled` divides by the seed cap regardless of active round**
  (`/api/ico/info` and `/api/admin/dashboard`) → wrong progress once round 1
  starts ( > 100%).
- **H-B4. `distribute/batch` and its email claim tokens "have been sent"**
  but no on-chain transfer happens anywhere — status is flipped to
  `distributed` and investors are told tokens are in their wallet.
- **H-B5. Order placement isn't gated on round caps**: a user can order past
  the seed hard cap ($640K); nothing checks `totalRaised + amount <= cap`.
- **H-B6. Wallet uniqueness race** (`PUT /api/auth/wallet`): check-then-update
  without a DB unique constraint (schema has none on `users.wallet_address`).
- **H-B7. No Sumsub webhook idempotency / replay protection** and the
  webhook returns 500→200 inconsistently (`res.status(200)` in catch after
  possibly having thrown mid-update).
- **H-B8. CORS origin list contains `undefined`** when `FRONTEND_URL` is
  unset; also no handling for Vercel preview URLs; `app.set('trust proxy')`
  is missing, so `express-rate-limit` keys all users behind Railway's proxy
  to one IP (mass lockout / trivial bypass).
- **H-B9. Email enumeration**: register returns 409 "Email already
  registered" and login distinguishes account-vs-password errors in
  `/register` + KYC reset flows. (Login itself is OK.)
- **H-B10. Referral code generated with `Math.random()`** — 36^5 space,
  collisions and guessability; insert has no retry on `UNIQUE` violation
  (registration 500s on collision).

### Medium
- **M-B1.** No input-validation layer (express-validator/Joi/zod) — ad-hoc
  checks only; `usdAmount` accepts scientific notation strings, `country`,
  names, `referralCode` unvalidated lengths.
- **M-B2.** JWT lifetime 30 days, no revocation; tokens survive password
  change and account suspension only via per-request DB lookup (OK) but
  nothing invalidates stolen tokens.
- **M-B3.** `express.json({limit:'10mb'})` is excessive for this API (DoS
  surface). 100KB is plenty.
- **M-B4.** No request logging (morgan/pino), no global error handler, no
  404 handler, health check doesn't test DB connectivity.
- **M-B5.** Cron jobs lack `timezone` option — "8AM WIB" comments are wrong
  unless server TZ is Asia/Jakarta; Dec-31/Jun-1 reminders fire at server
  local time.
- **M-B6.** `ico_settings` is read with `.single()` on every info request —
  no caching; admin dashboard loads *all* users/orders into memory (no
  pagination, no `count`).
- **M-B7.** `sanitizeUser` strips only `password_hash`; still returns
  `kyc_applicant_id`, `is_admin`, `referred_by` etc. to the client.
- **M-B8.** `admin/users` and `admin/audit` have no pagination (cap 200 on
  audit only).
- **M-B9.** Sumsub token creation: `createSumsubToken` returns a fake
  `demo_token_` silently in prod if env var missing — should hard-fail.
- **M-B10.** USDC on Polygon: only bridged USDC.e address is monitored;
  native USDC (`0x3c49...3359`) transfers would be missed.

### Low
- **L-B1.** `console.log`/`console.error` instead of a structured logger.
- **L-B2.** Single 1,200-line file; constants/middleware/routes/crons should
  be modules.
- **L-B3.** `decimals = tokenSymbol === 'USDT' ? 6 : 6` — dead conditional.
- **L-B4.** Emails embed unescaped user data (`firstName`, reason) — stored
  HTML injection into emails.
- **L-B5.** No `helmet` CSP customization; defaults fine for API but
  documents nothing.

---

## 3. DATABASE — `brickx/backend/database-schema.sql`

### Critical
- **C-D1. RLS is NOT enabled on `properties`, `ico_settings`,
  `referral_bonuses`, `audit_logs`.** In Supabase, tables without RLS are
  fully readable **and writable** with the public anon key. `ico_settings`
  holds the treasury wallet addresses → an attacker can swap them and
  silently receive investor funds. `audit_logs` can be forged/erased.
  (The three `CREATE POLICY` statements at the bottom target tables and roles
  inconsistently with this — policies on `properties`/`ico_settings` are
  no-ops until RLS is enabled.)

### High
- **H-D1.** No `UNIQUE` constraint on `users.wallet_address` (backend relies
  on app-level check; race → two accounts, one wallet, double airdrop).
- **H-D2.** `market_listings.price_per_token CHECK (= 10.00)` hardcodes $10
  for *every* property while `properties.token_price_usd` is a column —
  schema contradicts itself (the platform app sells $2.40/$1.75 tokens; the
  business rule says everything is $10 — one of the two must go).
- **H-D3.** `ico_orders.usd_amount` has no `CHECK (usd_amount > 0)`; negative
  order amounts would corrupt raised totals. Same for `brx_allocated`,
  `token_holdings.balance` (can go negative), `market_listings.token_amount`.
- **H-D4.** No `updated_at` triggers — `users.updated_at`/`ico_settings.
  updated_at` never change.

### Medium
- **M-D1.** Missing indexes used by hot queries: `ico_orders(status,
  crypto_currency, created_at)` (payment monitor), `ico_orders(round)`,
  `referral_bonuses(referrer_id)`, `dividend_receipts(distribution_id)`,
  `market_listings(seller_id)`.
- **M-D2.** `ico_orders.round` CHECK excludes `'dex'` but settings allow
  `active_round` to be any text — order insert will violate CHECK if admin
  sets a bogus round.
- **M-D3.** `annual_snapshots` has no automated population path (backend
  never writes it) — the Dec-31 snapshot the dividend model depends on does
  not exist anywhere in code.
- **M-D4.** `referral_bonuses` `'activated'` status is never set by any code
  path — referral bonuses stay `pending` forever (feature is half-built).

### Low
- **L-D1.** `idx_users_email` duplicates the implicit UNIQUE index.
- **L-D2.** Seed property INSERT `ON CONFLICT DO NOTHING` has no unique key
  to conflict on → duplicate hotel rows on re-run.

---

## 4. SMART CONTRACTS — `brickx/contracts/BRICKXContracts.sol`

### Critical
- **C-S1. All value transfers are commented out.** `BRXICOVault.buyWithUSDC`
  (line ~405): `IERC20(usdc).transferFrom(...)` commented → purchases are
  free. `BRXVesting.release` (line ~231), `revoke`, `createSchedule` token
  pulls, `BRICKToken.mint`/`buyListing` USDC legs, `YieldDistributor`
  payouts — all commented. The contracts compile but **handle no money**.
- **C-S2. `YieldDistributor.getClaimable` always returns 0** (loop body
  commented out) → `claimYield` reverts "Nothing to claim" for everyone;
  holders can never be paid.
- **C-S3. Yield is computed against *current* balances, not snapshots**
  (design of `claimYield`/commented `getClaimable`): buy tokens after a
  deposit → claim past yield; sell before claiming → lose it; also tokens
  locked in marketplace listings sit in `address(this)` and their yield is
  unclaimable. Needs per-distribution snapshots (the off-chain model says
  Dec-31 snapshot; the contract has none).
- **C-S4. Confidential hotel name leaked** in deployment guide:
  `"The Horizon Hotel Batam", "Nagoya Business District…", "PT Horizon Batam
  SPV"` (lines ~874-880). Violates never-change rule #7. Also `12.5%` yield
  and `$114,000/month` rent contradict the annual-dividend/5.1% model.
- **C-S5. `YieldDistributor.updateShares` lets the owner change the 70/30
  split** — rule #3 says 70% is a hardcoded constant. Should be immutable.
- **C-S6. `emergencyWithdraw` is an empty function** — in an emergency it
  does nothing; conversely if implemented as-is (owner withdraws any token,
  any amount) it's a rug-pull primitive with no timelock/multisig guard.

### High
- **H-S1. No reentrancy guards anywhere.** Once the commented `transfer`
  calls are restored, `buyListing`, `claimYield`, `release` follow
  checks-effects-interactions inconsistently (e.g. `buyListing` pays the
  seller before state changes in the commented design). Use OZ
  `ReentrancyGuard` + SafeERC20.
- **H-S2. USDT on Polygon requires SafeERC20** (non-standard `transfer`
  returns); the vault stores `usdt` but has no buy path for it at all —
  USDT payers in the backend flow have no on-chain counterpart.
- **H-S3. Vesting math ignores the cliff/lock semantics promised to
  investors**: linear vesting runs from `startTime` over `vestingDuration`,
  so for seed (12m cliff, 24m vesting) 50% is already vested the moment the
  cliff ends — the backend/email promise "12-month lock, THEN 24-month
  linear vesting" implies vesting should start *after* the cliff. As written
  investors unlock far faster than advertised.
- **H-S4. Hand-rolled ERC-20/ERC-1155 instead of OpenZeppelin.** Despite the
  OZ import header, `BRXToken` and `BRICKToken` are written by hand.
  `BRICKToken` is called ERC-1155 but implements none of the interface
  (`safeTransferFrom`, `balanceOfBatch`, `setApprovalForAll`, receiver hooks,
  `supportsInterface`) — wallets and marketplaces will not recognize it.
  Forfeits audited, battle-tested implementations for no benefit.

### Medium
- **M-S1.** Event `Purchase_made` (line ~310) breaks Solidity PascalCase
  event naming.
- **M-S2.** `activateRound` loops over all rounds to deactivate — fine at
  small N, but unbounded loops over `roundCount` are a gas-growth smell;
  same pattern risk in `approveKYC(address[])` with a large array.
- **M-S3.** No events on several state changes (`setTreasury`,
  `setKYCRequired`, `transferOwnership`, `revokeKYC`, `setBlacklist`) —
  weak off-chain auditability.
- **M-S4.** `transferOwnership` is single-step (no two-step accept) — a typo
  bricks ownership. Use OZ `Ownable2Step`.

### Low
- **L-S1.** Deploy guide pins Mumbai testnet (deprecated; use Amoy).
- **L-S2.** Hardcoded `gasPrice: 50 Gwei` in deploy config is brittle on
  Polygon.
- **L-S3.** `platformFeeBPS` mutable with no event and no upper bound.

---

## 5. FRONTEND

### 5.1 React app — `brickx/frontend/platform-app.jsx`

#### Critical
- **C-F1. 100% mock data — no API layer.** No `fetch`/`axios` anywhere. Auth
  (`USERS = {}` in memory), KYC, buy BRX (`:760`), buy/sell BRICK, the
  $50,000 fake USDC balance (`:253`), and a "[Demo] Approve KYC" button
  (`:1260`) are all client-side simulations. Nothing persists or reaches
  `server.js`. Master prompt Phase 2 Frontend #1 unmet.
- **C-F2. Passwords handled in plaintext in the browser.** Login compares
  `u.pw === f.pw` (`:239-244`); registration stores the raw password in a JS
  object (`:250`). Wrong and dangerous pattern even for a demo.
- **C-F3. Confidential hotel name leaked (Rule #7).** `:106`
  `name:"The Horizon Hotel Batam"`, rendered across home (`:671`), market,
  and detail (`:1022`); district exposed at `:672`.
- **C-F4. Monthly dividend model (Rule #3 — annual, June).** "Monthly yield"
  throughout: `:647, 691, 882, 1036, 1081, 1174, 1268, 1290`. `:1034-1037`
  even labels a figure "ANNUAL YIELD" with sub-label "Monthly distribution".
- **C-F5. Non-$10 fixed price (Rule #1) + multi-property REIT (model
  conflict).** `:105-143` defines 5 properties priced $10/$2.40/$1.75/$3.20/
  $0.62, each called "FIXED PRICE" (`:912, 1029`). Contradicts the single
  confidential-hotel, $10-fixed, post-ICO model the backend implements.
- **C-F6. Wrong ICO numbers.** `:103` hardcoded `ICO={sold:67M,total:100M,
  raise:1005000}`; `:846-847` "raised of $1,500,000 target"; `:680-681`
  "Target: $3.4M"; `:811/850` min buy shown as **$10** (slider `min={10}`)
  while backend enforces **$100** — the UI builds orders the API rejects.

#### High / Medium
- **H-F1.** No error boundaries; spinners only, no skeletons (Phase 2
  Frontend #3/#8).
- **H-F2.** Frontend allows `pending` KYC users to buy (`:474
  can = approved||pending`); backend requires `approved` (`server.js:416`) —
  mismatch, guaranteed failed purchases.
- **M-F1.** `txs.map((tx,i)=>… key={i})` (`:1200`) uses array index as key.
- **M-F2.** "Resale Value = amount" framing (`:1114`) plus "speculation-free"
  claims contradict the variable prices shown — marketing/compliance risk.

### 5.2 Landing page — `brickx/frontend/landing-page.html`

> Most rule-compliant of the three pages: annual-June dividend, confidential
> "Project Hotel Batam", $10 fixed, 70% of NOI, correct price ladder, 1B
> supply summing exactly, USD/English only — all verified PASS.

- **C-L1.** Registration is fake: `doRegister()` (`:698-710`) validates email,
  then shows "✓ Registered! Check your email." (`:239`) with **no** `fetch`.
  Emails are silently discarded on a live fundraising page.
- **H-L1.** Fabricated, static fundraising stats: "38.7% Filled · 847
  Investors" (`:308`), "$247,500 raised / $640,000 cap" (`:312, 534`), "153
  spots remaining" (`:656`) — not from `/api/ico/info`.
- **H-L2.** Headline "$2M ICO Raise Target" (`:291, 330`) vs price-ladder math
  (80M seed + 150M public ≈ $3.24M) — reconcile.
- **H-L3.** Whitepaper link `https://docs.brickxprotocol.io` (`:281, 682`) is
  a placeholder, opened with no fallback.
- **M-L1.** No invalid-email message (red border only), no loading state /
  double-submit guard (`:659, 701-705`).
- **L-L1.** 360-day revenue year (`:443`, undisclosed); duplicate
  `@keyframes fadeUp` (`:22, 233`); FAQ `max-height:220px` clips long answers.

### 5.3 Whitelist page — `brickx/frontend/whitelist-page.html`

- **C-W1. Confidential hotel name leaked (Rule #7):** `:236` "First access to
  **The Horizon Hotel Batam** BRICK tokens".
- **C-W2. Monthly dividend wording (Rule #3):** `:176-177, 237, 443, 452`.
- **C-W3. Wrong dividend base:** `:237` says 70% of **revenue**, not NOI.
- **C-W4. Fake submission:** `// Simulate API call` + `setTimeout` (`:412-437`),
  then mints a client-side referral code via `Math.random()` (`:415`) and a
  fake whitelist number — no `fetch`, codes are worthless to the backend.
- **C-W5. APY contradiction:** "12.5% Hotel APY" (`:198-199`) vs landing's
  ~5.1% base / 5–8% (`landing:409, 449`) — 2.4× overstatement.
- **H-W1.** Self-incrementing "social proof" counter (`:363-376`) and a
  countdown that resets to +7 days every tick so it never expires (`:379-387`).
- **H-W2.** "275% below DEX launch" (`:235, 443`) is impossible (seed is 73.3%
  below; DEX is 275% above).
- **M-W1.** All footer links `href="#"` (`:353-356`); `?ref=` accepted with no
  validation (`:470-474`).

### 5.4 Admin panel — `brickx/frontend/admin-panel.html`

- **C-A1. Hardcoded admin password `admin123`, client-side-only auth.** `:268`
  `if (p !== 'admin123')` accepts any email; password printed on the login
  screen (`:148`). "Login" only hides a div (`:269`) — bypassed via DevTools
  or view-source in one line. No JWT/session/API call.
- **C-A2. Confidential hotel name leaked (Rule #7):** `:239`
  `name:'The Horizon Hotel Batam', loc:'Nagoya, Batam'`.
- **C-A3. Monthly yield module (Rule #3):** `:693-707` ("Monthly rental
  income", "Monthly Revenue $58,308", per-token `price*yld/100/12`), 70% of
  **gross revenue** not NOI.
- **C-A4. Non-$10 BRICK prices (Rule #1):** `:240-242` $2.40/$1.75/$3.20.
- **C-A5. Entirely non-functional:** all admin actions (`:749-817`) mutate
  in-memory arrays and toast success; `:680` admits "Edit connects to backend
  API in production." No `fetch` to any `/api/admin/*` route exists.
- **H-A1.** Hotel supply `tokens:1200000` = $12M (`:239`) vs $18.5M /
  1,850,000 implied by budget.
- **H-A2.** Round minimums `min:50` (`:246-247`) conflict with the $100 rule.
- **H-A3.** Round targets sum to $3.24M vs stated $2M (`:245-247`).
- **H-A4.** Treasury wallet addresses hardcoded in client JS (`:221-224`) and
  "editable" via the fake settings flow — funds-redirection risk.
- **H-A5.** Fake tx-hash generator in confirm prompt (`:770`
  `'0x'+Math.random()…`) — encourages fabricating on-chain evidence.
- **M-A1.** CSV injection in `exportWallets` (`:865-874`) — no escaping of `"`
  or leading `= + - @`.
- **M-A2.** `mk()` `innerHTML` branch (`:303`) is a latent XSS sink (not
  exploitable today; current rendering uses `textContent`).
- **M-A3.** Analytics page fully hardcoded (`:475-509`); KYC card shows static
  "Uploaded ✓" with no real document to review (`:557-558`).

---

## 6. MISSING FEATURES / GAPS vs. CLAUDE.md

- **Telegram bot** (`brickx-telegram-bot.js`) referenced in CLAUDE.md is
  **not in the v4 package** — cannot be audited or fixed until provided.
- **Marketplace buy/settlement endpoint** missing on the backend (only
  `/api/marketplace/list` exists); no path collects the 0.5% platform fee.
- **Annual snapshot job** missing: schema has `annual_snapshots` and the Dec-31
  cron *claims* snapshots are "taken automatically at midnight", but no code
  writes them (`server.js:1120` only emails the admin).
- **`dividend_receipts` never populated**: the distribute endpoint records a
  `yield_distributions` row but creates no per-holder receipts and executes no
  USDC transfers.
- **Referral activation** never implemented (bonuses stay `pending` forever).

---

## 7. RECOMMENDED FIX ORDER

1. **Reconcile the product model first.** Decide whether the live product is
   the single confidential Batam hotel (backend/db/whitepaper/landing) or the
   multi-property marketplace (React app + admin panel). All of C-F3/4/5,
   C-W1/2, C-A2/3/4, C-S4 stem from this. Recommendation: make the React app
   and admin panel match the backend — one confidential property, $10 fixed,
   annual June dividend, correct ICO numbers, no hotel name.
2. **Stop the money-loss / fund-redirection paths:** enable RLS + write
   policies on all tables (esp. `ico_settings` treasury — C-D1), verify the
   Sumsub webhook signature (C-B1), fix payment-monitor sender matching +
   `tx_hash` idempotency + processed-block cursor (C-B2/3), and remove or
   implement ETH/BNB monitoring (C-B4).
3. **Smart contracts:** either adopt OpenZeppelin and implement real
   transfers + reentrancy guards + SafeERC20 + true ERC-1155 + snapshot-based
   yield + immutable 70/30 split (C-S1/2/3/5, H-S1/2/4), or clearly label the
   file a non-deployable reference skeleton. Fix vesting cliff math (H-S3).
4. **Backend hardening:** env validation at boot (C-B5), CORS allowlist +
   `trust proxy`, central error/404 handlers, request logging, DB health
   check, input-validation layer, use audited NOI in dividend calc (H-B1),
   per-round caps (H-B5), per-round max enforcement (H-B2).
5. **Frontend data layer:** real API client, wire auth/KYC/orders to the
   backend, remove in-browser password handling, the demo-approve button, and
   all fabricated stats/countdowns; align KYC gating with the backend.
6. **Polish:** pagination, missing indexes + constraints, structured logging,
   named constants, two-step ownership, tests.

---

*Audit complete. No source files were modified by this audit. Per the master
prompt, confirm scope — especially item #1, the product-model reconciliation —
before any fixes are applied.*
  