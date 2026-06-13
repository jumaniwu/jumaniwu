// ════════════════════════════════════════════════════════════════
// BRICKX PROTOCOL — BACKEND API v3.0
// Two-Phase Model: BRX ICO Ecosystem → Hotel Token Annual Dividend
// Node.js + Express + Supabase + Polygon Blockchain Monitoring
// ════════════════════════════════════════════════════════════════
//
// PHASE 1: BRX ICO (Active)
//   - Seed $0.008/BRX, Round 1 $0.015, Round 2 $0.022, DEX $0.030
//   - Total raise target: $2,000,000 USD
//   - Payment: USDT/USDC/ETH/BNB → treasury wallet
//   - Auto-detect on Polygon via ethers.js every 3 minutes
//
// PHASE 2: Hotel Token (After ICO Complete)
//   - Acquire existing hotel Batam: budget up to $18.5M USD
//   - Issue BRICK tokens at $10.00 fixed price
//   - Annual dividend: 70% NOI → holders, paid June each year
//   - Fiscal close: December 31 → Audit Q1 → Announce April → Pay June
//
// Run:  node src/index.js
// Deps: npm install express cors helmet bcryptjs jsonwebtoken dotenv
//       npm install @supabase/supabase-js resend axios express-rate-limit
//       npm install node-cron ethers morgan
// ════════════════════════════════════════════════════════════════

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cron       = require('node-cron');
const crypto     = require('crypto');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
const rateLimit  = require('express-rate-limit');
const axios      = require('axios');
require('dotenv').config();

// ── ENV VALIDATION (fail fast) ────────────────────────────────
// Required: server cannot run safely without these.
const REQUIRED_ENV = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
// Normalize common paste mistakes (surrounding quotes, stray whitespace).
for (const k of REQUIRED_ENV) {
  if (process.env[k]) process.env[k] = process.env[k].trim().replace(/^['"]+|['"]+$/g, '');
}
const missingRequired = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingRequired.length) {
  console.error(`[Startup] FATAL — missing required environment variables: ${missingRequired.join(', ')}`);
  console.error('[Startup] Set them in your .env file or hosting environment, then restart.');
  process.exit(1);
}
if (!/^https:\/\/[^\s/]+\.supabase\.co\/?$/i.test(process.env.SUPABASE_URL)) {
  console.error(`[Startup] FATAL — SUPABASE_URL is not a valid Supabase project URL (got: "${process.env.SUPABASE_URL}").`);
  console.error('[Startup] It must look like https://xxxxxxxx.supabase.co — copy "Project URL" from Supabase Dashboard → Settings → API. Do NOT paste a key here.');
  process.exit(1);
}
// Recommended: warn only — features degrade gracefully without these.
const RECOMMENDED_ENV = [
  'RESEND_API_KEY',
  'SUMSUB_APP_TOKEN', 'SUMSUB_SECRET_KEY', 'SUMSUB_WEBHOOK_SECRET',
  'TREASURY_USDT_POLYGON', 'TREASURY_USDC_POLYGON', 'TREASURY_ETH', 'TREASURY_BNB',
];
RECOMMENDED_ENV.filter(k => !process.env[k]).forEach(k => {
  console.warn(`[Startup] WARN — environment variable ${k} not set (related feature disabled or degraded)`);
});
// Default to the production site so email links never render "undefined".
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://brickxprotocol.io';

// ── INIT ─────────────────────────────────────────────────────
const app     = express();
// Only construct the Resend client when a key is present — the SDK throws on
// an empty/undefined key. sendEmail() already no-ops when the key is missing.
const resend  = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_key'
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
// supabase-js eagerly builds a Realtime client and requires a WebSocket
// implementation: native on Node >= 22, the `ws` package otherwise. We don't
// use Realtime, but without a transport the constructor throws on Node 20.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { persistSession: false },
    realtime: { transport: require('ws') },
  }
);

// ── CONSTANTS ─────────────────────────────────────────────────
const PHASE = {
  // Phase 1: BRX ICO
  ICO_ROUNDS: {
    seed:    { price: 0.008, cap: 640_000,   tokens: 80_000_000,  lock_months: 12, vest_months: 24 },
    round1:  { price: 0.015, cap: 1_500_000, tokens: 100_000_000, lock_months: 3,  vest_months: 12 },
    round2:  { price: 0.022, cap: 1_100_000, tokens: 50_000_000,  lock_months: 3,  vest_months: 9  },
    dex:     { price: 0.030, cap: 0,         tokens: 0,           lock_months: 0,  vest_months: 0  },
  },
  ICO_TOTAL_TARGET:  2_000_000,  // USD
  BRX_TOTAL_SUPPLY:  1_000_000_000,
  MIN_INVESTMENT:    100,        // USD
  MAX_INVESTMENT:    50_000,     // USD per wallet per round
  REFERRAL_BONUS:    500,        // BRX per referral

  // Phase 2: Hotel Token
  HOTEL_BUDGET_MAX:  18_500_000, // USD ($18.5M = Rp 300B at 16,200)
  BRICK_TOKEN_PRICE: 10.00,      // USD fixed — never changes
  NOI_HOLDER_SHARE:  0.70,       // 70% to holders
  NOI_PROTOCOL_SHARE:0.30,       // 30% to protocol
  PLATFORM_FEE_RATE: 0.005,      // 0.5% marketplace fee

  // Dividend calendar
  FISCAL_CLOSE_MONTH: 12,        // December 31 = fiscal year close
  DIVIDEND_PAY_MONTH: 6,         // June = dividend payment month
};

// Treasury wallets (set via Admin Panel → Settings)
const TREASURY = {
  usdt_polygon: process.env.TREASURY_USDT_POLYGON || '',
  usdc_polygon: process.env.TREASURY_USDC_POLYGON || '',
  eth_mainnet:  process.env.TREASURY_ETH          || '',
  bnb_chain:    process.env.TREASURY_BNB           || '',
};

// Token contract addresses (set after deployment)
const CONTRACTS = {
  brx_token:          process.env.BRX_TOKEN_ADDRESS        || '',
  brick_token:        process.env.BRICK_TOKEN_ADDRESS       || '',
  ico_vault:          process.env.ICO_VAULT_ADDRESS         || '',
  yield_distributor:  process.env.YIELD_DISTRIBUTOR_ADDRESS || '',
};

// ── MIDDLEWARE ─────────────────────────────────────────────────
app.set('trust proxy', 1); // Behind Railway/Vercel proxy — needed for rate limiting & IPs
app.use(helmet());

// CORS — explicit allowlist; reject unknown browser origins.
// Requests with no Origin header (curl, health checks, server-to-server) are allowed.
// brickxprotocol.io and all its subdomains (www, whitelist, app, admin panel)
// are always allowed; EXTRA_CORS_ORIGINS covers temporary *.vercel.app URLs
// during setup (comma-separated).
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  ...(process.env.EXTRA_CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)*brickxprotocol\.io$/i;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl / health checks / same-origin
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGIN_PATTERN.test(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// JSON body parsing — 1mb is plenty for API payloads.
// `verify` captures the raw body so webhook HMAC signatures can be checked.
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined')); // Request logging

// Rate limiting
const limiter     = rateLimit({ windowMs: 15*60*1000, max: 100, message: { error: 'Too many requests' } });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 10,  message: { error: 'Too many login attempts' } });
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// ── AUTH MIDDLEWARE ────────────────────────────────────────────
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users').select('*').eq('id', decoded.id).single();
    if (error || !user) return res.status(401).json({ error: 'User not found' });
    if (!user.is_active) return res.status(403).json({ error: 'Account suspended' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    next();
  });
};

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  // Ping the database so the health check reflects real availability
  let dbStatus = 'ok';
  try {
    const { error } = await supabase.from('ico_settings').select('id').limit(1);
    if (error) dbStatus = 'error';
  } catch (e) {
    dbStatus = 'error';
  }
  res.status(dbStatus === 'ok' ? 200 : 503).json({
    status:  dbStatus === 'ok' ? 'ok' : 'degraded',
    db:      dbStatus,
    version: '3.0.0',
    phase:   'Phase 1 — BRX ICO Active',
    model:   'Two-Phase: ICO Ecosystem → Hotel Annual Dividend',
    timestamp: new Date().toISOString(),
  });
});

