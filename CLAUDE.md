# BRICKX PROTOCOL — CLAUDE CODE MEMORY FILE
# Copy this as CLAUDE.md in your project root

## PROJECT OVERVIEW
BRICKX Protocol — Real estate tokenization platform on Polygon blockchain.
Southeast Asia focus. Two-phase model. Annual dividend (June each year).

## TECH STACK
- Frontend: React 18 + Vite + Tailwind CSS
- Backend: Node.js + Express + Supabase (PostgreSQL)
- Blockchain: Polygon (Ethers.js v5)
- Smart Contracts: Solidity 0.8.20 + OpenZeppelin
- Auth: JWT + bcryptjs
- KYC: Sumsub
- Email: Resend
- Payment Detection: Polygon + BNB Smart Chain RPC auto-detect
- Deploy: Vercel (frontend) + Railway (backend)

## TWO-PHASE STRATEGY (CRITICAL — never change)
### Phase 1: BRX ICO (Active)
- Seed: $0.008/BRX | Round 1: $0.015 | Round 2: $0.022 | DEX: $0.030
- Total raise target: $2,000,000 USD
- BRX total supply: 1,000,000,000 (fixed forever)
- Min investment: $100 | Max: $50,000 per wallet
- Payment: USDT/USDC (Polygon), USDT (BNB Smart Chain), ETH, BNB

### Phase 2: Hotel Token (After ICO)
- Acquire existing operating hotel in Batam, Indonesia
- Budget: up to $18,500,000 USD (= Rp 300 Billion)
- BRICK token: $10.00 FIXED PRICE — NEVER changes
- Annual dividend: 70% NOI → holders, paid June each year
- Fiscal close: December 31 | Audit: Jan-Mar | Announce: April | Pay: June

## FILES — LATEST VERSIONS (v4 package, in brickx/)
### Frontend
- brickx/frontend/landing-page.html    ← Latest landing page (full English, $18.5M)
- brickx/frontend/whitelist-page.html  ← Pre-launch email capture
- brickx/frontend/admin-panel.html     ← Admin panel (browser-based)
- brickx/frontend/platform-app.jsx     ← React platform app (latest)

### Backend
- brickx/backend/server.js             ← LATEST backend (two-phase, annual dividend)
- brickx/backend/database-schema.sql   ← LATEST schema (annual dividend tables)

### Blockchain
- brickx/contracts/src/BRICKXContracts.sol ← 5 Solidity contracts for Polygon (Hardhat project in brickx/contracts/)

### Bot
- brickx/bot/brickx-telegram-bot.js    ← Telegram bot (live API stats, rate-limited)

### Docs & Marketing
- brickx/docs/                         ← Whitepaper v2, Pitch Deck v4, Financial Model v3
- brickx/marketing/Social_Content_Pack_v3.html

## KEY CONSTANTS (never change these values)
```javascript
const PHASE = {
  SEED_PRICE:        0.008,
  ROUND1_PRICE:      0.015,
  ROUND2_PRICE:      0.022,
  DEX_PRICE:         0.030,
  ICO_TOTAL_TARGET:  2_000_000,
  SEED_HARD_CAP:     640_000,
  MIN_INVESTMENT:    100,
  MAX_INVESTMENT:    50_000,
  HOTEL_BUDGET_MAX:  18_500_000,
  BRICK_TOKEN_PRICE: 10.00,        // FIXED FOREVER
  NOI_HOLDER_SHARE:  0.70,         // 70% to holders
  NOI_PROTOCOL:      0.30,         // 30% to protocol
  PLATFORM_FEE:      0.005,        // 0.5% marketplace
  DIVIDEND_MONTH:    6,            // June
  FISCAL_CLOSE:      12,           // December
  EXCHANGE_RATE_IDR: 16200,        // Rp per USD
};
```

## DATABASE TABLES (v3)
- users
- ico_orders
- referral_bonuses
- properties
- token_holdings
- market_listings
- yield_distributions      ← Annual dividend tracking
- dividend_receipts        ← USDC payments to holders
- annual_snapshots         ← Dec 31 holder snapshots
- ico_settings
- audit_logs

