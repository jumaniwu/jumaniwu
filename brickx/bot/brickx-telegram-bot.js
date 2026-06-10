// ════════════════════════════════════════════════════════════════
// BRICKX PROTOCOL — TELEGRAM BOT v1.0
// Complete investor-facing bot for the BRICKX community
//
// FEATURES:
//   /start          — Welcome + quick menu
//   /buy            — How to buy BRX (step by step)
//   /price          — Current ICO round prices
//   /whitepaper     — Whitepaper link
//   /status         — Seed sale progress live
//   /dividend       — Annual dividend model explained
//   /hotel          — Project Hotel Batam info
//   /kyc            — KYC guide
//   /wallet         — How to set up Polygon wallet
//   /faq            — Frequently asked questions
//   /referral       — Referral program info
//   /roadmap        — Project roadmap
//   /contact        — Support contacts
//   /calc           — Dividend calculator (interactive)
//
// SETUP:
//   1. Message @BotFather on Telegram → /newbot
//   2. Get your BOT_TOKEN
//   3. npm install node-telegram-bot-api axios dotenv node-cron
//   4. Set BOT_TOKEN in .env
//   5. node bot.js
//
// DEPLOY: Railway.app → same project as API backend (free tier ok)
// ════════════════════════════════════════════════════════════════

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const cron = require("node-cron");
require("dotenv").config();

// ── CONFIG ───────────────────────────────────────────────────
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID    = process.env.TELEGRAM_CHANNEL_ID   || "@BRICKXProtocol";
const ADMIN_IDS     = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(Number).filter(Boolean);
const API_URL       = process.env.BRICKX_API_URL        || "https://brickx-api.railway.app";
const SUPPORT_EMAIL = "support@brickxprotocol.io";
const WEBSITE       = "https://brickxprotocol.io";
const WHITEPAPER    = "https://docs.brickxprotocol.io";

// ── ICO DATA (display constants — live raise comes from the API) ─
const ICO = {
  currentRound:   "seed",
  seedPrice:      0.008,
  round1Price:    0.015,
  round2Price:    0.022,
  dexPrice:       0.030,
  seedCap:        640000,
  totalTarget:    2000000,
  minInvest:      100,
  maxInvest:      50000,
};

const HOTEL = {
  budget:     18500000,
  tokenPrice: 10.00,
  apy:        "5.1%",
  location:   "Batam Island, Indonesia",
  dividend:   "June (annually)",
  holdersShare: "70% of NOI",
};

// ── INIT BOT ─────────────────────────────────────────────────
if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN not set in .env");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("🤖 BRICKX Bot starting...");

// ── USER STATE (for multi-step calculator) ───────────────────
const userState = new Map();

// ════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════

function pct(raised, cap) {
  return ((raised / cap) * 100).toFixed(1);
}

function progressBar(pct, len) {
  len = len || 20;
  var filled = Math.round((pct / 100) * len);
  var bar = "█".repeat(filled) + "░".repeat(len - filled);
  return bar;
}

function formatUSD(n) {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return "$" + Math.round(n).toLocaleString();
  return "$" + n.toFixed(2);
}

async function fetchLiveStats() {
  try {
    const res = await axios.get(API_URL + "/api/ico/info", { timeout: 5000 });
    return res.data;
  } catch (e) {
    return null;
  }
}

function sendMsg(chatId, text, opts) {
  return bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    ...opts,
  }).catch(function(e) {
    console.error("[Bot] sendMessage failed:", e.message);
  });
}

function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

// ── PER-USER RATE LIMIT (anti-spam) ──────────────────────────
// Max 15 interactions per user per minute; silently dropped beyond that.
const rateBuckets = new Map();
function rateLimited(userId) {
  const now = Date.now();
  let b = rateBuckets.get(userId);
  if (!b || now - b.windowStart > 60000) {
    b = { windowStart: now, count: 0 };
    rateBuckets.set(userId, b);
  }
  b.count++;
  return b.count > 15;
}
setInterval(function() {
  const cutoff = Date.now() - 120000;
  rateBuckets.forEach(function(b, id) { if (b.windowStart < cutoff) rateBuckets.delete(id); });
}, 300000);

// ── KNOWN CHATS (for /broadcast — in-memory, resets on restart) ─
const knownChats = new Set();