// ════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, country, referralCode } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password minimum 8 characters' });
    }

    // Check duplicate email — neutral message to limit email enumeration.
    // Whitelist pre-registrations (no password yet) are upgraded in place.
    const { data: existing } = await supabase
      .from('users').select('id, password_hash, referral_code').eq('email', email.toLowerCase()).single();
    if (existing && existing.password_hash !== 'WHITELIST_PENDING') {
      return res.status(409).json({ error: 'Unable to register with this email' });
    }
    if (existing) {
      const passwordHash = await bcrypt.hash(password, 12);
      const { data: upgraded, error: upErr } = await supabase.from('users').update({
        first_name:    firstName,
        last_name:     lastName,
        password_hash: passwordHash,
        country:       country || '',
        is_active:     true,
      }).eq('id', existing.id).select().single();
      if (upErr) throw upErr;
      const token = jwt.sign({ id: upgraded.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      return res.status(201).json({ token, user: sanitizeUser(upgraded), message: 'Registration successful' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Find referrer
    let referredBy = null;
    if (referralCode) {
      const { data: referrer } = await supabase
        .from('users').select('id').eq('referral_code', referralCode).single();
      if (referrer) referredBy = referrer.id;
    }

    // Create user — retry up to 3x on referral_code unique-violation (23505)
    let user = null;
    let myReferralCode = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      myReferralCode = generateReferralCode();
      const { data, error } = await supabase.from('users').insert({
        first_name:    firstName,
        last_name:     lastName,
        email:         email.toLowerCase(),
        password_hash: passwordHash,
        country:       country || '',
        kyc_status:    'not_started',
        referral_code: myReferralCode,
        referred_by:   referredBy,
        is_active:     true,
        is_admin:      false,
      }).select().single();

      if (!error) { user = data; break; }
      if (error.code === '23505' && /referral_code/.test(error.message || '')) continue; // collision — regenerate
      throw error;
    }
    if (!user) throw new Error('Failed to generate unique referral code after 3 attempts');

    // Send welcome email
    await sendEmail(email, 'Welcome to BRICKX Protocol — Seed Sale Access', `
      <h2>Welcome to BRICKX, ${firstName}!</h2>
      <p>Your account is created. Next step: complete KYC to unlock seed purchase.</p>
      <h3>BRX Seed Price: $0.008 / BRX</h3>
      <p><strong>Your referral code: ${myReferralCode}</strong><br>
      Share and earn 500 BRX per friend who completes a seed purchase.</p>
      <h3>Phase 1 — BRX ICO (Live Now)</h3>
      <ul>
        <li>Seed: $0.008/BRX (you are here)</li>
        <li>Round 1: $0.015/BRX (+87.5%)</li>
        <li>DEX launch: $0.030/BRX (+275%)</li>
      </ul>
      <h3>Phase 2 — Hotel Token (After ICO)</h3>
      <p>We are acquiring an existing operating hotel in Batam, Indonesia (budget up to $18.5M USD).
      BRICK tokens at $10.00 fixed price. Annual dividend paid each June — 70% of Net Operating Income to holders.</p>
      <p><a href="${process.env.FRONTEND_URL}/kyc">Complete KYC Now →</a></p>
    `);

    // Grant referral bonus if applicable
    if (referredBy) {
      await supabase.from('referral_bonuses').insert({
        referrer_id:  referredBy,
        referred_id:  user.id,
        bonus_brx:    PHASE.REFERRAL_BONUS,
        status:       'pending', // activates when referred user makes first purchase
      });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: sanitizeUser(user), message: 'Registration successful' });

  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data: user, error } = await supabase
      .from('users').select('*').eq('email', email.toLowerCase()).single();
    if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.is_active) return res.status(403).json({ error: 'Account suspended. Contact support.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Update last login
    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: sanitizeUser(user) });

  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// PUT /api/auth/wallet
app.put('/api/auth/wallet', auth, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid Polygon wallet address' });
    }

    // Check if wallet already registered to another user
    const { data: existing } = await supabase
      .from('users').select('id').eq('wallet_address', walletAddress).single();
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ error: 'Wallet already registered to another account' });
    }

    const { error } = await supabase
      .from('users').update({ wallet_address: walletAddress }).eq('id', req.user.id);
    if (error) throw error;

    res.json({ success: true, message: 'Wallet address registered. You are now eligible for BRX airdrop.' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update wallet' });
  }
});

// ════════════════════════════════════════════════════════════════
// KYC ROUTES
// ════════════════════════════════════════════════════════════════

// POST /api/kyc/init — Start Sumsub KYC session
app.post('/api/kyc/init', auth, async (req, res) => {
  try {
    if (req.user.kyc_status === 'approved') {
      return res.json({ status: 'approved', message: 'KYC already approved' });
    }

    // Create Sumsub applicant (see Sumsub docs for full implementation)
    const applicantId = `brickx_${req.user.id}_${Date.now()}`;
    const accessToken = await createSumsubToken(applicantId, req.user.email);

    await supabase.from('users').update({
      kyc_status:      'in_progress',
      kyc_applicant_id: applicantId,
    }).eq('id', req.user.id);

    res.json({ accessToken, applicantId, expiresAt: Date.now() + 3600000 });
  } catch (e) {
    console.error('KYC init error:', e);
    res.status(500).json({ error: 'Failed to initialize KYC' });
  }
});

