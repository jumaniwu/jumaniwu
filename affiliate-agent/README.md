# AI Affiliate Automation Agent

An autonomous marketing agent that researches Shopee products, generates viral TikTok scripts using Gemini 1.5 Flash, creates UGC-style product images, and posts to TikTok — with a human-in-the-loop Telegram approval gate.

---

## Architecture

```
Cron (2x/day)
    └── ShopeeResearcher (Apify / fallback scraper)
            └── ContentEngine (Gemini 1.5 Flash + Pollinations.ai)
                    └── TelegramApprovalBot (send for review)
                            └── [Human: ✅ Approve / ❌ Reject]
                                    └── TikTokUploader (Content Posting API)
```

**Orchestrator:** n8n (Docker)  
**LLM:** Gemini 1.5 Flash (primary) + Groq Llama3 (fallback)  
**Images:** Pollinations.ai (free, no key needed)  
**Scraper:** Apify Shopee actor + direct API fallback  
**Database:** PostgreSQL + Redis  

---

## Quick Start

### 1. Prerequisites

- Docker + Docker Compose
- Python 3.11+
- Git

### 2. Clone & Configure

```bash
cd affiliate-agent
cp .env.example .env
# Edit .env with your real API keys (see API Keys section below)
```

### 3. Start Infrastructure

```bash
docker-compose up -d
```

Services started:
- **n8n** → http://localhost:5678 (admin / your N8N_PASSWORD)
- **PostgreSQL** → localhost:5432
- **Redis** → localhost:6379
- **Agent API** → http://localhost:8000

Check all services are healthy:
```bash
docker-compose ps
```

### 4. Import n8n Workflow

1. Open http://localhost:5678 in your browser
2. Go to **Workflows → Import**
3. Upload `n8n/workflow.json`
4. Configure the **Affiliate DB** PostgreSQL credential in n8n:
   - Host: `postgres`, Port: `5432`
   - Database: `affiliate_db`, User/Pass from your `.env`
5. **Activate** the workflow

### 5. Test Each Module Independently

```bash
# Install Python deps locally (for testing outside Docker)
pip install -r requirements.txt

# 1. Research products
python -m src.researcher

# 2. Generate content
python -m src.content_gen

# 3. Send Telegram approval (check your Telegram!)
python -m src.telegram_bot

# 4. Upload (dry-run mode — no actual TikTok post)
python -m src.uploader
```

---

## API Keys Setup

### Gemini 1.5 Flash (FREE)
1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Set `GEMINI_API_KEY=your_key` in `.env`
4. Free tier: 15 requests/min, 1M tokens/day

### Groq API (FREE)
1. Sign up at https://console.groq.com
2. Create API key
3. Set `GROQ_API_KEY=your_key` in `.env`
4. Used as fallback if Gemini fails

