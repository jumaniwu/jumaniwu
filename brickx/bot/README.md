# BRICKX Telegram Bot

Community bot: live ICO stats (`/status`), an investment/dividend calculator,
FAQ replies, and scheduled daily/weekly channel updates. Reads live numbers from
the backend API (`/api/ico/info`) — nothing is hardcoded.

## Env

Copy `.env.example` to `.env` and fill in:

| Var | Required | Notes |
|-----|----------|-------|
| `TELEGRAM_BOT_TOKEN` | ✅ | From @BotFather. Bot exits if missing. |
| `TELEGRAM_CHANNEL_ID` | for auto-posts | e.g. `@BRICKXProtocol`. **Bot must be an admin of the channel.** |
| `ADMIN_TELEGRAM_IDS` | for admin cmds | Comma-separated numeric user IDs (from @userinfobot). |
| `BRICKX_API_URL` | recommended | Defaults to `https://api.brickxprotocol.io`. |

## Run locally

```bash
cd brickx/bot
npm install
cp .env.example .env   # fill in TELEGRAM_BOT_TOKEN at minimum
npm start
```

## Deploy on Railway (worker, no public port)

The bot uses **long polling**, so it needs no inbound port or domain.

1. New Railway service → deploy from this repo, **Root Directory: `brickx/bot`**.
2. Railway auto-detects Node and runs `npm start` (a `Procfile` worker entry is
   also provided for Heroku-style platforms).
3. Add the env vars above under the service's **Variables**.
4. Deploy. Check logs for `🤖 BRICKX Bot starting...`.
5. In Telegram, add the bot as an **admin** of `@BRICKXProtocol` so the daily
   (09:00 WIB) and weekly (Mon 10:00 WIB) channel posts can publish.

Run it as its own service (separate from the backend API) so polling and the
API process don't share a lifecycle.