// POST /api/kyc/webhook — Sumsub sends result here
// Verified via x-payload-digest = HMAC-SHA256(rawBody, SUMSUB_WEBHOOK_SECRET)
app.post('/api/kyc/webhook', async (req, res) => {
  try {
    // ── Webhook signature verification ──
    const webhookSecret = process.env.SUMSUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Missing secret: only acceptable outside production (local/dev testing)
      if (process.env.NODE_ENV === 'production') {
        console.error('[KYC] Webhook rejected — SUMSUB_WEBHOOK_SECRET not configured in production');
        return res.status(401).json({ error: 'Webhook verification not configured' });
      }
      console.warn('[KYC] SUMSUB_WEBHOOK_SECRET not set — skipping signature verification (non-production only)');
    } else {
      const digestHeader = req.headers['x-payload-digest'];
      if (!digestHeader || !req.rawBody) {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.rawBody)
        .digest('hex');
      const expectedBuf = Buffer.from(expected, 'utf8');
      const receivedBuf = Buffer.from(String(digestHeader), 'utf8');
      if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
        console.error('[KYC] Webhook rejected — invalid x-payload-digest signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const { type, applicantId, reviewResult } = req.body;

    if (type === 'applicantReviewed' || type === 'applicantWorkflowCompleted') {
      const reviewAnswer = reviewResult?.reviewAnswer;
      const newStatus = reviewAnswer === 'GREEN' ? 'approved' : 'rejected';

      const { data: user } = await supabase
        .from('users').select('*').eq('kyc_applicant_id', applicantId).single();

      if (user) {
        await supabase.from('users').update({ kyc_status: newStatus }).eq('id', user.id);

        const subject = newStatus === 'approved'
          ? 'KYC Approved — You Can Now Purchase BRX'
          : 'KYC Requires Attention — Action Needed';

        const body = newStatus === 'approved'
          ? `<h2>KYC Approved!</h2><p>You are now cleared to purchase BRX at $0.008/BRX seed price. Minimum $100. Log in to complete your purchase.</p><p><a href="${process.env.FRONTEND_URL}/buy">Buy BRX Now →</a></p>`
          : `<h2>KYC Requires Attention</h2><p>Your verification could not be completed. Please re-submit with a clear photo of your ID and a live selfie. Contact support@brickxprotocol.io if you need help.</p>`;

        await sendEmail(user.email, subject, body);
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error('KYC webhook error:', e);
    res.status(200).json({ received: true }); // Always 200 to Sumsub
  }
});

// GET /api/kyc/status
app.get('/api/kyc/status', auth, async (req, res) => {
  res.json({
    status:      req.user.kyc_status,
    applicantId: req.user.kyc_applicant_id,
    walletSet:   !!req.user.wallet_address,
  });
});

// ════════════════════════════════════════════════════════════════
// ICO ORDER ROUTES (PHASE 1 — BRX)
// ════════════════════════════════════════════════════════════════

// Round config comes from ico_settings (admin-editable) with PHASE constants
// as fallbacks, so prices/caps/schedule can be changed without a redeploy.
function liveRoundConfig(settings) {
  const s = settings || {};
  const num = (v, fb) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : fb; };
  const rounds = {
    seed:   { price: num(s.seed_price_usd,   PHASE.ICO_ROUNDS.seed.price),
              cap:   num(s.seed_hard_cap_usd, PHASE.ICO_ROUNDS.seed.cap) },
    round1: { price: num(s.round1_price_usd,  PHASE.ICO_ROUNDS.round1.price),
              cap:   num(s.round1_hard_cap_usd, PHASE.ICO_ROUNDS.round1.cap) },
    round2: { price: num(s.round2_price_usd,  PHASE.ICO_ROUNDS.round2.price),
              cap:   num(s.round2_hard_cap_usd, PHASE.ICO_ROUNDS.round2.cap) },
    dex:    { price: num(s.dex_target_price_usd, PHASE.ICO_ROUNDS.dex.price), cap: 0 },
  };
  const activeRound = rounds[s.active_round] ? s.active_round : 'seed';
  const saleStatus  = ['live', 'paused', 'upcoming'].includes(s.sale_status) ? s.sale_status : 'upcoming';
  const startsAt    = s.sale_starts_at ? new Date(s.sale_starts_at) : null;
  const saleOpen    = saleStatus === 'live' && (!startsAt || Date.now() >= startsAt.getTime());
  return {
    rounds, activeRound, saleStatus, saleStartsAt: startsAt ? startsAt.toISOString() : null, saleOpen,
    minInvestment: num(s.min_investment_usd, PHASE.MIN_INVESTMENT),
    maxInvestment: num(s.max_investment_usd, PHASE.MAX_INVESTMENT),
    totalTarget:   num(s.ico_total_target_usd, PHASE.ICO_TOTAL_TARGET),
  };
}

// GET /api/ico/info — Current round info
app.get('/api/ico/info', async (req, res) => {
  try {
    const { data: settings } = await supabase
      .from('ico_settings').select('*').single();
    const cfg = liveRoundConfig(settings);

    const { data: roundStats } = await supabase
      .from('ico_orders')
      .select('usd_amount, brx_allocated, status')
      .in('status', ['confirmed', 'distributed']);

    const totalRaised = (roundStats || []).reduce((s, o) => s + (o.usd_amount || 0), 0);
    const totalBrx    = (roundStats || []).reduce((s, o) => s + (o.brx_allocated || 0), 0);

    // Percent filled is measured against the ACTIVE round's hard cap
    const activeRound = cfg.activeRound;
    const activeCap   = cfg.rounds[activeRound].cap || cfg.totalTarget;

    res.json({
      phase:          'Phase 1 — BRX ICO',
      activeRound,
      saleStatus:     cfg.saleStatus,
      saleStartsAt:   cfg.saleStartsAt,
      saleOpen:       cfg.saleOpen,
      seedPrice:      cfg.rounds.seed.price,
      round1Price:    cfg.rounds.round1.price,
      round2Price:    cfg.rounds.round2.price,
      dexTargetPrice: cfg.rounds.dex.price,
      activeRoundPrice: cfg.rounds[activeRound].price,
      minInvestment:  cfg.minInvestment,
      maxInvestment:  cfg.maxInvestment,
      totalRaised,
      totalTarget:    cfg.totalTarget,
      seedHardCap:    cfg.rounds.seed.cap,
      activeRoundCap: activeCap,
      totalBrxSold:   totalBrx,
      percentFilled:  ((totalRaised / activeCap) * 100).toFixed(1),
      treasuryWallets: TREASURY,
      // Phase 2 info
      phase2: {
        description:    'Hotel Token — After ICO Complete',
        hotelBudgetUSD: PHASE.HOTEL_BUDGET_MAX,
        brickPrice:     PHASE.BRICK_TOKEN_PRICE,
        dividendMonth:  'June each year',
        holdersShare:   '70% of Net Operating Income',
        status:         'Upcoming — hotel identification in progress',
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch ICO info' });
  }
});

// POST /api/ico/order — Create purchase order
app.post('/api/ico/order', auth, async (req, res) => {
  try {
    const { usdAmount, cryptoCurrency } = req.body;

    if (req.user.kyc_status !== 'approved') {
      return res.status(403).json({ error: 'KYC must be approved before purchasing. Please complete verification first.' });
    }
    if (!req.user.wallet_address) {
      return res.status(400).json({ error: 'Please register your Polygon wallet address before purchasing.' });
    }

    // Sale gate + active round price/cap come from admin-managed settings
    const { data: settings } = await supabase.from('ico_settings').select('*').single();
    const cfg = liveRoundConfig(settings);
    if (!cfg.saleOpen) {
      const when = cfg.saleStartsAt
        ? ` The sale opens at ${cfg.saleStartsAt}.`
        : '';
      return res.status(403).json({ error: `The token sale is not open yet.${when} Join the whitelist to be notified.` });
    }

    const amount = parseFloat(usdAmount);
    if (isNaN(amount) || amount < cfg.minInvestment) {
      return res.status(400).json({ error: `Minimum investment is $${cfg.minInvestment} USDC` });
    }
    if (amount > cfg.maxInvestment) {
      return res.status(400).json({ error: `Maximum investment is $${cfg.maxInvestment.toLocaleString()} USDC per wallet` });
    }

    const activeRound = cfg.activeRound;
    const pricePerBrx = cfg.rounds[activeRound].price;
    const roundCap    = cfg.rounds[activeRound].cap;

    // Check wallet investment total for this round (max $50,000 per wallet PER ROUND)
    const { data: existingOrders } = await supabase
      .from('ico_orders')
      .select('usd_amount')
      .eq('user_id', req.user.id)
      .eq('round', activeRound)
      .in('status', ['pending_payment', 'confirmed', 'distributed']);

    const alreadyInvested = (existingOrders || []).reduce((s, o) => s + o.usd_amount, 0);
    if (alreadyInvested + amount > cfg.maxInvestment) {
      return res.status(400).json({
        error: `Maximum $${cfg.maxInvestment.toLocaleString()} per wallet per round. You have already invested $${alreadyInvested.toLocaleString()} in the ${activeRound} round.`
      });
    }

    // Enforce the active round's hard cap (pending orders count to prevent oversell)
    const { data: roundOrders } = await supabase
      .from('ico_orders')
      .select('usd_amount')
      .eq('round', activeRound)
      .in('status', ['pending_payment', 'confirmed', 'distributed']);

    const roundRaised = (roundOrders || []).reduce((s, o) => s + o.usd_amount, 0);
    if (roundRaised + amount > roundCap) {
      const remaining = Math.max(roundCap - roundRaised, 0);
      return res.status(400).json({
        error: `The ${activeRound} round hard cap of $${roundCap.toLocaleString()} would be exceeded. Remaining capacity: $${remaining.toLocaleString()}.`
      });
    }

    // Calculate BRX allocation
    const brxAllocated = Math.floor(amount / pricePerBrx);
    const orderId = 'ORD-' + Date.now();

    // Get treasury wallet for selected crypto
    const cryptoMap = {
      'USDT/Polygon': TREASURY.usdt_polygon,
      'USDC/Polygon': TREASURY.usdc_polygon,
      'ETH':          TREASURY.eth_mainnet,
      'BNB':          TREASURY.bnb_chain,
    };
    const payToAddress = cryptoMap[cryptoCurrency] || TREASURY.usdt_polygon;

    // Create order
    const { data: order, error } = await supabase.from('ico_orders').insert({
      order_id:       orderId,
      user_id:        req.user.id,
      usd_amount:     amount,
      brx_allocated:  brxAllocated,
      crypto_currency: cryptoCurrency,
      pay_to_address: payToAddress,
      round:          activeRound,
      price_per_brx:  pricePerBrx,
      status:         'pending_payment',
      wallet_address: req.user.wallet_address,
    }).select().single();

    if (error) throw error;

    // Send payment instructions
    await sendEmail(req.user.email, `Order ${orderId} — Payment Instructions`, `
      <h2>Your BRX Order — Payment Required</h2>
      <table>
        <tr><td>Order ID</td><td>${orderId}</td></tr>
        <tr><td>Amount</td><td>$${amount.toLocaleString()} USD</td></tr>
        <tr><td>BRX Allocated</td><td>${brxAllocated.toLocaleString()} BRX</td></tr>
        <tr><td>Price per BRX</td><td>$${pricePerBrx.toFixed(3)}</td></tr>
        <tr><td>Round</td><td>${activeRound.toUpperCase()}</td></tr>
      </table>
      <h3>Send ${cryptoCurrency} to:</h3>
      <p><strong>${payToAddress}</strong></p>
      <p><strong>Important:</strong> pay from your registered wallet
      (<strong>${req.user.wallet_address}</strong>) so we can auto-confirm your payment on-chain
      within ~5 minutes. Payments sent from an exchange or a different wallet are still credited,
      but are confirmed manually within 24 hours.</p>
      <p>BRX tokens will be distributed to wallet: <strong>${req.user.wallet_address}</strong> at TGE.</p>
    `);

    res.status(201).json({
      orderId,
      usdAmount:     amount,
      brxAllocated,
      pricePerBrx,
      round:         activeRound,
      payTo:         payToAddress,
      currency:      cryptoCurrency,
      message:       `Send $${amount} in ${cryptoCurrency} to the address above. Transaction auto-detected on-chain.`,
    });

  } catch (e) {
    console.error('Order error:', e);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/ico/orders — User's orders
app.get('/api/ico/orders', auth, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('ico_orders')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const totalInvested = (orders || [])
      .filter(o => ['confirmed','distributed'].includes(o.status))
      .reduce((s, o) => s + o.usd_amount, 0);

    const totalBrx = (orders || [])
      .filter(o => ['confirmed','distributed'].includes(o.status))
      .reduce((s, o) => s + o.brx_allocated, 0);

    res.json({ orders: orders || [], totalInvested, totalBrx });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ════════════════════════════════════════════════════════════════
// MARKETPLACE ROUTES (PHASE 2 — BRICK HOTEL TOKENS)
// ════════════════════════════════════════════════════════════════

// GET /api/marketplace/properties
app.get('/api/marketplace/properties', async (req, res) => {
  try {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with latest dividend info
    const enriched = await Promise.all((properties || []).map(async (p) => {
      const { data: dividends } = await supabase
        .from('yield_distributions')
        .select('*')
        .eq('property_id', p.id)
        .order('payment_year', { ascending: false })
        .limit(3);

      return {
        ...p,
        token_price: PHASE.BRICK_TOKEN_PRICE, // Fixed $10.00 always
        dividend_model: 'Annual — 70% NOI paid each June',
        dividend_history: dividends || [],
        status_note: p.status === 'upcoming'
          ? 'Token sale opens after ICO complete'
          : p.status,
      };
    }));

    res.json({ properties: enriched });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// GET /api/marketplace/listings
app.get('/api/marketplace/listings', async (req, res) => {
  try {
    const { property_id } = req.query;
    let query = supabase
      .from('market_listings')
      .select('*, users!seller_id(first_name, last_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (property_id) query = query.eq('property_id', property_id);

    const { data: listings, error } = await query;
    if (error) throw error;

    // Enforce fixed price on all listings
    const normalized = (listings || []).map(l => ({
      ...l,
      price_per_token: PHASE.BRICK_TOKEN_PRICE, // Always $10.00
      total_value:     l.token_amount * PHASE.BRICK_TOKEN_PRICE,
    }));

    res.json({ listings: normalized });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// POST /api/marketplace/list — List BRICK tokens for sale
app.post('/api/marketplace/list', auth, async (req, res) => {
  try {
    if (req.user.kyc_status !== 'approved') {
      return res.status(403).json({ error: 'KYC required to list tokens' });
    }

    const { propertyId, tokenAmount } = req.body;
    if (!propertyId || !tokenAmount || tokenAmount < 1) {
      return res.status(400).json({ error: 'Property ID and token amount required (minimum 1)' });
    }

    // Verify user owns enough tokens
    const { data: holding } = await supabase
      .from('token_holdings')
      .select('balance')
      .eq('user_id', req.user.id)
      .eq('property_id', propertyId)
      .single();

    if (!holding || holding.balance < tokenAmount) {
      return res.status(400).json({ error: 'Insufficient token balance' });
    }

    // Price is ALWAYS fixed at $10.00 — no speculative pricing allowed
    // (total_value is a GENERATED column in Postgres — never insert it)
    const { data: listing, error } = await supabase.from('market_listings').insert({
      seller_id:       req.user.id,
      property_id:     propertyId,
      token_amount:    tokenAmount,
      price_per_token: PHASE.BRICK_TOKEN_PRICE, // Enforced fixed price
      status:          'active',
    }).select().single();

    if (error) throw error;
    res.status(201).json({ listing, message: `Listed ${tokenAmount} BRICK tokens at $${PHASE.BRICK_TOKEN_PRICE.toFixed(2)} each` });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// POST /api/marketplace/buy — Buy a marketplace listing at the fixed $10.00 price
// Off-chain bookkeeping for Phase 2; on-chain settlement happens via BRICKToken.buyListing.
app.post('/api/marketplace/buy', auth, async (req, res) => {
  try {
    if (req.user.kyc_status !== 'approved') {
      return res.status(403).json({ error: 'KYC required to buy tokens' });
    }
    const { listingId } = req.body;
    if (!listingId) return res.status(400).json({ error: 'Listing ID required' });

    const { data: listing } = await supabase
      .from('market_listings').select('*').eq('id', listingId).single();
    if (!listing || listing.status !== 'active') {
      return res.status(404).json({ error: 'Listing not found or no longer active' });
    }
    if (listing.seller_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot buy your own listing' });
    }

    const totalCost = listing.token_amount * PHASE.BRICK_TOKEN_PRICE; // always $10.00/token
    const fee       = totalCost * PHASE.PLATFORM_FEE_RATE;            // 0.5% marketplace fee

    // Mark listing sold (guard against double-buy via the status filter)
    const { data: sold, error: sellErr } = await supabase
      .from('market_listings')
      .update({ status: 'sold', buyer_id: req.user.id, sold_at: new Date().toISOString() })
      .eq('id', listingId)
      .eq('status', 'active')
      .select().single();
    if (sellErr || !sold) return res.status(409).json({ error: 'Listing was just sold' });

    // Move balances: decrement seller, increment buyer
    const { data: sellerHolding } = await supabase
      .from('token_holdings').select('*')
      .eq('user_id', listing.seller_id).eq('property_id', listing.property_id).single();
    if (sellerHolding) {
      await supabase.from('token_holdings')
        .update({ balance: Math.max(sellerHolding.balance - listing.token_amount, 0) })
        .eq('id', sellerHolding.id);
    }
    const { data: buyerHolding } = await supabase
      .from('token_holdings').select('*')
      .eq('user_id', req.user.id).eq('property_id', listing.property_id).single();
    if (buyerHolding) {
      await supabase.from('token_holdings')
        .update({ balance: buyerHolding.balance + listing.token_amount })
        .eq('id', buyerHolding.id);
    } else {
      await supabase.from('token_holdings').insert({
        user_id:     req.user.id,
        property_id: listing.property_id,
        balance:     listing.token_amount,
        cost_basis:  PHASE.BRICK_TOKEN_PRICE,
      });
    }

    res.json({
      success:   true,
      tokens:    listing.token_amount,
      pricePerToken: PHASE.BRICK_TOKEN_PRICE,
      totalCost,
      platformFee: fee,
      message:   `Purchased ${listing.token_amount.toLocaleString()} BRICK tokens at $${PHASE.BRICK_TOKEN_PRICE.toFixed(2)} each`,
    });
  } catch (e) {
    console.error('Marketplace buy error:', e.message);
    res.status(500).json({ error: 'Purchase failed' });
  }
});

// ════════════════════════════════════════════════════════════════
// ANNUAL DIVIDEND ROUTES (PHASE 2)
// ════════════════════════════════════════════════════════════════

// GET /api/dividend/schedule — Dividend calendar info
app.get('/api/dividend/schedule', async (req, res) => {
  res.json({
    model:            'Annual Dividend',
    holders_share:    '70% of Net Operating Income',
    protocol_share:   '30% of Net Operating Income',
    fiscal_year_end:  'December 31',
    audit_period:     'January – March (independent auditor)',
    announcement:     'April (dividend per token announced)',
    payment_month:    'June (USDC auto-transferred to all holders)',
    payment_method:   'USDC on Polygon (smart contract — no claim needed)',
    snapshot_date:    'December 31 (holders at this date receive dividend)',
    minimum_holding:  '1 BRICK token',
    note:             'Hotel name confidential until acquisition closes. First dividend: June 2028 (for FY2027).',
  });
});

// GET /api/dividend/history/:propertyId
app.get('/api/dividend/history/:propertyId', async (req, res) => {
  try {
    const { data: distributions, error } = await supabase
      .from('yield_distributions')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .order('payment_year', { ascending: false });

    if (error) throw error;
    res.json({ distributions: distributions || [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch dividend history' });
  }
});

// GET /api/dividend/portfolio — User's dividend earnings
app.get('/api/dividend/portfolio', auth, async (req, res) => {
  try {
    const { data: holdings } = await supabase
      .from('token_holdings')
      .select('*, properties(name, status)')
      .eq('user_id', req.user.id);

    const { data: received } = await supabase
      .from('dividend_receipts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('paid_at', { ascending: false });

    const totalDividendReceived = (received || []).reduce((s, d) => s + d.usdc_amount, 0);
    const totalTokensHeld = (holdings || []).reduce((s, h) => s + h.balance, 0);
    const portfolioValue  = totalTokensHeld * PHASE.BRICK_TOKEN_PRICE;

    res.json({
      holdings:               holdings || [],
      dividendHistory:        received || [],
      totalTokensHeld,
      portfolioValueUSD:      portfolioValue,
      totalDividendReceived,
      nextDividendMonth:      'June',
      note: 'Dividend paid automatically to your wallet each June. No manual claim required.',
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// ════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════════════════════════════

// GET /api/admin/dashboard
app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  try {
    const [users, orders, properties, settings] = await Promise.all([
      supabase.from('users').select('id, kyc_status, created_at, wallet_address'),
      supabase.from('ico_orders').select('usd_amount, brx_allocated, status, created_at'),
      supabase.from('properties').select('id, name, status'),
      supabase.from('ico_settings').select('*').single(),
    ]);

    const confirmedOrders = (orders.data || []).filter(o => ['confirmed','distributed'].includes(o.status));
    const totalRaised  = confirmedOrders.reduce((s, o) => s + o.usd_amount, 0);
    const totalBrxSold = confirmedOrders.reduce((s, o) => s + o.brx_allocated, 0);

    res.json({
      phase:          'Phase 1 — BRX ICO Active',
      phase2Status:   'Hotel identification in progress. Budget: up to $18.5M USD.',
      totalUsers:     (users.data || []).length,
      kycApproved:    (users.data || []).filter(u => u.kyc_status === 'approved').length,
      kycPending:     (users.data || []).filter(u => u.kyc_status === 'pending').length,
      walletsSet:     (users.data || []).filter(u => u.wallet_address).length,
      totalRaised,
      seedTarget:     PHASE.ICO_ROUNDS.seed.cap,
      totalRaiseTarget: PHASE.ICO_TOTAL_TARGET,
      percentFilled:  ((totalRaised / (PHASE.ICO_ROUNDS[settings.data?.active_round || 'seed']?.cap || PHASE.ICO_ROUNDS.seed.cap)) * 100).toFixed(1) + '%',
      totalBrxSold,
      pendingOrders:  (orders.data || []).filter(o => o.status === 'pending_payment').length,
      confirmedOrders: confirmedOrders.length,
      properties:     (properties.data || []).length,
      activeRound:    settings.data?.active_round || 'seed',
      brickTokenPrice: PHASE.BRICK_TOKEN_PRICE,
      dividendMonth:  'June',
    });
  } catch (e) {
    res.status(500).json({ error: 'Dashboard error' });
  }
});

// GET /api/admin/orders — paginated order list for the admin panel
app.get('/api/admin/orders', adminAuth, async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    let query = supabase
      .from('ico_orders')
      .select('*, users(first_name, last_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, count, error } = await query;
    if (error) throw error;
    res.json({ orders: data || [], total: count || 0, page, limit });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/admin/users
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, country, kyc_status, wallet_address, referral_code, created_at, last_login, is_active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ users: users || [], total: (users || []).length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/kyc/:userId
app.patch('/api/admin/kyc/:userId', adminAuth, async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const { data: user } = await supabase
      .from('users').select('*').eq('id', req.params.userId).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    await supabase.from('users').update({ kyc_status: status }).eq('id', req.params.userId);

    // Log action
    await supabase.from('audit_logs').insert({
      admin_id:    req.user.id,
      action:      `kyc_${status}`,
      target_type: 'user',
      target_id:   req.params.userId,
      details:     reason || `KYC ${status} by admin`,
    });

    const emailSubject = status === 'approved'
      ? 'KYC Approved — You Can Now Purchase BRX'
      : 'KYC Update — Action Required';

    const emailBody = status === 'approved'
      ? `<h2>KYC Approved!</h2><p>You are cleared to purchase BRX at $0.008 seed price. Minimum $100.</p><p><a href="${process.env.FRONTEND_URL}/buy">Buy BRX Now →</a></p>`
      : `<h2>KYC Could Not Be Completed</h2><p>Reason: ${reason || 'Document unclear'}. Please resubmit with a clear ID photo and selfie.</p><p>Contact support@brickxprotocol.io for assistance.</p>`;

    await sendEmail(user.email, emailSubject, emailBody);

    res.json({ success: true, message: `KYC ${status} for ${user.first_name} ${user.last_name}` });
  } catch (e) {
    res.status(500).json({ error: 'KYC update failed' });
  }
});

// PATCH /api/admin/orders/:orderId/confirm
app.patch('/api/admin/orders/:orderId/confirm', adminAuth, async (req, res) => {
  try {
    const { txHash } = req.body;
    if (!txHash) return res.status(400).json({ error: 'Transaction hash required' });

    const { data: order } = await supabase
      .from('ico_orders').select('*, users(*)').eq('order_id', req.params.orderId).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ error: 'Order is not in pending_payment status' });
    }

    await supabase.from('ico_orders').update({
      status:   'confirmed',
      tx_hash:  txHash,
      confirmed_at: new Date().toISOString(),
    }).eq('order_id', req.params.orderId);

    await supabase.from('audit_logs').insert({
      admin_id:    req.user.id,
      action:      'payment_confirmed',
      target_type: 'order',
      target_id:   req.params.orderId,
      details:     `Tx: ${txHash} | $${order.usd_amount} | ${order.brx_allocated.toLocaleString()} BRX`,
    });

    await sendEmail(order.users.email, `Order ${order.order_id} — Payment Confirmed`, `
      <h2>Payment Confirmed!</h2>
      <p>Your payment of $${order.usd_amount.toLocaleString()} has been confirmed on-chain.</p>
      <p><strong>${order.brx_allocated.toLocaleString()} BRX</strong> is allocated to your wallet.<br>
      Tokens will be distributed to <strong>${order.wallet_address}</strong> at TGE.</p>
      <p>Tx: ${txHash}</p>
    `);

    res.json({ success: true, message: `Order ${req.params.orderId} confirmed. ${order.brx_allocated.toLocaleString()} BRX allocated.` });
  } catch (e) {
    res.status(500).json({ error: 'Order confirmation failed' });
  }
});

// POST /api/admin/distribute/batch — Distribute BRX to multiple wallets
app.post('/api/admin/distribute/batch', adminAuth, async (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || !orderIds.length) {
      return res.status(400).json({ error: 'Order IDs required' });
    }

    const results = [];
    for (const orderId of orderIds) {
      const { data: order } = await supabase
        .from('ico_orders').select('*, users(*)').eq('order_id', orderId).single();

      if (!order || order.status !== 'confirmed') {
        results.push({ orderId, success: false, error: 'Not found or not confirmed' });
        continue;
      }

      await supabase.from('ico_orders').update({
        status: 'distributed',
        distributed_at: new Date().toISOString(),
      }).eq('order_id', orderId);

      await supabase.from('audit_logs').insert({
        admin_id:    req.user.id,
        action:      'brx_distributed',
        target_type: 'order',
        target_id:   orderId,
        details:     `${order.brx_allocated.toLocaleString()} BRX → ${order.wallet_address}`,
      });

      await sendEmail(order.users.email, 'BRX Tokens Distributed to Your Wallet', `
        <h2>BRX Tokens Distributed!</h2>
        <p><strong>${order.brx_allocated.toLocaleString()} BRX</strong> has been sent to:<br>
        <code>${order.wallet_address}</code></p>
        <p>Lock period: 12 months. Vesting: 24 months linear after lock.</p>
        <h3>What's Next?</h3>
        <p>Phase 2 — Hotel Token: We are acquiring an operating hotel in Batam (budget up to $18.5M USD).
        BRICK tokens at $10 fixed price. Annual dividend paid June each year — 70% of Net Operating Income to holders.</p>
        <p>You will be notified when the hotel acquisition closes and BRICK token sale opens.</p>
      `);

      results.push({ orderId, success: true, brxAmount: order.brx_allocated, wallet: order.wallet_address });
    }

    const successful = results.filter(r => r.success).length;
    res.json({ results, successful, failed: results.length - successful });
  } catch (e) {
    res.status(500).json({ error: 'Distribution failed' });
  }
});

// POST /api/admin/dividend/distribute — Annual dividend distribution (Phase 2)
app.post('/api/admin/dividend/distribute', adminAuth, async (req, res) => {
  try {
    const { propertyId, fiscalYear, grossRevenue, totalTokensInCirculation } = req.body;

    if (!propertyId || !fiscalYear || !grossRevenue || !totalTokensInCirculation) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const noi           = grossRevenue * 0.55; // Estimated NOI margin — update with actual audited figure
    const holdersPool   = noi * PHASE.NOI_HOLDER_SHARE;
    const protocolShare = noi * PHASE.NOI_PROTOCOL_SHARE;
    const perToken      = holdersPool / totalTokensInCirculation;
    const apy           = (perToken / PHASE.BRICK_TOKEN_PRICE) * 100;

    // Record distribution
    const { data: dist, error } = await supabase.from('yield_distributions').insert({
      property_id:              propertyId,
      fiscal_year:              fiscalYear,
      gross_revenue:            grossRevenue,
      noi:                      noi,
      holders_pool_usdc:        holdersPool,
      protocol_share_usdc:      protocolShare,
      per_token_usdc:           perToken,
      apy_percent:              apy,
      tokens_in_circulation:    totalTokensInCirculation,
      fiscal_close_date:        `${fiscalYear}-12-31`,
      payment_date:             `${fiscalYear + 1}-06-01`,
      status:                   'scheduled',
    }).select().single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      admin_id:    req.user.id,
      action:      'dividend_scheduled',
      target_type: 'property',
      target_id:   propertyId,
      details:     `FY${fiscalYear}: $${holdersPool.toFixed(0)} pool, $${perToken.toFixed(4)}/token, ${apy.toFixed(2)}% APY`,
    });

    res.json({
      distribution:     dist,
      holdersPool:      holdersPool,
      perTokenDividend: perToken,
      protocolShare,
      apy:              apy.toFixed(2) + '%',
      paymentDate:      `June ${fiscalYear + 1}`,
      message:          `Annual dividend for FY${fiscalYear} scheduled. Payment: June ${fiscalYear + 1}. $${perToken.toFixed(4)} per BRICK token.`,
    });
  } catch (e) {
    res.status(500).json({ error: 'Dividend scheduling failed' });
  }
});

// GET /api/admin/settings
app.get('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('ico_settings').select('*').single();
    if (error) throw error;
    res.json({ settings: data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PATCH /api/admin/settings
app.patch('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const allowed = [
      'active_round','treasury_usdt_polygon','treasury_usdc_polygon',
      'treasury_eth','treasury_bnb','brx_token_address','brick_token_address',
      'ico_vault_address','yield_distributor_address','kyc_required',
      'platform_fee_rate','tge_date','referral_bonus_brx',
      // Dynamic sale management (round pricing, caps, limits, schedule)
      'sale_status','sale_starts_at',
      'seed_price_usd','round1_price_usd','round2_price_usd','dex_target_price_usd',
      'seed_hard_cap_usd','round1_hard_cap_usd','round2_hard_cap_usd',
      'min_investment_usd','max_investment_usd','ico_total_target_usd',
    ];
    const NUMERIC_POSITIVE = [
      'seed_price_usd','round1_price_usd','round2_price_usd','dex_target_price_usd',
      'seed_hard_cap_usd','round1_hard_cap_usd','round2_hard_cap_usd',
      'min_investment_usd','max_investment_usd','ico_total_target_usd','referral_bonus_brx',
    ];

    const updates = {};
    Object.keys(req.body).forEach(k => { if (allowed.includes(k)) updates[k] = req.body[k]; });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    // Validate before touching the database
    for (const k of Object.keys(updates)) {
      if (NUMERIC_POSITIVE.includes(k)) {
        const n = parseFloat(updates[k]);
        if (!Number.isFinite(n) || n <= 0) {
          return res.status(400).json({ error: `${k} must be a positive number` });
        }
        updates[k] = n;
      }
    }
    if (updates.sale_status && !['upcoming','live','paused'].includes(updates.sale_status)) {
      return res.status(400).json({ error: "sale_status must be 'upcoming', 'live', or 'paused'" });
    }
    if (updates.active_round && !['seed','round1','round2','dex'].includes(updates.active_round)) {
      return res.status(400).json({ error: "active_round must be 'seed', 'round1', 'round2', or 'dex'" });
    }
    if (updates.sale_starts_at) {
      const d = new Date(updates.sale_starts_at);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'sale_starts_at must be a valid date/time' });
      updates.sale_starts_at = d.toISOString();
    } else if (updates.sale_starts_at === '' || updates.sale_starts_at === null) {
      updates.sale_starts_at = null; // clear the schedule
    }

    const { error } = await supabase.from('ico_settings').update(updates).eq('id', 1);
    if (error) throw error;

    // Log each change
    for (const [key, value] of Object.entries(updates)) {
      await supabase.from('audit_logs').insert({
        admin_id:    req.user.id,
        action:      'setting_updated',
        target_type: 'setting',
        target_id:   key,
        details:     `Updated to: ${String(value).slice(0, 80)}`,
      });
    }

    res.json({ success: true, updated: Object.keys(updates) });
  } catch (e) {
    res.status(500).json({ error: 'Settings update failed' });
  }
});

// GET /api/admin/audit
app.get('/api/admin/audit', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, users!admin_id(first_name, last_name, email)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    res.json({ logs: data || [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ════════════════════════════════════════════════════════════════
// BLOCKCHAIN PAYMENT MONITOR — POLYGON (Every 3 minutes)
// ════════════════════════════════════════════════════════════════
const polygonProvider = new ethers.providers.JsonRpcProvider(
  process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
);

// USDT & USDC ABI (Transfer event)
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// Each entry is one ERC-20 contract to watch. Both USDC variants are listed
// because most wallets now send native USDC, not the older bridged USDC.e.
const POLYGON_TOKENS = [
  { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 }, // USDT
  { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 }, // bridged USDC.e
  { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359', decimals: 6 }, // native USDC
];

async function checkPendingPayments() {
  try {
    const { data: pending } = await supabase
      .from('ico_orders')
      .select('*')
      .eq('status', 'pending_payment')
      .in('crypto_currency', ['USDT/Polygon', 'USDC/Polygon'])
      .gt('created_at', new Date(Date.now() - 72 * 3600000).toISOString()); // Last 72 hours

    if (!pending || !pending.length) return;

    const currentBlock = await polygonProvider.getBlockNumber();
    const fromBlock = currentBlock - 150; // ~5 minutes of blocks

    for (const token of POLYGON_TOKENS) {
      const { symbol: tokenSymbol, address: tokenAddress, decimals } = token;
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, polygonProvider);

      const treasuryAddr = tokenSymbol === 'USDT'
        ? TREASURY.usdt_polygon
        : TREASURY.usdc_polygon;

      if (!treasuryAddr || !ethers.utils.isAddress(treasuryAddr)) continue;

      const filter = contract.filters.Transfer(null, treasuryAddr);
      const events = await contract.queryFilter(filter, fromBlock, currentBlock);

      for (const event of events) {
        const fromAddr  = event.args.from.toLowerCase();
        const valueRaw  = event.args.value;
        const valueUSD  = parseFloat(ethers.utils.formatUnits(valueRaw, decimals));

        // Match on amount (±1%) AND the sender wallet equalling the order's
        // registered wallet. Amount alone is unsafe: round numbers like $100
        // collide across users and would confirm the wrong order. Payments that
        // match the amount but come from a different address (e.g. an exchange)
        // are deliberately left pending for the admin to confirm manually.
        const matchingOrder = pending.find(o => {
          if (!o.crypto_currency.includes(tokenSymbol)) return false;
          const pct = Math.abs(o.usd_amount - valueUSD) / o.usd_amount;
          if (pct >= 0.01) return false;
          return o.wallet_address && o.wallet_address.toLowerCase() === fromAddr;
        });

        if (matchingOrder) {
          await supabase.from('ico_orders').update({
            status:       'confirmed',
            tx_hash:      event.transactionHash,
            confirmed_at: new Date().toISOString(),
          }).eq('order_id', matchingOrder.order_id);

          const { data: user } = await supabase
            .from('users').select('*').eq('id', matchingOrder.user_id).single();

          if (user) {
            await sendEmail(user.email, `Order ${matchingOrder.order_id} — Payment Confirmed On-Chain`, `
              <h2>Payment Detected & Confirmed!</h2>
              <p>Transaction detected on Polygon Network:</p>
              <p>Amount: $${valueUSD.toFixed(2)} ${tokenSymbol}<br>
              Tx Hash: ${event.transactionHash}<br>
              BRX Allocated: ${matchingOrder.brx_allocated.toLocaleString()} BRX</p>
              <p>Your BRX will be distributed to wallet:<br>
              <strong>${matchingOrder.wallet_address}</strong><br>
              at Token Generation Event (TGE).</p>
            `);
          }

          console.log(`[PaymentMonitor] Confirmed: ${matchingOrder.order_id} | $${valueUSD} ${tokenSymbol} | Tx: ${event.transactionHash}`);
        }
      }
    }
  } catch (e) {
    console.error('[PaymentMonitor] Error:', e.message);
  }
}

// Run every 3 minutes
cron.schedule('*/3 * * * *', checkPendingPayments);

// ════════════════════════════════════════════════════════════════
// ANNUAL DIVIDEND REMINDER (Cron — runs December 31 and June 1)
// ════════════════════════════════════════════════════════════════

// December 31 — notify admin to run audit
cron.schedule('0 8 31 12 *', async () => {
  console.log('[Dividend] Fiscal year close — December 31. Admin: run year-end audit.');
  // Send reminder to admin
  if (process.env.ADMIN_EMAIL) {
    await sendEmail(process.env.ADMIN_EMAIL, 'BRICKX — Fiscal Year Close: Action Required', `
      <h2>Fiscal Year Close — December 31</h2>
      <p>BRICKX hotel fiscal year has closed. Required actions:</p>
      <ol>
        <li>Compile hotel P&L for the full year</li>
        <li>Engage independent auditor</li>
        <li>Snapshot BRICK token holder wallets (taken automatically at midnight)</li>
        <li>Complete audit by March → Announce dividend April → Pay June</li>
      </ol>
      <p>Use Admin Panel → Yield Distribution to record annual figures.</p>
    `);
  }
});

// June 1 — remind admin to execute dividend payment
cron.schedule('0 8 1 6 *', async () => {
  console.log('[Dividend] June 1 — Annual dividend payment month. Admin: execute USDC transfers.');
  if (process.env.ADMIN_EMAIL) {
    await sendEmail(process.env.ADMIN_EMAIL, 'BRICKX — June Dividend Payment Due', `
      <h2>Annual Dividend Payment — June</h2>
      <p>It is time to execute the annual USDC dividend payment to all BRICK token holders.</p>
      <p>Steps:
      <ol>
        <li>Go to Admin Panel → Yield Distribution</li>
        <li>Verify final audited figures</li>
        <li>Execute smart contract distribution</li>
        <li>Send confirmation emails to all holders</li>
      </ol>
      </p>
    `);
  }
});

// ── HELPERS ───────────────────────────────────────────────────
function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

async function sendEmail(to, subject, htmlBody) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_key') {
    console.log(`[Email] ${to}: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({
      from:    process.env.EMAIL_FROM || 'noreply@brickxprotocol.io',
      to,
      subject,
      html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#020509;color:#E2E8F0;padding:32px;max-width:600px;margin:0 auto;">
        <div style="background:#0A1628;border:1px solid rgba(26,86,219,.2);border-radius:14px;padding:28px;">
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#fff;margin-bottom:20px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:14px;">
            BRICK<span style="color:#3B82F6">X</span> Protocol
          </div>
          ${htmlBody}
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);font-size:11px;color:#475569;">
            BRICKX Protocol · brickxprotocol.io · seed@brickxprotocol.io<br>
            This is not financial advice. Investment involves risk.
          </div>
        </div>
      </body></html>`,
    });
  } catch (e) {
    console.error('[Email] Failed:', e.message);
  }
}

async function createSumsubToken(applicantId, email) {
  if (!process.env.SUMSUB_APP_TOKEN) return 'demo_token_' + Date.now();
  // Full Sumsub implementation: https://developers.sumsub.com/api-reference
  const ts = Math.floor(Date.now() / 1000);
  const crypto = require('crypto');
  const sig = crypto
    .createHmac('sha256', process.env.SUMSUB_SECRET_KEY)
    .update(ts + 'POST' + `/resources/accessTokens?userId=${applicantId}&levelName=basic-kyc-level`)
    .digest('hex');

  const response = await axios.post(
    `https://api.sumsub.com/resources/accessTokens?userId=${applicantId}&levelName=basic-kyc-level`,
    {},
    { headers: { 'X-App-Token': process.env.SUMSUB_APP_TOKEN, 'X-App-Access-Sig': sig, 'X-App-Access-Ts': ts } }
  );
  return response.data.token;
}

// ════════════════════════════════════════════════════════════════
// PUBLIC WHITELIST CAPTURE (landing + whitelist pages POST here)
// ════════════════════════════════════════════════════════════════
app.post('/api/whitelist', async (req, res) => {
  try {
    const { email, name, country, referral } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    // Store as a pre-registration user row (no password yet)
    const cleanEmail = String(email).toLowerCase().slice(0, 254);
    const { data: existing } = await supabase
      .from('users').select('id, referral_code').eq('email', cleanEmail).single();
    if (existing) {
      return res.json({ success: true, message: 'You are already on the whitelist.', referralCode: existing.referral_code });
    }
    const referralCode = 'BRX-' + require('crypto').randomBytes(4).toString('hex').toUpperCase();
    const { error } = await supabase.from('users').insert({
      first_name:    String(name || 'Whitelist').slice(0, 80),
      last_name:     '-',
      email:         cleanEmail,
      password_hash: 'WHITELIST_PENDING', // replaced when the user completes registration
      country:       String(country || '').slice(0, 80),
      kyc_status:    'not_started',
      referral_code: referralCode,
      is_active:     false, // activated when full registration completes
      is_admin:      false,
    });
    if (error) throw error;

    // Thank-you email with live sale details (price/schedule follow admin settings)
    const { data: icoSettings } = await supabase.from('ico_settings').select('*').single();
    const cfg = liveRoundConfig(icoSettings);
    const seedPrice = cfg.rounds.seed.price;
    const opensTxt = cfg.saleStartsAt
      ? new Date(cfg.saleStartsAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
      : null;
    const firstName = String(name || '').trim().split(/\s+/)[0];
    await sendEmail(cleanEmail, 'Thank you for joining the BRICKX whitelist 🎉', `
      <h2 style="color:#fff;margin-bottom:14px">You're on the whitelist — thank you!</h2>
      <p>Hi ${firstName || 'there'},</p>
      <p>Thank you for joining the <strong>BRICKX Protocol whitelist</strong>. You're officially early —
      and that comes with <strong>priority access</strong> to the BRX Seed Sale at
      <strong>$${seedPrice}/BRX</strong>, the lowest price the token will ever be offered at.</p>
      <div style="background:#0A1628;border:1px solid rgba(245,158,11,.35);border-radius:12px;padding:16px 20px;margin:20px 0;text-align:center">
        <div style="font-size:11px;color:#94A3B8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Your referral code</div>
        <div style="font-size:24px;font-weight:800;color:#F59E0B;font-family:'Courier New',monospace;letter-spacing:1px">${referralCode}</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:6px">Share it with friends — you earn bonus BRX when they invest.</div>
      </div>
      <h3 style="color:#fff">What happens next</h3>
      <ol style="line-height:1.9">
        <li>${opensTxt
          ? `The seed sale opens on <strong>${opensTxt}</strong> — mark your calendar.`
          : 'We will email you the moment the seed sale opens.'}</li>
        <li>Create your account at <a href="https://app.brickxprotocol.io" style="color:#3B82F6">app.brickxprotocol.io</a> using this same email address.</li>
        <li>Complete KYC verification — it takes about 5 minutes.</li>
        <li>Invest from as little as <strong>$100</strong> — USDT, USDC, ETH, and BNB accepted.</li>
      </ol>
      <p>Questions? Our community is here:
      <a href="https://t.me/brickxprotocol" style="color:#3B82F6">t.me/brickxprotocol</a></p>
      <p style="margin-top:18px">— The BRICKX Protocol Team</p>
    `);
    res.status(201).json({ success: true, referralCode });
  } catch (e) {
    console.error('Whitelist error:', e.message);
    res.status(500).json({ error: 'Could not join whitelist. Please try again.' });
  }
});

// ── 404 + CENTRAL ERROR HANDLERS (keep last, before listen) ───
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Error]', req.method, req.path, err.message);
  res.status(err.status || 500).json({ error: 'Internal server error' }); // never expose stack traces
});

// ── START SERVER ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 BRICKX API v3.0 — running on port ${PORT}`);
  console.log(`📋 Phase 1: BRX ICO — Seed $0.008/BRX | Target: $2,000,000`);
  console.log(`🏨 Phase 2: Hotel Batam — Budget up to $18.5M USD`);
  console.log(`💰 Dividend: Annual, paid June each year (70% NOI → holders)`);
  console.log(`🔗 Polygon network · USDT/USDC auto-detection every 3 min\n`);
});

module.exports = app;
