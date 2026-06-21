# BRICKX Group-Management Bot

Runs **inside a Telegram group** to keep it clean. Separate from the community
/ announcement bot. Long-polling — no port or webhook.

## Features
1. **Captcha verification** — a new member is muted and must tap "✅ I'm human"
   within `CAPTCHA_TIMEOUT_SEC`, or they're kicked (can rejoin and retry). Stops
   spam-bot floods.
2. **Anti-scam** — deletes messages from **non-admins** that contain links/URLs
   (and optionally forwards) or known scam keywords (e.g. "DM me", "claim
   airdrop", "seed phrase"). Repeat offenders are muted after
   `SCAM_STRIKES_BEFORE_MUTE` hits. Admins are exempt.
3. **Welcome + /rules + /help** — greets verified members and serves the rules.

## ⚠️ Two required Telegram settings
1. **Promote the bot to admin** in the group with at least **Delete messages**
   and **Ban users** permissions (needed to mute/kick and delete scam).
2. **Disable privacy mode** so it can read normal messages for anti-scam:
   @BotFather → `/setprivacy` → select this bot → **Disable**.
   (Without this the bot only sees commands, and anti-scam won't work.)

## Run locally
```bash
cd brickx/group-bot
npm install
cp .env.example .env   # set TELEGRAM_GROUP_BOT_TOKEN
npm start
```

## Deploy on Railway (worker, no public port)
1. New Railway service → deploy from this repo, **Root Directory: `brickx/group-bot`**.
2. Railway runs `npm start` (a `Procfile` worker entry is also provided).
3. Add the env vars from `.env.example` under **Variables** (at minimum
   `TELEGRAM_GROUP_BOT_TOKEN`).
4. Add the bot to your group and promote it to admin (see above).
5. Check logs for `🛡  BRICKX Group bot ready.`

Use a **separate bot token** from the announcement bot so permissions and
rate limits don't collide. All behavior is tunable via env without code changes.
