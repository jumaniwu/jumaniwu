-- ─────────────────────────────────────────────────────────────────────────────
-- AI Affiliate Agent — Database Schema Initialization
-- Run automatically by Docker on first postgres startup
-- ─────────────────────────────────────────────────────────────────────────────

-- Products discovered by researcher.py
CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    price           NUMERIC(12, 2),
    original_price  NUMERIC(12, 2),
    discount_pct    INTEGER,
    rating          NUMERIC(3, 2),
    sold_monthly    INTEGER,
    shopee_url      TEXT UNIQUE NOT NULL,
    affiliate_url   TEXT,
    image_url       TEXT,
    category        TEXT DEFAULT 'Smart Home',
    fetched_at      TIMESTAMPTZ DEFAULT NOW(),
    processed       BOOLEAN DEFAULT FALSE
);

-- Generated content (scripts + image paths)
CREATE TABLE IF NOT EXISTS content (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER REFERENCES products(id) ON DELETE CASCADE,
    hook            TEXT,
    problem         TEXT,
    agitate         TEXT,
    solution        TEXT,
    cta             TEXT,
    caption         TEXT,
    hashtags        TEXT[],
    image_path      TEXT,
    video_path      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    status          TEXT DEFAULT 'pending' -- pending | approved | rejected | posted
);

-- Approval log
CREATE TABLE IF NOT EXISTS approvals (
    id              SERIAL PRIMARY KEY,
    content_id      INTEGER REFERENCES content(id) ON DELETE CASCADE,
    approval_id     TEXT UNIQUE NOT NULL,     -- UUID used in Telegram/Redis
    telegram_msg_id INTEGER,
    decision        TEXT,                      -- approved | rejected | timeout
    decided_at      TIMESTAMPTZ,
    requested_at    TIMESTAMPTZ DEFAULT NOW()
);

-- TikTok post log
CREATE TABLE IF NOT EXISTS tiktok_posts (
    id              SERIAL PRIMARY KEY,
    content_id      INTEGER REFERENCES content(id) ON DELETE CASCADE,
    tiktok_post_id  TEXT,
    publish_id      TEXT,
    status          TEXT DEFAULT 'pending',   -- pending | published | failed
    posted_at       TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_processed ON products(processed);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_approvals_approval_id ON approvals(approval_id);