// ── GLOBAL COMMAND GUARD ─────────────────────────────────────
// Every command handler gets: per-user rate limiting, chat registration
// (for /broadcast), and error containment so one bad update can't crash
// the bot.
const _onText = bot.onText.bind(bot);
bot.onText = function(regex, handler) {
  _onText(regex, function(msg, match) {
    if (msg.from && rateLimited(msg.from.id)) return;
    knownChats.add(msg.chat.id);
    try {
      const r = handler(msg, match);
      if (r && typeof r.catch === "function") r.catch(function(e) { console.error("[Bot] handler:", e.message); });
    } catch (e) {
      console.error("[Bot] handler error:", e.message);
    }
  });
};

// ── MAIN KEYBOARD ────────────────────────────────────────────
const MAIN_KEYBOARD = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🌱 Buy BRX",     callback_data: "cmd_buy" },
        { text: "💰 Price",        callback_data: "cmd_price" },
      ],
      [
        { text: "📊 Sale Status",  callback_data: "cmd_status" },
        { text: "🏨 Hotel Info",   callback_data: "cmd_hotel" },
      ],
      [
        { text: "💵 Dividend",     callback_data: "cmd_dividend" },
        { text: "🧮 Calculator",   callback_data: "cmd_calc" },
      ],
      [
        { text: "🔍 KYC Guide",    callback_data: "cmd_kyc" },
        { text: "🗺️ Roadmap",      callback_data: "cmd_roadmap" },
      ],
      [
        { text: "❓ FAQ",          callback_data: "cmd_faq" },
        { text: "📄 Whitepaper",   callback_data: "cmd_whitepaper" },
      ],
      [
        { text: "🤝 Referral",     callback_data: "cmd_referral" },
        { text: "📞 Support",      callback_data: "cmd_contact" },
      ],
    ],
  },
};

const BACK_BTN = {
  reply_markup: {
    inline_keyboard: [[
      { text: "⬅️ Back to Menu", callback_data: "cmd_menu" },
    ]],
  },
};

// ════════════════════════════════════════════════════════════════
// MESSAGE TEMPLATES
// ════════════════════════════════════════════════════════════════

