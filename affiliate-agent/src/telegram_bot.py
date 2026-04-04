"""
telegram_bot.py — Human-in-the-Loop Approval System

Sends a content package (script preview + product image + affiliate link)
to Telegram and waits for an explicit ✅ Approve or ❌ Reject decision
before allowing the uploader to proceed.

Approval state is stored in Redis with a 1-hour TTL.
The bot listens for callback_query events from inline keyboard buttons.

Usage:
    bot = TelegramApprovalBot()
    approval_id = await bot.send_approval_request(content_package)
    approved = await bot.wait_for_approval(approval_id, timeout=3600)
    if approved:
        await uploader.upload(...)
"""

import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import redis.asyncio as aioredis
from dotenv import load_dotenv
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.error import TelegramError
from telegram.ext import Application, CallbackQueryHandler, ContextTypes
from tenacity import retry, stop_after_attempt, wait_exponential

from .utils.logger import get_logger

load_dotenv()
log = get_logger("telegram_bot")

# ─── Configuration ────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
REDIS_TTL = 3600  # 1 hour TTL for pending approvals
APPROVAL_TIMEOUT = 3600  # Wait up to 1 hour for a response
REDIS_CHANNEL_PREFIX = "affiliate:approval:"

# ─── Approval Bot ─────────────────────────────────────────────────────────────


