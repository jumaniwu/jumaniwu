# BRICKX Telegram Bot

Community bot: live ICO stats (`/status`), an investment/dividend calculator,
FAQ replies, scheduled daily/weekly channel updates, **keyword auto-replies**,
and a built-in **raid bot**. Reads live numbers from the backend API
(`/api/ico/info`) — nothing is hardcoded.

## Auto-reply (answers questions, not just commands)

The bot answers natural-language questions about the website, price, how to buy,
KYC, wallet, dividend, whitepaper, roadmap, referral, safety, and support. In
**private chat** it replies to any matching question; in **groups** it only
replies when it's mentioned/replied-to or the message is clearly a question.

> ⚠️ For auto-reply to work **in groups**, disable the bot's privacy mode:
> @BotFather → `/setprivacy` → select this bot → **Disable**. Otherwise the bot
> only sees slash-commands in groups.

## Raid bot (community social raids — no third-party admin needed)

| Command | Who | Action |
|---------|-----|--------|
| `/raid <link>` | group owner/admins (or `ADMIN_TELEGRAM_IDS`) | Start a raid on an X post (posts it with an **✅ I raided** button). |
| `/raidstop` | group owner/admins | End the current raid and show total + raiders. |
| `/raidwinners` | group owner/admins | **Top 5 with their submitted post links** — the prize pool ranking. |
| `/raidtop` | everyone | Leaderboard of top raiders. |
| `/raidhelp` | everyone | How it works. |

> The group **owner and admins are recognized automatically** (via Telegram), and
> **anonymous** admin posts are supported too — you don't need to add your ID to
> `ADMIN_TELEGRAM_IDS` to start raids in your group.

**Scoring (points).** Each unique X post a member submits is worth `RAID_POINTS_PER_POST`
points (default **10**). A given post link can only be counted **once** across the whole
contest — duplicates (and `twitter.com`↔`x.com`/query-string variants) are rejected, so
nobody can farm or reuse someone else's link. A member can submit many different posts;
points add up. `/raidtop` ranks by total points; `/raidwinners` shows the top 5 with their
post links to verify before awarding.

**Prize-pool flow.** (1) Tap **✅ I raided**, then (2) tap **🎁 Submit my post** — this
opens the bot in a **private chat (DM)** carrying the raid context, where the member
pastes their X post link. The bot replies *+N points* (or "already submitted"). Links go
to the bot privately, so the group stays clean. Tap *🎁 Submit my post* again for each
additional post. (DM submission needs no privacy-mode change.)

**Persistence.** Set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (same project as the
backend) and run `backend/migration-006-raid-prize.sql` **and**
`backend/migration-007-raid-points.sql` once — then points/submissions are stored in the
DB and **survive restarts/redeploys**. Without those vars, scoring is in-memory and
resets on restart.

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