const MSG = {

  // ── WELCOME ────────────────────────────────────────────────
  welcome: function(name) {
    return `🏨 *Welcome to BRICKX Protocol, ${name}!*

Real estate tokenized on-chain.
Own hotel fractions from *$100*.
Earn annual dividend in USDC every June.

━━━━━━━━━━━━━━━━━━━
🟢 *BRX Seed Sale: LIVE NOW*
💰 Price: *$0.008/BRX*
📈 DEX target: *$0.030 (+275%)*
🏨 Hotel budget: *$18.5M USD*
━━━━━━━━━━━━━━━━━━━

Choose an option below or use these commands:
/buy · /price · /status · /dividend
/hotel · /kyc · /faq · /calc

🌐 ${WEBSITE}`;
  },

  // ── BUY GUIDE ──────────────────────────────────────────────
  buy: `🌱 *How to Buy BRX — Step by Step*

━━━━━━━━━━━━━━━━━━━
*STEP 1: Register*
→ Go to ${WEBSITE}
→ Create account with email
→ Set a strong password

*STEP 2: Add Your Wallet*
→ Add your Polygon wallet address
→ This wallet will receive BRX at TGE
→ Also receives USDC annual dividend
→ Recommend: MetaMask or Trust Wallet

*STEP 3: Complete KYC*
→ Click "Start KYC Verification"
→ Upload government ID (passport/KTP/SIM)
→ Take live selfie
→ Approval: 5–30 minutes
→ 80+ countries supported

*STEP 4: Send Payment*
→ Choose amount (min *$100*, max *$50,000*)
→ Send to BRICKX treasury wallet
→ Accepted: USDT · USDC · ETH · BNB
→ *Recommended: USDT on Polygon (cheapest + fastest)*

*STEP 5: Confirmed!*
→ System auto-detects your payment on-chain
→ Email confirmation sent
→ BRX allocated → distributed at TGE

━━━━━━━━━━━━━━━━━━━
⚡ *Pro Tip:* Use USDT/USDC on Polygon network
→ Gas fee only ~$0.01
→ Confirmed in ~2 minutes
━━━━━━━━━━━━━━━━━━━

🌐 ${WEBSITE}`,

  // ── PRICE ──────────────────────────────────────────────────
  price: `💰 *BRX Token — Price Progression*

🟡 *SEED (NOW)*     → *$0.008/BRX*
📌 Current round — lowest price ever

🔵 Round 1 (NEXT)  → $0.015/BRX *(+87.5%)*
🔵 Round 2          → $0.022/BRX *(+175%)*
🟣 DEX Launch       → $0.030/BRX *(+275%)*

━━━━━━━━━━━━━━━━━━━
📊 *Token Details*
Total Supply:    1,000,000,000 BRX *(fixed forever)*
0% VC allocation · 76% community
Network: Polygon

💎 *Seed Benefits*
• Lowest price in BRICKX history
• 12-month lock + 24-month linear vest
• Early access to Phase 2 BRICK tokens
• 500 BRX referral bonus per friend

━━━━━━━━━━━━━━━━━━━
Min: *$100* · Max: *$50,000* per wallet
Payment: USDT · USDC · ETH · BNB`,

  // ── HOTEL ──────────────────────────────────────────────────
  hotel: `🏨 *Project Hotel Batam — Phase 2*

*Strategy:* Acquire existing operating hotel
*(Revenue starts from day one — no construction wait)*

━━━━━━━━━━━━━━━━━━━
📍 *Location:* Batam Island, Indonesia
✈️ *30 minutes ferry from Singapore*
🏭 Indonesia Free Trade Zone

💰 *Acquisition Budget:* up to *$18.5M USD*
🎫 *BRICK Token Price:* *$10.00 fixed forever*
📈 *Estimated APY:* ~5–8%
💵 *Annual Dividend:* June each year
🏦 *Holders receive:* 70% of Net Operating Income

━━━━━━━━━━━━━━━━━━━
*Why Batam?*
🚢 30 min ferry from Singapore
🏭 Free Trade Zone — easier business
📈 Hotel demand growing 15%/year
🏨 Limited 4-star supply = high occupancy
💰 Property 40-60% cheaper vs Jakarta/Bali
🔑 Founder has 10+ years local network

━━━━━━━━━━━━━━━━━━━
🔒 *Hotel name: CONFIDENTIAL*
Disclosed after SPA signing.
Seed investors notified FIRST.

*Phase 2 starts after Phase 1 ICO completes.*`,

  // ── DIVIDEND ───────────────────────────────────────────────
  dividend: `💵 *Annual Dividend Model*

70% of hotel Net Operating Income → BRICK holders
Paid in *USDC* automatically every *June*

━━━━━━━━━━━━━━━━━━━
📅 *Annual Cycle:*

*Jan–Dec*  → Hotel operations, revenue recorded
*Dec 31*   → Fiscal year close + holder snapshot
*Jan–Mar*  → Independent financial audit
*April*    → Dividend per token announced
*🟢 JUNE*  → USDC auto-transferred to all wallets

━━━━━━━━━━━━━━━━━━━
📊 *Example (Base Case — $18.5M hotel):*
• Annual revenue: $2,462,400
• Net Operating Income (55%): $1,354,320
• 70% to holders: *$948,024/year*
• Per token annual dividend: *$0.51 USDC*
• Annual APY: *~5.1%*

━━━━━━━━━━━━━━━━━━━
✅ *No claim needed*
USDC sent automatically to your wallet
Minimum holding: 1 BRICK token
Snapshot date: December 31 each year

🧮 Use /calc to estimate YOUR dividend`,

  // ── KYC GUIDE ──────────────────────────────────────────────
  kyc: `🔍 *KYC Verification Guide*

KYC is required before purchasing. Takes *5 minutes.*

━━━━━━━━━━━━━━━━━━━
*Step 1:* Register at ${WEBSITE}
*Step 2:* Click "Start KYC Verification"
*Step 3:* Upload government ID
*Step 4:* Take a live selfie
*Step 5:* Wait 5–30 minutes for approval

━━━━━━━━━━━━━━━━━━━
*✅ Accepted Documents:*
• Passport (any country)
• National ID / KTP
• Driver's License

*🌍 Supported Countries:* 80+
*⚡ Approval time:* 5–30 minutes
*🛡️ KYC Provider:* Sumsub (trusted globally)

━━━━━━━━━━━━━━━━━━━
*❌ KYC not available for:*
US, Canada, China, and sanctioned jurisdictions

*Need help?* Email: ${SUPPORT_EMAIL}`,

  // ── WALLET SETUP ───────────────────────────────────────────
  wallet: `💼 *How to Set Up a Polygon Wallet*

You need a Polygon wallet to:
• Receive BRX tokens at TGE
• Receive USDC annual dividend
• List/sell BRICK tokens on marketplace

━━━━━━━━━━━━━━━━━━━
*Option 1: MetaMask (Recommended)*
1. Download MetaMask app or browser extension
2. Create new wallet → save seed phrase securely
3. Add Polygon network:
   • Network: Polygon Mainnet
   • RPC: https://polygon-rpc.com
   • Chain ID: 137
   • Symbol: MATIC
4. Copy your wallet address (starts with 0x...)
5. Register it at brickxprotocol.io

*Option 2: Trust Wallet*
1. Download Trust Wallet app
2. Create wallet → save seed phrase
3. Polygon is pre-configured
4. Copy wallet address → register

━━━━━━━━━━━━━━━━━━━
⚠️ *Security Rules:*
• NEVER share your seed phrase with anyone
• BRICKX will NEVER ask for your seed phrase
• Always double-check wallet address when registering`,

  // ── FAQ ────────────────────────────────────────────────────
  faq: `❓ *Frequently Asked Questions*

━━━━━━━━━━━━━━━━━━━
*Q: What is the difference between BRX and BRICK?*
BRX = governance token (buy in ICO Phase 1)
BRICK = property token (buy in Phase 2, $10 fixed, earn dividend)

*Q: When is the first dividend paid?*
June 2028 (for FY2027)
Timeline: Hotel acquired Q4 2026 → operations 2027 → fiscal close Dec 31, 2027 → audit Q1 2028 → paid June 2028

*Q: Why is the hotel name confidential?*
Standard M&A practice — early disclosure raises seller price. Name revealed to all investors before BRICK token sale launches.

*Q: Can I sell my BRICK tokens?*
Yes! List on BRICKX marketplace at $10.00 anytime. No lock period for BRICK tokens.

*Q: What if ICO doesn't reach target?*
Full refund guaranteed. Hotel acquisition only proceeds after full ICO funding.

*Q: Minimum investment?*
BRX seed: $100 minimum
BRICK hotel token: $10 (1 token) minimum

*Q: Which payment is fastest?*
USDT or USDC on Polygon network
~$0.01 gas · ~2 min confirmation

*Q: Is BRICKX audited?*
CertiK audit scheduled before mainnet deployment.

━━━━━━━━━━━━━━━━━━━
More questions? /contact`,

  // ── ROADMAP ────────────────────────────────────────────────
  roadmap: `🗺️ *BRICKX Protocol Roadmap*

━━━━━━━━━━━━━━━━━━━
*🟢 Q1–Q2 2026 — BRX Seed Sale (NOW)*
✅ Platform MVP live
✅ KYC + payment system
✅ Whitepaper v2 published
⚡ $640K seed raise target
⚡ 1,000+ whitelist members

*🔵 Q3 2026 — ICO + Ecosystem*
• ICO Round 1 & 2 public sale
• CertiK smart contract audit
• BRX listed on QuickSwap (Polygon DEX)
• Full marketplace + staking live

*🟡 Q4 2026 — Phase 2: Hotel Acquisition*
• Hotel SPA signed
• Hotel name publicly revealed
• Full due diligence report published
• BRICK token sale launches
• Renovation begins

*🏨 2027 — Hotel Operations*
• Hotel fully operational
• First full fiscal year revenue
• December 31: First fiscal close + snapshot
• CEX listing applications

*💵 2028+ — First Dividend & Scale*
• June 2028: First USDC dividend paid
• Second hotel acquisition
• Mobile app (iOS + Android)
• DAO governance fully activated
• Target: $50M+ platform TVL

━━━━━━━━━━━━━━━━━━━
🌐 ${WEBSITE}`,

  // ── REFERRAL ───────────────────────────────────────────────
  referral: `🤝 *BRICKX Referral Program*

Earn *500 BRX* for every friend who joins the seed sale!

━━━━━━━━━━━━━━━━━━━
*💰 Reward Value:*
500 BRX × $0.030 (DEX price) = *$15 per referral*

10 friends = *$150 in BRX*
50 friends = *$750 in BRX*
100 friends = *$1,500 in BRX*

━━━━━━━━━━━━━━━━━━━
*How to Get Your Referral Code:*
1. Register at ${WEBSITE}
2. Complete KYC
3. Go to Dashboard → Referral
4. Copy your unique code
5. Share with friends!

━━━━━━━━━━━━━━━━━━━
*Rules:*
• Friend must register + complete KYC
• Friend must make at least $100 purchase
• Bonus distributed at TGE
• No limit on referrals
• Active during seed sale period

━━━━━━━━━━━━━━━━━━━
🌐 ${WEBSITE}`,

  // ── WHITEPAPER ─────────────────────────────────────────────
  whitepaper: `📄 *BRICKX Protocol Whitepaper v2.0*

Read the full technical documentation:

🔗 *${WHITEPAPER}*

━━━━━━━━━━━━━━━━━━━
*Contents:*
1. The Problem
2. The Solution
3. Two-Phase Strategy
4. How BRICKX Works
5. Token Architecture
6. Tokenomics (BRX)
7. Annual Dividend Model
8. Project Hotel Batam
9. Market Opportunity
10. Roadmap
11. Revenue Model
12. Competitive Landscape
13. Legal & Compliance
14. Risk Factors
15. Team & Governance
16. Conclusion

━━━━━━━━━━━━━━━━━━━
🌐 ${WEBSITE}`,

  // ── CONTACT ────────────────────────────────────────────────
  contact: `📞 *BRICKX Support & Contact*

━━━━━━━━━━━━━━━━━━━
*📧 Email (response within 24h):*
General: team@brickxprotocol.io
Investors: seed@brickxprotocol.io
Support: ${SUPPORT_EMAIL}
KYC Issues: kyc@brickxprotocol.io

*📱 Telegram:*
Channel: @BRICKXProtocol
Community: @BRICKXCommunity
Bot: @BRICKXBot

*🐦 Twitter/X:*
@BrickXprotocol

*🌐 Website:*
${WEBSITE}

*📄 Documentation:*
${WHITEPAPER}

━━━━━━━━━━━━━━━━━━━
⚠️ *Security Warning:*
BRICKX will NEVER:
• Ask for your seed phrase or private key
• DM you first asking for money
• Ask for passwords or 2FA codes

If someone claims to be BRICKX support in DM — it's a scam. Only contact us through official channels above.`,

};