class TelegramApprovalBot:
    """Send content for human review and wait for approval/rejection via Telegram."""

    def __init__(
        self,
        token: Optional[str] = None,
        chat_id: Optional[str] = None,
        redis_url: Optional[str] = None,
    ):
        self.token = token or os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.chat_id = chat_id or os.getenv("TELEGRAM_CHAT_ID", "")
        self.redis_url = redis_url or REDIS_URL

        if not self.token:
            raise ValueError("TELEGRAM_BOT_TOKEN is required")
        if not self.chat_id:
            raise ValueError("TELEGRAM_CHAT_ID is required")

        self._bot = Bot(token=self.token)
        self._redis: Optional[aioredis.Redis] = None

    # ── Redis Connection ──────────────────────────────────────────────────────

    async def _get_redis(self) -> aioredis.Redis:
        """Lazy-initialise Redis async client."""
        if self._redis is None:
            self._redis = await aioredis.from_url(
                self.redis_url, encoding="utf-8", decode_responses=True
            )
        return self._redis

    # ── Public API ────────────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
    async def send_approval_request(self, content_package: dict) -> str:
        """Send content package to Telegram and create a pending approval entry.

        Args:
            content_package: Dict from content_gen.py with 'product', 'script',
                             'image_path' keys.

        Returns:
            approval_id (UUID string) to pass to wait_for_approval().
        """
        approval_id = str(uuid.uuid4())
        product = content_package.get("product", {})
        script = content_package.get("script", {})
        image_path = content_package.get("image_path")

        # Build the approval message text
        message_text = self._format_approval_message(product, script, approval_id)

        # Inline keyboard with Approve / Reject buttons
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton(
                    "✅ APPROVE — Post ke TikTok",
                    callback_data=f"approve:{approval_id}",
                ),
            ],
            [
                InlineKeyboardButton(
                    "❌ REJECT — Skip",
                    callback_data=f"reject:{approval_id}",
                ),
            ],
        ])

        telegram_msg_id = None

        try:
            if image_path and Path(image_path).exists():
                # Send image with caption
                with open(image_path, "rb") as img_file:
                    msg = await self._bot.send_photo(
                        chat_id=self.chat_id,
                        photo=img_file,
                        caption=message_text,
                        parse_mode="HTML",
                        reply_markup=keyboard,
                    )
            else:
                # Send text only
                msg = await self._bot.send_message(
                    chat_id=self.chat_id,
                    text=message_text,
                    parse_mode="HTML",
                    reply_markup=keyboard,
                )
            telegram_msg_id = msg.message_id
            log.info("approval_request_sent", approval_id=approval_id, msg_id=telegram_msg_id)
        except TelegramError as exc:
            log.error("telegram_send_failed", approval_id=approval_id, error=str(exc))
            raise

        # Store pending approval in Redis
        redis = await self._get_redis()
        approval_data = {
            "approval_id": approval_id,
            "status": "pending",
            "product_name": product.get("name", ""),
            "telegram_msg_id": telegram_msg_id,
            "requested_at": datetime.utcnow().isoformat(),
        }
        await redis.setex(
            f"affiliate:approval:{approval_id}",
            REDIS_TTL,
            json.dumps(approval_data),
        )

        return approval_id

    async def wait_for_approval(
        self,
        approval_id: str,
        timeout: int = APPROVAL_TIMEOUT,
    ) -> bool:
        """Block until the user approves or rejects, or until timeout.

        Uses Redis pub/sub to receive the decision signal published by
        handle_callback_query().

        Args:
            approval_id: The UUID returned by send_approval_request().
            timeout: Maximum seconds to wait (default: 3600 = 1 hour).

        Returns:
            True if approved, False if rejected or timed out.
        """
        channel = f"{REDIS_CHANNEL_PREFIX}{approval_id}"
        redis = await self._get_redis()
        pubsub = redis.pubsub()

        await pubsub.subscribe(channel)
        log.info("waiting_for_approval", approval_id=approval_id, timeout_sec=timeout)

        try:
            start = asyncio.get_event_loop().time()
            async for message in pubsub.listen():
                if message["type"] == "message":
                    decision = message["data"]
                    log.info(
                        "approval_decision_received",
                        approval_id=approval_id,
                        decision=decision,
                    )
                    return decision == "approved"

                elapsed = asyncio.get_event_loop().time() - start
                if elapsed >= timeout:
                    log.warning(
                        "approval_timeout",
                        approval_id=approval_id,
                        elapsed_sec=int(elapsed),
                    )
                    return False
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

        return False

    async def handle_callback_query(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Telegram CallbackQueryHandler — process Approve/Reject button taps.

        Publishes the decision to Redis so wait_for_approval() unblocks.

        Args:
            update: Telegram Update object.
            context: Telegram context (unused).
        """
        query = update.callback_query
        await query.answer()

        data = query.data or ""
        if ":" not in data:
            return

        action, approval_id = data.split(":", 1)
        decision = "approved" if action == "approve" else "rejected"

        # Publish decision to Redis channel
        redis = await self._get_redis()
        channel = f"{REDIS_CHANNEL_PREFIX}{approval_id}"
        await redis.publish(channel, decision)

        # Update the stored approval record
        key = f"affiliate:approval:{approval_id}"
        raw = await redis.get(key)
        if raw:
            record = json.loads(raw)
            record["status"] = decision
            record["decided_at"] = datetime.utcnow().isoformat()
            await redis.setex(key, REDIS_TTL, json.dumps(record))

        # Edit the Telegram message to show the decision
        status_emoji = "✅" if decision == "approved" else "❌"
        status_text = "APPROVED — akan diposting ke TikTok!" if decision == "approved" else "REJECTED — konten dilewati."

        try:
            await query.edit_message_caption(
                caption=f"{query.message.caption or ''}\n\n{status_emoji} <b>{status_text}</b>",
                parse_mode="HTML",
                reply_markup=None,
            )
        except TelegramError:
            # If edit fails (e.g., text-only message), try edit_message_text
            try:
                await query.edit_message_text(
                    text=f"{query.message.text or ''}\n\n{status_emoji} <b>{status_text}</b>",
                    parse_mode="HTML",
                    reply_markup=None,
                )
            except TelegramError as exc:
                log.warning("callback_edit_failed", error=str(exc))

        log.info(
            "callback_processed",
            approval_id=approval_id,
            decision=decision,
            user=query.from_user.username if query.from_user else "unknown",
        )

    # ── Formatting ────────────────────────────────────────────────────────────

    def _format_approval_message(
        self, product: dict, script: dict, approval_id: str
    ) -> str:
        """Format the Telegram approval message with product and script details."""
        name = product.get("name", "Unknown Product")
        price = product.get("price", 0)
        rating = product.get("rating", 0)
        sold = product.get("sold_monthly", 0)
        affiliate_url = product.get("affiliate_url", product.get("shopee_url", ""))

        hook = script.get("hook", "")
        cta = script.get("cta", "")
        hashtags = " ".join(script.get("hashtags", [])[:5])

        return (
            f"🤖 <b>AFFILIATE AGENT — Approval Request</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━\n\n"
            f"📦 <b>Produk:</b> {name}\n"
            f"💰 <b>Harga:</b> Rp {price:,.0f}\n"
            f"⭐ <b>Rating:</b> {rating} | 📦 <b>Terjual:</b> {sold}/bln\n\n"
            f"🎬 <b>SCRIPT PREVIEW</b>\n"
            f"<i>Hook:</i> {hook}\n"
            f"<i>CTA:</i> {cta}\n\n"
            f"🏷️ {hashtags}\n\n"
            f"🔗 <b>Affiliate Link:</b>\n{affiliate_url[:100]}\n\n"
            f"🆔 ID: <code>{approval_id[:8]}...</code>\n\n"
            f"Pilih keputusan di bawah 👇"
        )

    # ── Webhook Server ────────────────────────────────────────────────────────

    async def start_webhook_server(self, webhook_url: str, port: int = 8080) -> None:
        """Start the Telegram webhook listener application.

        This should be run as a background task in the agent service.
        n8n can also handle Telegram webhooks natively — this is the
        Python-only alternative.

        Args:
            webhook_url: Public HTTPS URL for Telegram to send updates to.
            port: Local port to listen on.
        """
        app = (
            Application.builder()
            .token(self.token)
            .build()
        )
        app.add_handler(CallbackQueryHandler(self.handle_callback_query))

        await app.bot.set_webhook(url=f"{webhook_url}/telegram/webhook")
        log.info("webhook_server_started", webhook_url=webhook_url, port=port)

        async with app:
            await app.start()
            await app.updater.start_webhook(
                listen="0.0.0.0",
                port=port,
                url_path="/telegram/webhook",
                webhook_url=f"{webhook_url}/telegram/webhook",
            )
            await asyncio.Event().wait()  # Run indefinitely


# ─── CLI Entry Point ──────────────────────────────────────────────────────────


async def main():
    """Test: send a sample approval request and wait for response."""
    import json
    from pathlib import Path

    scripts_path = Path("data/scripts.json")
    if not scripts_path.exists():
        print("❌ data/scripts.json not found. Run content_gen.py first.")
        return

    with open(scripts_path, encoding="utf-8") as f:
        packages = json.load(f)

    if not packages:
        print("❌ No content packages found.")
        return

    pkg = packages[0]
    # Reconstruct the package format expected by send_approval_request
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

    bot = TelegramApprovalBot()
    approval_id = await bot.send_approval_request(content_package)
    print(f"✅ Approval request sent! ID: {approval_id}")
    print("⏳ Waiting for your response in Telegram (timeout: 5 min for test)...")

    approved = await bot.wait_for_approval(approval_id, timeout=300)
    print(f"{'✅ APPROVED' if approved else '❌ REJECTED/TIMEOUT'}")


if __name__ == "__main__":
    asyncio.run(main())
