// ════════════════════════════════════════════════════════════════
// BRICKX PROTOCOL — GROUP MANAGEMENT BOT
// Runs inside a Telegram group and must be promoted to ADMIN with at
// least: Delete messages + Ban/restrict users. Also set privacy mode OFF
// in @BotFather (/setprivacy → Disable) so it can read normal messages
// for anti-scam. Long-polling — no port/webhook needed.
//
// Features (all toggleable via env):
//  1. Captcha verification — new members are muted until they tap
//     "I'm human"; kicked if they don't within CAPTCHA_TIMEOUT_SEC.
//  2. Anti-scam — deletes links / @-channel mentions / scam keywords from
//     non-admins; repeat offenders get muted.
//  3. Welcome message + /rules + /help.
// ════════════════════════════════════════════════════════════════

const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

// ── Config ──────────────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_GROUP_BOT_TOKEN;
if (!TOKEN) { console.error("❌ TELEGRAM_GROUP_BOT_TOKEN not set"); process.exit(1); }

// Optional: lock the bot to a single group id (e.g. -1001234567890). Empty = any group it's added to.
const ALLOWED_CHAT   = process.env.GROUP_CHAT_ID ? String(process.env.GROUP_CHAT_ID) : "";
const CAPTCHA_ON     = (process.env.CAPTCHA_ENABLED || "true") !== "false";
const CAPTCHA_TIMEOUT = (parseInt(process.env.CAPTCHA_TIMEOUT_SEC, 10) || 120) * 1000;
const ANTISPAM_ON    = (process.env.ANTISPAM_ENABLED || "true") !== "false";
const BLOCK_LINKS    = (process.env.BLOCK_LINKS || "true") !== "false";
const BLOCK_FORWARDS = (process.env.BLOCK_FORWARDS || "false") === "true";
const SCAM_STRIKES   = parseInt(process.env.SCAM_STRIKES_BEFORE_MUTE, 10) || 2;

const WELCOME = process.env.WELCOME_MESSAGE ||
  "👋 Welcome to BRICKX Protocol, {name}!\n\nReal estate tokenized on-chain — fixed token price, annual USDC dividend.\n\n• Site: brickxprotocol.io\n• Docs: docs.brickxprotocol.io\n\n⚠️ Admins will NEVER DM you first or ask for seed phrases. Type /rules.";

const RULES = process.env.RULES_TEXT ||
  "📋 BRICKX Group Rules\n\n1. Be respectful — no harassment or spam.\n2. No links, promotions, or referral drops unless you're an admin.\n3. Admins NEVER DM first and NEVER ask for your seed phrase, private key, or to 'validate' a wallet. Anyone who does is a SCAMMER — report & ignore.\n4. No FUD, shilling other tokens, or NSFW content.\n5. English/Bahasa preferred so mods can moderate.\n\nBreaking rules → message removed → mute → ban.";

const SCAM_KEYWORDS = (process.env.SCAM_KEYWORDS ||
  "dm me,dm admin,send eth,send bnb,claim your airdrop,claim airdrop,connect wallet,validate wallet,wallet validation,seed phrase,private key,metamask support,customer support,whatsapp +,t.me/+,double your,giveaway,free mint,first 100 people")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

// ── Permission sets for mute / unmute ───────────────────────────
const MUTED = {
  can_send_messages: false, can_send_audios: false, can_send_documents: false,
  can_send_photos: false, can_send_videos: false, can_send_video_notes: false,
  can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false,
  can_add_web_page_previews: false,
};
const UNMUTED = {
  can_send_messages: true, can_send_audios: true, can_send_documents: true,
  can_send_photos: true, can_send_videos: true, can_send_video_notes: true,
  can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true,
  can_add_web_page_previews: true,
};

const bot = new TelegramBot(TOKEN, { polling: true });
console.log("🛡  BRICKX Group bot starting...");

// ── State ───────────────────────────────────────────────────────
const pending = new Map();          // `${chat}:${user}` -> { timer, captchaMsgId }
const strikes = new Map();          // `${chat}:${user}` -> count
const adminCache = new Map();       // chatId -> { ids:Set, at:ms }
const ADMIN_TTL = 5 * 60 * 1000;

// ── Helpers ─────────────────────────────────────────────────────
const isGroup = (chat) => chat && (chat.type === "group" || chat.type === "supergroup");
const allowed = (chatId) => !ALLOWED_CHAT || String(chatId) === ALLOWED_CHAT;
const nameOf  = (u) => u.first_name || u.username || "there";
const key     = (c, u) => `${c}:${u}`;

async function getAdminIds(chatId) {
  const cached = adminCache.get(chatId);
  if (cached && Date.now() - cached.at < ADMIN_TTL) return cached.ids;
  try {
    const admins = await bot.getChatAdministrators(chatId);
    const ids = new Set(admins.map((a) => a.user.id));
    adminCache.set(chatId, { ids, at: Date.now() });
    return ids;
  } catch (e) {
    return cached ? cached.ids : new Set();
  }
}
async function isAdmin(chatId, userId) { return (await getAdminIds(chatId)).has(userId); }

function safe(p) { return Promise.resolve(p).catch((e) => console.warn("[tg]", e.message)); }
async function kick(chatId, userId) {
  await safe(bot.banChatMember(chatId, userId));
  // Unban so they can rejoin and retry the captcha.
  setTimeout(() => safe(bot.unbanChatMember(chatId, userId, { only_if_banned: true })), 1500);
}