// ════════════════════════════════════════════════════════════════
// COMMAND HANDLERS
// ════════════════════════════════════════════════════════════════

// /start
bot.onText(/\/start/, function(msg) {
  var chatId = msg.chat.id;
  var name = msg.from.first_name || "Investor";
  sendMsg(chatId, MSG.welcome(name), MAIN_KEYBOARD);
  console.log("[Bot] /start from", msg.from.username || msg.from.id);
});

// /menu
bot.onText(/\/menu/, function(msg) {
  sendMsg(msg.chat.id, "📋 *BRICKX Protocol — Main Menu*\nChoose an option:", MAIN_KEYBOARD);
});

// /buy
bot.onText(/\/buy/, function(msg) {
  sendMsg(msg.chat.id, MSG.buy, BACK_BTN);
});

// /price
bot.onText(/\/price/, function(msg) {
  sendMsg(msg.chat.id, MSG.price, BACK_BTN);
});

// /hotel
bot.onText(/\/hotel/, function(msg) {
  sendMsg(msg.chat.id, MSG.hotel, BACK_BTN);
});

// /dividend
bot.onText(/\/dividend/, function(msg) {
  sendMsg(msg.chat.id, MSG.dividend, BACK_BTN);
});

// /kyc
bot.onText(/\/kyc/, function(msg) {
  sendMsg(msg.chat.id, MSG.kyc, BACK_BTN);
});

