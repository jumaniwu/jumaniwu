"""
main.py — FastAPI Agent Server

Exposes HTTP endpoints that n8n triggers via Execute Command / HTTP Request nodes.
This is the bridge between n8n's orchestration and the Python modules.

Endpoints:
  POST /run/research      — Run ShopeeResearcher, return products JSON
  POST /run/content       — Run ContentEngine on fetched products
  POST /run/approve       — Send content to Telegram and await approval
  POST /run/upload        — Upload approved content to TikTok
  GET  /health            — Health check
  POST /telegram/webhook  — Telegram bot webhook callback handler
"""

import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from telegram import Update

from .content_gen import ContentEngine
from .researcher import ShopeeResearcher
from .telegram_bot import TelegramApprovalBot
from .uploader import TikTokUploader
from .utils.logger import get_logger

load_dotenv()
log = get_logger("main")

app = FastAPI(title="AI Affiliate Agent", version="1.0.0")

DATA_DIR = Path(os.getenv("DATA_DIR", "data"))

# ── Singleton module instances ─────────────────────────────────────────────────
_researcher: Optional[ShopeeResearcher] = None
_content_engine: Optional[ContentEngine] = None
_telegram_bot: Optional[TelegramApprovalBot] = None
_tiktok_uploader: Optional[TikTokUploader] = None


def get_researcher() -> ShopeeResearcher:
    global _researcher
    if _researcher is None:
        _researcher = ShopeeResearcher()
    return _researcher


def get_content_engine() -> ContentEngine:
    global _content_engine
    if _content_engine is None:
        _content_engine = ContentEngine()
    return _content_engine


def get_telegram_bot() -> TelegramApprovalBot:
    global _telegram_bot
    if _telegram_bot is None:
        _telegram_bot = TelegramApprovalBot()
    return _telegram_bot


def get_uploader(dry_run: bool = False) -> TikTokUploader:
    global _tiktok_uploader
    if _tiktok_uploader is None:
        _tiktok_uploader = TikTokUploader(dry_run=dry_run)
    return _tiktok_uploader


# ── Pydantic Schemas ───────────────────────────────────────────────────────────

class ApproveRequest(BaseModel):
    content_index: int = 0  # Which package from scripts.json to approve


class UploadRequest(BaseModel):
    approval_id: str
    dry_run: bool = False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "affiliate-agent"}


@app.post("/run/research")
async def run_research():
    """Fetch trending Shopee products and save to data/products.json."""
    try:
        researcher = get_researcher()
        products = await researcher.fetch_products()
        return {
            "success": True,
            "count": len(products),
            "products_path": str(DATA_DIR / "products.json"),
            "preview": [
                {"name": p.get("name"), "rating": p.get("rating"), "sold": p.get("sold_monthly")}
                for p in products[:3]
            ],
        }
    except Exception as exc:
        log.error("research_endpoint_failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/run/content")
async def run_content():
    """Generate scripts and images for products from data/products.json."""
    products_path = DATA_DIR / "products.json"
    if not products_path.exists():
        raise HTTPException(status_code=404, detail="products.json not found. Run /run/research first.")

    with open(products_path, encoding="utf-8") as f:
        products = json.load(f)

    if not products:
        raise HTTPException(status_code=404, detail="No products found in products.json.")

    try:
        engine = get_content_engine()
        # Process up to 3 products per cycle (rate limit consideration)
        packages = await engine.generate_all(products[:3])
        return {
            "success": True,
            "count": len(packages),
            "scripts_path": str(DATA_DIR / "scripts.json"),
        }
    except Exception as exc:
        log.error("content_endpoint_failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/run/approve")
async def run_approve(req: ApproveRequest):
    """Send content package to Telegram for approval and return the approval_id."""
    scripts_path = DATA_DIR / "scripts.json"
    if not scripts_path.exists():
        raise HTTPException(status_code=404, detail="scripts.json not found. Run /run/content first.")

    with open(scripts_path, encoding="utf-8") as f:
        packages = json.load(f)

    if req.content_index >= len(packages):
        raise HTTPException(status_code=404, detail=f"No package at index {req.content_index}.")

    pkg = packages[req.content_index]
    content_package = {
        "product": {
            "name": pkg.get("product_name", ""),
            "affiliate_url": pkg.get("product_url", ""),
            "price": 0,
            "rating": 0,
            "sold_monthly": 0,
        },
        "script": pkg.get("script", {}),
        "image_path": pkg.get("image_path"),
    }

    try:
        bot = get_telegram_bot()
        approval_id = await bot.send_approval_request(content_package)
        return {
            "success": True,
            "approval_id": approval_id,
            "message": "Approval request sent to Telegram. Use /run/upload with this approval_id.",
        }
    except Exception as exc:
        log.error("approve_endpoint_failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/run/upload")
async def run_upload(req: UploadRequest):
    """Wait for Telegram approval then upload to TikTok."""
    scripts_path = DATA_DIR / "scripts.json"
    if not scripts_path.exists():
        raise HTTPException(status_code=404, detail="scripts.json not found.")

    with open(scripts_path, encoding="utf-8") as f:
        packages = json.load(f)

    if not packages:
        raise HTTPException(status_code=404, detail="No content packages found.")

    pkg = packages[0]

    try:
        # Wait for approval signal from Telegram
        bot = get_telegram_bot()
        approved = await bot.wait_for_approval(req.approval_id, timeout=3600)

        if not approved:
            return {"success": False, "reason": "rejected_or_timeout"}

        # Upload to TikTok
        image_path = pkg.get("image_path")
        script = pkg.get("script", {})
        caption = script.get("caption", pkg.get("product_name", ""))
        hashtags = script.get("hashtags", [])

        uploader = get_uploader(dry_run=req.dry_run)

        if image_path and Path(image_path).exists():
            result = await uploader.upload_photo_post(
                image_paths=[image_path],
                caption=caption,
                hashtags=hashtags,
            )
        else:
            raise HTTPException(status_code=404, detail=f"Image not found: {image_path}")

        return {"success": True, "tiktok_result": result}
    except Exception as exc:
        log.error("upload_endpoint_failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    """Receive Telegram webhook updates and dispatch to bot handler."""
    try:
        data = await request.json()
        bot = get_telegram_bot()
        update = Update.de_json(data, bot._bot)
        if update.callback_query:
            await bot.handle_callback_query(update, None)
        return JSONResponse({"ok": True})
    except Exception as exc:
        log.error("telegram_webhook_failed", error=str(exc))
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=200)
        # Always return 200 to Telegram (otherwise it retries)