### Telegram Bot
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot: `/newbot`
3. Copy the token → `TELEGRAM_BOT_TOKEN`
4. Find your chat ID: message [@userinfobot](https://t.me/userinfobot)
5. Set `TELEGRAM_CHAT_ID=your_chat_id`

> **For webhooks in production:** Use a reverse proxy (nginx) or ngrok:
> ```bash
> ngrok http 8000
> # Set N8N_WEBHOOK_URL=https://your-ngrok-url.ngrok.io
> ```

### Apify (Shopee Scraper)
1. Sign up at https://apify.com (free tier: $5 credit/month)
2. Go to Settings → Integrations → API tokens
3. Set `APIFY_TOKEN=your_token`
4. The agent uses `bebity/shopee-products-scraper` actor
5. Falls back to direct Shopee API if quota is exhausted

### TikTok Content Posting API
> ⚠️ Requires **manual application** at TikTok Developer Portal.

#### Step 1: Apply for Access
1. Go to https://developers.tiktok.com
2. Create an app and apply for **Content Posting API** access
3. Set redirect URI to `http://localhost:8000/oauth/callback`

#### Step 2: Get Initial OAuth2 Token (one-time manual step)
```bash
# Build the authorization URL:
SCOPE="video.publish,video.upload"
AUTH_URL="https://www.tiktok.com/v2/auth/authorize/?client_key=YOUR_CLIENT_KEY&response_type=code&scope=${SCOPE}&redirect_uri=http://localhost:8000/oauth/callback&state=random123"
echo $AUTH_URL
```
1. Open the URL in your browser
2. Authorize the app with your TikTok account
3. TikTok redirects to `http://localhost:8000/oauth/callback?code=AUTH_CODE`
4. Exchange the code for tokens:
```bash
curl -X POST https://open.tiktokapis.com/v2/oauth/token/ \
  -d "client_key=YOUR_KEY&client_secret=YOUR_SECRET&code=AUTH_CODE&grant_type=authorization_code&redirect_uri=http://localhost:8000/oauth/callback"
```
5. Copy `access_token`, `refresh_token`, and `open_id` to `.env`

#### Step 3: Set Environment Variables
```
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
TIKTOK_ACCESS_TOKEN=your_access_token
TIKTOK_REFRESH_TOKEN=your_refresh_token
TIKTOK_OPEN_ID=your_open_id
```
> The agent auto-refreshes the access token using the refresh token.

---

## Configuration

| Variable | Description | Default |
|---|---|---|
| `MIN_PRODUCT_RATING` | Minimum Shopee product rating | `4.7` |
| `MIN_MONTHLY_SOLD` | Minimum monthly sales | `100` |
| `TARGET_KEYWORDS` | Comma-separated search keywords | See `.env.example` |
| `POST_BASE_DELAY_SECONDS` | Base delay between posts (anti-ban) | `300` |
| `POST_SCHEDULE` | n8n cron schedule | `0 8,20 * * *` |

---

## Project Structure

```
affiliate-agent/
├── docker-compose.yml      # Infrastructure services
├── Dockerfile              # Python agent service
├── .env.example            # Environment variable template
├── requirements.txt        # Python dependencies
├── README.md               # This file
├── src/
│   ├── main.py             # FastAPI server (n8n HTTP trigger bridge)
│   ├── researcher.py       # Shopee product research
│   ├── content_gen.py      # Gemini scripts + Pollinations images
│   ├── telegram_bot.py     # Human-in-loop approval
│   ├── uploader.py         # TikTok Content Posting API
│   └── utils/
│       ├── logger.py       # Structured JSON logging
│       └── helpers.py      # Metadata, jitter, URL shortener
├── n8n/
│   └── workflow.json       # Importable n8n workflow
├── scripts/
│   └── init_db.sql         # PostgreSQL schema
└── data/
    ├── images/             # Generated product images (gitignored)
    ├── videos/             # Generated videos (gitignored)
    ├── products.json       # Scraped products (generated)
    └── scripts.json        # Generated content packages (generated)
```

---

## Anti-Ban Safety Measures

- **Metadata Scrubbing:** All images have EXIF data stripped then re-injected with realistic fake camera data (iPhone/Pixel models)
- **Random Jitter Delays:** Posts are delayed by base ± 40% (e.g., 5min becomes 3–7min), preventing identical post times
- **User-Agent Rotation:** TikTok API calls rotate through realistic mobile app user-agents
- **Rate Limiting:** Respects Gemini free tier (15 req/min) with retry + exponential backoff

---

## Troubleshooting

**n8n can't connect to postgres:**
```bash
docker-compose logs postgres
# Wait for "database system is ready to accept connections"
```

**Gemini API 429 (rate limit):**
- Free tier is 15 requests/min. The agent auto-retries with backoff.
- If persistent, check your quota at https://aistudio.google.com

**Telegram bot not receiving messages:**
- Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are correct
- For webhooks: ensure your webhook URL is publicly accessible (HTTPS required by Telegram)
- Use polling mode for local development instead

**TikTok upload failing:**
- Check your access token hasn't expired (24hr TTL, refresh token is 365 days)
- Ensure you have Content Posting API access approved
- Test with `dry_run=True` first

---

## Content Style Guide

Scripts are generated in **Indonesian "Bahasa Gaul"** using the **PAS framework**:

| Section | Purpose | Example |
|---|---|---|
| **Hook** (0–3s) | Stop the scroll | *"Ini gila sih, worth banget! 😱"* |
| **Problem** (3–15s) | Identify a relatable pain point | *"Capek nyapu tiap hari tapi lantai tetep kotor?"* |
| **Agitate** (15–35s) | Make the problem feel urgent | *"Apalagi kalau ada bayi di rumah, debu dan kuman bahaya banget!"* |
| **Solution** (35–50s) | Present the product as the answer | *"Nah ini dia solusinya! [Product] auto bersihin rumah lo!"* |
| **CTA** (50–60s) | FOMO-driven call to action | *"Cekout sekarang! Stok tinggal dikit, link di bio! 🛒"* |

---

## License

MIT — for educational and personal use only. Ensure compliance with TikTok's Terms of Service and Shopee Affiliate Program policies.