// ── 1. Captcha on join ──────────────────────────────────────────
bot.on("new_chat_members", async (msg) => {
  const chatId = msg.chat.id;
  if (!isGroup(msg.chat) || !allowed(chatId)) return;
  for (const m of msg.new_chat_members) {
    if (m.is_bot) continue;
    if (!CAPTCHA_ON) { await safe(bot.sendMessage(chatId, WELCOME.replace("{name}", nameOf(m)))); continue; }
    await safe(bot.restrictChatMember(chatId, m.id, { permissions: MUTED }));
    const sent = await safe(bot.sendMessage(chatId,
      `👋 ${nameOf(m)}, tap the button below within ${Math.round(CAPTCHA_TIMEOUT / 1000)}s to verify you're human — or you'll be removed.`,
      { reply_markup: { inline_keyboard: [[{ text: "✅ I'm human", callback_data: `verify:${m.id}` }]] } }));
    const k = key(chatId, m.id);
    const timer = setTimeout(async () => {
      if (!pending.has(k)) return;
      const p = pending.get(k); pending.delete(k);
      if (p && p.captchaMsgId) safe(bot.deleteMessage(chatId, p.captchaMsgId));
      await kick(chatId, m.id);
    }, CAPTCHA_TIMEOUT);
    pending.set(k, { timer, captchaMsgId: sent && sent.message_id });
  }
});

bot.on("callback_query", async (q) => {
  const data = q.data || "";
  if (!data.startsWith("verify:")) return;
  const targetId = Number(data.split(":")[1]);
  const chatId = q.message.chat.id;
  if (q.from.id !== targetId) {
    return safe(bot.answerCallbackQuery(q.id, { text: "This verification isn't for you." }));
  }
  const k = key(chatId, targetId);
  const p = pending.get(k);
  if (p) { clearTimeout(p.timer); pending.delete(k); if (p.captchaMsgId) safe(bot.deleteMessage(chatId, p.captchaMsgId)); }
  await safe(bot.restrictChatMember(chatId, targetId, { permissions: UNMUTED }));
  await safe(bot.answerCallbackQuery(q.id, { text: "Verified — welcome! ✅" }));
  await safe(bot.sendMessage(chatId, WELCOME.replace("{name}", nameOf(q.from))));
});

// ── 2 & 3. Messages: anti-scam + commands ───────────────────────
function looksLikeScam(msg, text) {
  if (BLOCK_FORWARDS && (msg.forward_from || msg.forward_from_chat)) return "forwarded message";
  const lower = text.toLowerCase();
  if (BLOCK_LINKS) {
    if (/(https?:\/\/|www\.|t\.me\/|chat\.whatsapp\.com|\b\w+\.(io|xyz|finance|app|net|org|click)\b)/i.test(text)) return "link";
    const ents = (msg.entities || []).concat(msg.caption_entities || []);
    if (ents.some((e) => e.type === "url" || e.type === "text_link")) return "link";
  }
  for (const kw of SCAM_KEYWORDS) if (lower.includes(kw)) return `keyword "${kw}"`;
  return null;
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || "";

  // Commands (work in group + DM)
  if (text.startsWith("/")) {
    const cmd = text.split(/[\s@]/)[0].toLowerCase();
    if (cmd === "/rules") return safe(bot.sendMessage(chatId, RULES));
    if (cmd === "/help" || cmd === "/start")
      return safe(bot.sendMessage(chatId,
        "🛡 BRICKX Group bot\n\n• New members verify with a captcha button.\n• Links & scam messages from non-admins are auto-removed.\n• /rules — group rules\n• /help — this message\n\nProtect yourself: admins never DM first or ask for seed phrases."));
    return;
  }

  if (!ANTISPAM_ON || !isGroup(msg.chat) || !allowed(chatId)) return;
  if (!msg.from || msg.from.is_bot) return;
  if (msg.new_chat_members || msg.left_chat_member) return; // service messages
  if (await isAdmin(chatId, msg.from.id)) return;           // admins are exempt

  const reason = looksLikeScam(msg, text);
  if (!reason) return;

  await safe(bot.deleteMessage(chatId, msg.message_id));
  const k = key(chatId, msg.from.id);
  const n = (strikes.get(k) || 0) + 1;
  strikes.set(k, n);

  if (n >= SCAM_STRIKES) {
    await safe(bot.restrictChatMember(chatId, msg.from.id, { permissions: MUTED }));
    const warn = await safe(bot.sendMessage(chatId,
      `🔇 ${nameOf(msg.from)} muted after repeated blocked messages (${reason}). An admin can unmute.`));
    if (warn) setTimeout(() => safe(bot.deleteMessage(chatId, warn.message_id)), 15000);
  } else {
    const warn = await safe(bot.sendMessage(chatId,
      `🚫 ${nameOf(msg.from)}, links/promotions aren't allowed here (${reason}). Type /rules.`));
    if (warn) setTimeout(() => safe(bot.deleteMessage(chatId, warn.message_id)), 8000);
  }
});

bot.on("polling_error", (e) => console.warn("[polling]", e.message));
process.on("unhandledRejection", (r) => console.error("[unhandledRejection]", r));
console.log("🛡  BRICKX Group bot ready.");