// /wallet
bot.onText(/\/wallet/, function(msg) {
  sendMsg(msg.chat.id, MSG.wallet, BACK_BTN);
});

// /faq
bot.onText(/\/faq/, function(msg) {
  sendMsg(msg.chat.id, MSG.faq, BACK_BTN);
});

// /roadmap
bot.onText(/\/roadmap/, function(msg) {
  sendMsg(msg.chat.id, MSG.roadmap, BACK_BTN);
});

// /referral
bot.onText(/\/referral/, function(msg) {
  sendMsg(msg.chat.id, MSG.referral, BACK_BTN);
});

// /whitepaper
bot.onText(/\/whitepaper/, function(msg) {
  sendMsg(msg.chat.id, MSG.whitepaper, BACK_BTN);
});

// /contact
bot.onText(/\/contact/, function(msg) {
  sendMsg(msg.chat.id, MSG.contact, BACK_BTN);
});

// /status — live seed sale progress (no fabricated fallbacks)
function buildStatusMessage(live) {
  if (!live || typeof live.totalRaised !== "number") {
    return `📊 *BRX Seed Sale — Status*\n\n` +
      `⏳ Live statistics are temporarily unavailable.\nPlease try again in a few minutes.\n\n` +
      `*Price Ladder:*\n` +
      `🟡 Seed NOW:   *$0.008/BRX*\n` +
      `🔵 Round 1:    $0.015 *(+87.5%)*\n` +
      `🔵 Round 2:    $0.022 *(+175%)*\n` +
      `🟣 DEX Launch: $0.030 *(+275%)*\n\n` +
      `🌐 ${WEBSITE}`;
  }
  var cap    = live.seedHardCap || ICO.seedCap;
  var raised = live.totalRaised;
  var filled = pct(raised, cap);
  var bar    = progressBar(parseFloat(filled), 20);
  return `📊 *BRX Seed Sale — Live Status*\n\n` +
    `\`${bar}\` ${filled}%\n\n` +
    `💰 Raised:    *${formatUSD(raised)}* / ${formatUSD(cap)}\n` +
    `📈 Remaining: *${formatUSD(Math.max(cap - raised, 0))}*\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `*Price Ladder:*\n` +
    `🟡 Seed NOW:   *$0.008/BRX*\n` +
    `🔵 Round 1:    $0.015 *(+87.5%)*\n` +
    `🔵 Round 2:    $0.022 *(+175%)*\n` +
    `🟣 DEX Launch: $0.030 *(+275%)*\n\n` +
    `🌐 ${WEBSITE}`;
}

const STATUS_KEYBOARD = {
  parse_mode: "Markdown",
  disable_web_page_preview: true,
  reply_markup: {
    inline_keyboard: [
      [{ text: "🌱 Buy Now", url: WEBSITE }, { text: "⬅️ Menu", callback_data: "cmd_menu" }]
    ]
  }
};

bot.onText(/\/status/, async function(msg) {
  var live = await fetchLiveStats();
  sendMsg(msg.chat.id, buildStatusMessage(live), STATUS_KEYBOARD);
});

// ── CALCULATOR ───────────────────────────────────────────────
bot.onText(/\/calc/, function(msg) {
  var chatId = msg.chat.id;
  userState.set(chatId, { step: "awaiting_amount" });
  sendMsg(chatId,
    `🧮 *BRICKX Dividend Calculator*\n\n` +
    `How much USD are you planning to invest in BRICK tokens?\n\n` +
    `*Enter amount in USD* (minimum $10 = 1 token)\n` +
    `Example: \`5000\``,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "$500",   callback_data: "calc_500" },
            { text: "$1,000", callback_data: "calc_1000" },
            { text: "$5,000", callback_data: "calc_5000" },
          ],
          [
            { text: "$10,000", callback_data: "calc_10000" },
            { text: "$25,000", callback_data: "calc_25000" },
            { text: "$50,000", callback_data: "calc_50000" },
          ],
          [{ text: "⬅️ Cancel", callback_data: "cmd_menu" }],
        ],
      },
    }
  );
});