## API ENDPOINTS
### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET  /api/auth/me
- PUT  /api/auth/wallet

### KYC
- POST /api/kyc/init
- POST /api/kyc/webhook
- GET  /api/kyc/status

### ICO (Phase 1)
- GET  /api/ico/info
- POST /api/ico/order
- GET  /api/ico/orders

### Marketplace (Phase 2)
- GET  /api/marketplace/properties
- GET  /api/marketplace/listings
- POST /api/marketplace/list

### Dividend (Phase 2)
- GET  /api/dividend/schedule
- GET  /api/dividend/history/:propertyId
- GET  /api/dividend/portfolio

### Admin
- GET  /api/admin/dashboard
- GET  /api/admin/users
- PATCH /api/admin/kyc/:userId
- PATCH /api/admin/orders/:orderId/confirm
- POST /api/admin/distribute/batch
- POST /api/admin/dividend/distribute
- GET  /api/admin/settings
- PATCH /api/admin/settings
- GET  /api/admin/audit

### Health
- GET  /api/health

## SMART CONTRACTS (Polygon)
1. BRXToken.sol        — ERC-20 governance token
2. BRXVesting.sol      — Cliff + linear vesting
3. BRXICOVault.sol     — Payment + KYC whitelist
4. BRICKToken.sol      — ERC-1155 property tokens ($10 fixed)
5. YieldDistributor.sol — Annual USDC dividend distribution

## ENVIRONMENT VARIABLES REQUIRED
```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://brickxprotocol.io
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
JWT_SECRET=
RESEND_API_KEY=
EMAIL_FROM=noreply@brickxprotocol.io
ADMIN_EMAIL=admin@brickxprotocol.io
SUMSUB_APP_TOKEN=
SUMSUB_SECRET_KEY=
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org
TREASURY_USDT_POLYGON=
TREASURY_USDC_POLYGON=
TREASURY_ETH=
TREASURY_BNB=
TREASURY_USDT_BSC=
BRX_TOKEN_ADDRESS=
BRICK_TOKEN_ADDRESS=
ICO_VAULT_ADDRESS=
YIELD_DISTRIBUTOR_ADDRESS=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=@BRICKXProtocol
ADMIN_TELEGRAM_IDS=
BRICKX_API_URL=https://brickx-api.railway.app
```

## CRON JOBS
- Every 3 min: Polygon payment monitor (USDT/USDC detection)
- Dec 31 8AM WIB: Fiscal year close reminder
- Jun 1 8AM WIB: Dividend payment reminder
- Daily 9AM WIB: Telegram channel update
- Monday 10AM WIB: Weekly Telegram update

## KNOWN ISSUES TO FIX
- [ ] Backend still has older version mixed with v3 logic
- [ ] Schema missing some v3 annual dividend indexes
- [ ] React app (brickx-v3.jsx) uses mock data — needs real API calls
- [ ] Admin panel uses DOM-only — no API integration yet
- [ ] Telegram bot ICO.raised is hardcoded — needs live API fetch
- [ ] Smart contracts not yet deployed (testnet pending)
- [ ] Missing error boundaries in React components
- [ ] No loading states on several API calls
- [ ] CORS not configured for all environments

## BRAND COLORS
```css
--bg:     #020509
--bg1:    #060D18
--bg2:    #0A1628
--blue:   #1A56DB
--blueL:  #3B82F6
--teal:   #14B8A6
--green:  #10B981
--gold:   #F59E0B
--white:  #FFFFFF
--off:    #E2E8F0
--muted:  #64748B
```

## DEPLOY TARGETS
- Frontend (3 sites): Vercel (free)
- Backend API: Railway (~$5/month)
- Database: Supabase (free tier → Pro after 100 users)
- Bot: Railway (same project as backend)
- Domain: brickxprotocol.io (.io preferred for crypto)