function calcResult(chatId, amountUSD) {
  var amount     = parseFloat(amountUSD);
  var tokens     = Math.floor(amount / HOTEL.tokenPrice);
  var totalTokens= 1850000; // $18.5M / $10
  var annualPool = 948024;  // 70% of NOI
  var shareOfPool= (tokens / totalTokens) * annualPool;
  var perToken   = annualPool / totalTokens;
  var apy        = (perToken / HOTEL.tokenPrice) * 100;

  // 5-year projection
  var y1 = shareOfPool;
  var y5 = shareOfPool * 5;

  sendMsg(chatId,
    `🧮 *Your BRICKX Dividend Estimate*\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `💵 Investment:          *${formatUSD(amount)}*\n` +
    `🎫 BRICK Tokens:        *${tokens.toLocaleString()} tokens*\n` +
    `💎 Token Price:         *$10.00 (fixed forever)*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📅 Annual Dividend:     *${formatUSD(shareOfPool)} USDC*\n` +
    `🎯 Per Token (annual):  *$${perToken.toFixed(4)}*\n` +
    `📈 Annual APY:          *${apy.toFixed(1)}%*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `*5-Year Projection:*\n` +
    `Total dividend income:  *${formatUSD(y5)} USDC*\n` +
    `Your tokens still worth: *${formatUSD(amount)}* (fixed price)\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `*First payment:* June 2028\n` +
    `*Payment method:* USDC → your wallet\n` +
    `*No action needed — automatic*\n\n` +
    `_Based on $18.5M hotel, 100 rooms, $95 ADR, 72% occ, 55% NOI margin_\n\n` +
    `🌐 ${WEBSITE}`,
    {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌱 Buy BRX Now", url: WEBSITE }],
          [{ text: "🔄 Calculate Again", callback_data: "cmd_calc" }, { text: "⬅️ Menu", callback_data: "cmd_menu" }],
        ],
      },
    }
  );

  userState.delete(chatId);
}

// ── HANDLE TEXT INPUT FOR CALCULATOR ─────────────────────────
bot.on("message", function(msg) {
  if (!msg.text || msg.text.startsWith("/")) return;
  var chatId = msg.chat.id;
  var state  = userState.get(chatId);
  if (!state || state.step !== "awaiting_amount") return;

  var amount = parseFloat(msg.text.replace(/[,$]/g, ""));
  if (isNaN(amount) || amount < 10) {
    sendMsg(chatId, "⚠️ Please enter a valid amount in USD (minimum $10 = 1 BRICK token).\nExample: `5000`", { parse_mode:"Markdown" });
    return;
  }
  if (amount > 18500000) {
    sendMsg(chatId, "⚠️ Maximum is the full hotel budget ($18,500,000). Please enter a smaller amount.");
    return;
  }
  calcResult(chatId, amount);
});

// ════════════════════════════════════════════════════════════════
// CALLBACK QUERY HANDLER (Inline Buttons)
// ════════════════════════════════════════════════════════════════
bot.on("callback_query", async function(query) {
  try {
  if (query.from && rateLimited(query.from.id)) {
    bot.answerCallbackQuery(query.id, { text: "Slow down a little 🙂" }).catch(function(){});
    return;
  }
  var chatId = query.message.chat.id;
  var msgId  = query.message.message_id;
  var data   = query.data;
  knownChats.add(chatId);

  bot.answerCallbackQuery(query.id).catch(function(){});

  // Calculator quick amounts
  if (data.startsWith("calc_")) {
    var amount = parseInt(data.replace("calc_", ""));
    userState.delete(chatId);
    calcResult(chatId, amount);
    return;
  }

  // Admin broadcast
  if (data.startsWith("admin_")) {
    if (!isAdmin(query.from.id)) {
      bot.answerCallbackQuery(query.id, { text: "Admin only." });
      return;
    }
    // Handle admin actions here
    return;
  }

  switch (data) {
    case "cmd_menu":
      bot.editMessageText("📋 *BRICKX Protocol — Main Menu*", {
        chat_id: chatId, message_id: msgId,
        parse_mode: "Markdown",
        ...MAIN_KEYBOARD,
      });
      break;
    case "cmd_buy":      sendMsg(chatId, MSG.buy,        BACK_BTN); break;
    case "cmd_price":    sendMsg(chatId, MSG.price,      BACK_BTN); break;
    case "cmd_hotel":    sendMsg(chatId, MSG.hotel,      BACK_BTN); break;
    case "cmd_dividend": sendMsg(chatId, MSG.dividend,   BACK_BTN); break;
    case "cmd_kyc":      sendMsg(chatId, MSG.kyc,        BACK_BTN); break;
    case "cmd_roadmap":  sendMsg(chatId, MSG.roadmap,    BACK_BTN); break;
    case "cmd_faq":      sendMsg(chatId, MSG.faq,        BACK_BTN); break;
    case "cmd_referral": sendMsg(chatId, MSG.referral,   BACK_BTN); break;
    case "cmd_contact":  sendMsg(chatId, MSG.contact,    BACK_BTN); break;
    case "cmd_whitepaper": sendMsg(chatId, MSG.whitepaper, BACK_BTN); break;
    case "cmd_status":
      var live = await fetchLiveStats();
      sendMsg(chatId, buildStatusMessage(live), STATUS_KEYBOARD);
      break;
    case "cmd_calc":
      userState.set(chatId, { step: "awaiting_amount" });
      sendMsg(chatId,
        `🧮 *Dividend Calculator*\n\nHow much USD to invest in BRICK tokens?\nMinimum $10 (1 token)`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "$500", callback_data: "calc_500" }, { text: "$1,000", callback_data: "calc_1000" }, { text: "$5,000", callback_data: "calc_5000" }],
              [{ text: "$10,000", callback_data: "calc_10000" }, { text: "$25,000", callback_data: "calc_25000" }, { text: "$50,000", callback_data: "calc_50000" }],
              [{ text: "⬅️ Cancel", callback_data: "cmd_menu" }],
            ],
          },
        }
      );
      break;
  }
  } catch (e) {
    console.error("[Bot] callback error:", e.message);
  }
});

// ════════════════════════════════════════════════════════════════
// ADMIN COMMANDS
// ════════════════════════════════════════════════════════════════

// /admin — admin panel
bot.onText(/\/admin/, function(msg) {
  if (!isAdmin(msg.from.id)) {
    sendMsg(msg.chat.id, "⛔ Admin access required.");
    return;
  }
  sendMsg(msg.chat.id,
    `🔧 *BRICKX Admin Panel*\n\n` +
    `/broadcast <message> — Send to all users\n` +
    `/announce <message>  — Post to channel\n` +
    `/stats               — Bot statistics\n` +
    `/updateprice <round> <price> — Update ICO price\n\n` +
    `Admin IDs: ${ADMIN_IDS.join(", ")}`,
    { parse_mode: "Markdown" }
  );
});

// /broadcast — send message to every chat that has talked to the bot.
// Note: the chat list is in-memory and resets on restart; for a durable
// list, store chat IDs in the database.
bot.onText(/\/broadcast (.+)/, async function(msg, match) {
  if (!isAdmin(msg.from.id)) return;
  var text = match[1];
  var sent = 0, failed = 0;
  for (const id of knownChats) {
    if (id === msg.chat.id) continue;
    try {
      await bot.sendMessage(id, text, { parse_mode: "Markdown", disable_web_page_preview: true });
      sent++;
    } catch (e) {
      failed++;
    }
    await new Promise(function(r) { setTimeout(r, 50); }); // ~20 msg/s, under Telegram limits
  }
  sendMsg(msg.chat.id, `📢 Broadcast done — sent: ${sent}, failed: ${failed}, known chats: ${knownChats.size}`);
});

// /announce — post to official channel (admin only)
bot.onText(/\/announce (.+)/, async function(msg, match) {
  if (!isAdmin(msg.from.id)) return;
  var text = match[1];
  try {
    await bot.sendMessage(CHANNEL_ID, text, { parse_mode: "Markdown" });
    sendMsg(msg.chat.id, `✅ Posted to ${CHANNEL_ID}`);
  } catch (e) {
    sendMsg(msg.chat.id, `❌ Failed: ${e.message}`);
  }
});

// /stats — bot usage stats (admin only)
bot.onText(/\/stats/, function(msg) {
  if (!isAdmin(msg.from.id)) return;
  sendMsg(msg.chat.id,
    `📊 *Bot Statistics*\n\n` +
    `Active sessions: ${userState.size}\n` +
    `Admin IDs: ${ADMIN_IDS.length}\n` +
    `API: ${API_URL}\n` +
    `Channel: ${CHANNEL_ID}`,
    { parse_mode: "Markdown" }
  );
});

// ════════════════════════════════════════════════════════════════
// SCHEDULED ANNOUNCEMENTS (Cron Jobs)
// ════════════════════════════════════════════════════════════════

// Daily update at 9AM WIB (cron expression is in Asia/Jakarta time)
cron.schedule("0 9 * * *", async function() {
  var live = await fetchLiveStats();
  if (!live || typeof live.totalRaised !== "number") {
    console.log("[Cron] Daily update skipped — API unavailable (no fabricated numbers posted)");
    return;
  }
  var cap    = live.seedHardCap || ICO.seedCap;
  var raised = live.totalRaised;
  var filled = pct(raised, cap);
  var bar    = progressBar(parseFloat(filled), 15);

  var msg =
    `📊 *Daily Seed Sale Update*\n\n` +
    `\`${bar}\` *${filled}%*\n\n` +
    `💰 ${formatUSD(raised)} raised / ${formatUSD(cap)} cap\n` +
    `🟡 Seed price: *$0.008/BRX*\n` +
    `🔵 Round 1 next: *$0.015 (+87.5%)*\n\n` +
    `Don't miss seed price!\n👉 ${WEBSITE}`;

  try {
    await bot.sendMessage(CHANNEL_ID, msg, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
    console.log("[Cron] Daily update posted to channel");
  } catch (e) {
    console.error("[Cron] Failed:", e.message);
  }
}, { timezone: "Asia/Jakarta" });

// Weekly roadmap reminder (every Monday 10AM WIB)
cron.schedule("0 10 * * 1", async function() {
  var weeklyMsg =
    `🗺️ *BRICKX Weekly Update*\n\n` +
    `*Phase 1 (NOW):* BRX Seed Sale Active\n` +
    `*Phase 2 (NEXT):* Hotel Batam Acquisition\n\n` +
    `📅 Coming this week:\n` +
    `• Seed sale progress update\n` +
    `• Community AMA (Saturday)\n\n` +
    `Start your week right — join BRICKX 🏨\n` +
    `👉 ${WEBSITE}`;

  try {
    await bot.sendMessage(CHANNEL_ID, weeklyMsg, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
    console.log("[Cron] Weekly update posted");
  } catch (e) {
    console.error("[Cron] Weekly failed:", e.message);
  }
}, { timezone: "Asia/Jakarta" });

// ════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════════
bot.on("polling_error", function(error) {
  console.error("[Polling Error]", error.message);
});

bot.on("error", function(error) {
  console.error("[Bot Error]", error.message);
});

// ── START ─────────────────────────────────────────────────────
console.log("✅ BRICKX Bot is running!");
console.log("📋 Commands: /start /buy /price /status /hotel /dividend /kyc /wallet /faq /roadmap /referral /calc /contact");
console.log("🔧 Admin commands: /admin /broadcast /announce /stats");
console.log("📅 Cron: Daily 9AM WIB + Weekly Monday 10AM WIB");
