"""
uploader.py — TikTok Content Posting Module

Handles the complete TikTok upload pipeline:
1. OAuth2 token management (refresh when expired)
2. Media preparation: EXIF strip + metadata randomisation
3. TikTok Content Posting API: init → upload → publish → poll status
4. Anti-ban safety: randomised posting delays, user-agent rotation

Supports: Photo Post (carousel) and Video Post

TikTok Content Posting API docs:
https://developers.tiktok.com/doc/content-posting-api-reference-direct-post/

IMPORTANT: You must apply for Content Posting API access at:
https://developers.tiktok.com/products/content-posting-api/
The initial OAuth2 token must be obtained manually (see README.md).
Subsequent refreshes are automated.
"""

import asyncio
import json
import os
import random
import time
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .utils.helpers import (
    jitter_delay,
    randomize_metadata,
    strip_metadata,
)
from .utils.logger import get_logger

load_dotenv()
log = get_logger("uploader")

# ─── Constants ────────────────────────────────────────────────────────────────

TIKTOK_API_BASE = "https://open.tiktokapis.com"
TIKTOK_AUTH_URL = "https://open.tiktokapis.com/v2/oauth/token/"
TIKTOK_INIT_URL = f"{TIKTOK_API_BASE}/v2/post/publish/content/init/"
TIKTOK_STATUS_URL = f"{TIKTOK_API_BASE}/v2/post/publish/status/fetch/"

POST_STATUS_POLL_INTERVAL = 10  # seconds between status polls
POST_STATUS_MAX_POLLS = 30       # max ~5 minutes of polling

# Random user-agents to rotate through (mimics real mobile TikTok users)
_USER_AGENTS = [
    "com.zhiliaoapp.musically/2022702030 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230705.001; Cronet/58.0.2991.0)",
    "com.zhiliaoapp.musically/2022702030 (Linux; U; Android 12; en_US; SM-G991B; Build/SP1A.210812.016; Cronet/58.0.2991.0)",
    "TikTok 26.2.0 rv:262018 (iPhone; iOS 16.2; en_US) Cronet",
    "TikTok 26.5.3 rv:265301 (iPhone; iOS 17.1; en_US) Cronet",
]

DATA_DIR = Path(os.getenv("DATA_DIR", "data"))


# ─── Main Uploader Class ──────────────────────────────────────────────────────


class TikTokUploader:
    """Upload approved content to TikTok via the Content Posting API."""

    def __init__(
        self,
        client_key: Optional[str] = None,
        client_secret: Optional[str] = None,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        open_id: Optional[str] = None,
        dry_run: bool = False,
    ):
        """
        Args:
            client_key: TikTok app client key.
            client_secret: TikTok app client secret.
            access_token: Current OAuth2 access token.
            refresh_token: OAuth2 refresh token for auto-renewal.
            open_id: TikTok user's open_id.
            dry_run: If True, skip actual API calls (for testing).
        """
        self.client_key = client_key or os.getenv("TIKTOK_CLIENT_KEY", "")
        self.client_secret = client_secret or os.getenv("TIKTOK_CLIENT_SECRET", "")
        self.access_token = access_token or os.getenv("TIKTOK_ACCESS_TOKEN", "")
        self.refresh_token = refresh_token or os.getenv("TIKTOK_REFRESH_TOKEN", "")
        self.open_id = open_id or os.getenv("TIKTOK_OPEN_ID", "")
        self.dry_run = dry_run

        if not self.client_key:
            log.warning("tiktok_client_key_missing", note="Set TIKTOK_CLIENT_KEY in .env")

    # ── Public Upload Methods ─────────────────────────────────────────────────

    async def upload_photo_post(
        self,
        image_paths: list[str],
        caption: str,
        hashtags: Optional[list[str]] = None,
        auto_add_music: bool = True,
    ) -> dict:
        """Upload a photo carousel post to TikTok.

        Applies jitter delay before posting to avoid bot detection.

        Args:
            image_paths: List of local image file paths (max 35 images).
            caption: Post caption with hashtags.
            hashtags: Additional hashtags to append to caption.
            auto_add_music: Whether to let TikTok auto-select trending music.

        Returns:
            Dict with publish_id, status, and post_url (if available).
        """
        log.info("upload_photo_start", images=len(image_paths), dry_run=self.dry_run)

        # Prepare media (strip/randomise metadata)
        clean_paths = self._scrub_and_prepare_media(image_paths)

        # Build full caption with hashtags
        full_caption = self._build_caption(caption, hashtags)

        if self.dry_run:
            log.info("dry_run_photo_post", caption=full_caption[:80], images=len(clean_paths))
            return {"publish_id": "DRY_RUN_123", "status": "DRY_RUN", "dry_run": True}

        # Apply anti-ban jitter delay (base: 5 min ± 40%)
        await jitter_delay(base_seconds=300, variance_pct=0.4)

        # Ensure token is valid
        await self._ensure_valid_token()

        # Init upload session
        init_resp = await self._init_photo_upload(clean_paths, full_caption, auto_add_music)
        publish_id = init_resp.get("publish_id")

        if not publish_id:
            raise RuntimeError(f"TikTok init failed: {init_resp}")

        # Upload each image
        upload_urls = init_resp.get("upload_urls", [])
        for i, (path, url) in enumerate(zip(clean_paths, upload_urls)):
            await self._upload_file(url, path)
            log.info("image_uploaded", index=i + 1, total=len(clean_paths))

        # Poll for publish status
        result = await self._poll_publish_status(publish_id)
        log.info("photo_post_complete", publish_id=publish_id, status=result.get("status"))
        return result

    async def upload_video_post(
        self,
        video_path: str,
        caption: str,
        hashtags: Optional[list[str]] = None,
    ) -> dict:
        """Upload a video post to TikTok.

        Args:
            video_path: Local path to the video file.
            caption: Post caption.
            hashtags: Optional hashtag list to append.

        Returns:
            Dict with publish_id, status.
        """
        log.info("upload_video_start", video=video_path, dry_run=self.dry_run)

        full_caption = self._build_caption(caption, hashtags)

        if self.dry_run:
            log.info("dry_run_video_post", caption=full_caption[:80])
            return {"publish_id": "DRY_RUN_456", "status": "DRY_RUN", "dry_run": True}

        await jitter_delay(base_seconds=300, variance_pct=0.4)
        await self._ensure_valid_token()

        init_resp = await self._init_video_upload(video_path, full_caption)
        publish_id = init_resp.get("publish_id")
        upload_url = init_resp.get("upload_url")

        if not publish_id or not upload_url:
            raise RuntimeError(f"TikTok video init failed: {init_resp}")

        await self._upload_file(upload_url, video_path)
        result = await self._poll_publish_status(publish_id)
        log.info("video_post_complete", publish_id=publish_id, status=result.get("status"))
        return result

    # ── Token Management ──────────────────────────────────────────────────────

    async def _ensure_valid_token(self) -> None:
        """Refresh the access token if it's missing or expired."""
        if not self.access_token and self.refresh_token:
            await self._refresh_token()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
    async def _refresh_token(self) -> None:
        """Refresh TikTok OAuth2 access token using the refresh token."""
        log.info("token_refresh_start")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                TIKTOK_AUTH_URL,
                data={
                    "client_key": self.client_key,
                    "client_secret": self.client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": self.refresh_token,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            data = resp.json()

        self.access_token = data.get("access_token", "")
        self.refresh_token = data.get("refresh_token", self.refresh_token)
        log.info("token_refreshed", expires_in=data.get("expires_in"))

        # Persist updated tokens to .env (best-effort)
        self._update_env_tokens()

    def _update_env_tokens(self) -> None:
        """Write refreshed tokens back to .env file (best-effort)."""
        env_path = Path(".env")
        if not env_path.exists():
            return
        try:
            content = env_path.read_text()
            content = _replace_env_var(content, "TIKTOK_ACCESS_TOKEN", self.access_token)
            content = _replace_env_var(content, "TIKTOK_REFRESH_TOKEN", self.refresh_token)
            env_path.write_text(content)
            log.info("env_tokens_updated")
        except Exception as exc:
            log.warning("env_token_update_failed", error=str(exc))

    # ── TikTok API Calls ──────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=30))
    async def _init_photo_upload(
        self, image_paths: list[str], caption: str, auto_add_music: bool
    ) -> dict:
        """Call TikTok Content Posting API to initialise a photo post upload."""
        image_sizes = [Path(p).stat().st_size for p in image_paths]

        payload = {
            "post_info": {
                "title": caption[:2200],  # TikTok max caption length
                "privacy_level": "PUBLIC_TO_EVERYONE",
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
                "auto_add_music": auto_add_music,
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "photo_cover_index": 0,
                "photo_images": [
                    {"size": size} for size in image_sizes
                ],
            },
            "media_type": "PHOTO",
        }

        return await self._api_post(TIKTOK_INIT_URL, payload)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=30))
    async def _init_video_upload(self, video_path: str, caption: str) -> dict:
        """Call TikTok Content Posting API to initialise a video post upload."""
        video_size = Path(video_path).stat().st_size

        payload = {
            "post_info": {
                "title": caption[:2200],
                "privacy_level": "PUBLIC_TO_EVERYONE",
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": video_size,
                "chunk_size": min(video_size, 10 * 1024 * 1024),  # 10MB chunks
                "total_chunk_count": 1,
            },
            "media_type": "VIDEO",
        }

        return await self._api_post(TIKTOK_INIT_URL, payload)

    async def _upload_file(self, upload_url: str, file_path: str) -> None:
        """Upload a file binary to TikTok's provided upload URL."""
        file_size = Path(file_path).stat().st_size
        content_type = "image/jpeg" if file_path.endswith((".jpg", ".jpeg")) else "video/mp4"

        with open(file_path, "rb") as f:
            file_data = f.read()

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.put(
                upload_url,
                content=file_data,
                headers={
                    "Content-Type": content_type,
                    "Content-Length": str(file_size),
                    "Content-Range": f"bytes 0-{file_size - 1}/{file_size}",
                },
            )
            resp.raise_for_status()
        log.info("file_uploaded", path=file_path, size_kb=file_size // 1024)

    async def _poll_publish_status(self, publish_id: str) -> dict:
        """Poll TikTok until the post is published, failed, or max polls reached."""
        for attempt in range(POST_STATUS_MAX_POLLS):
            await asyncio.sleep(POST_STATUS_POLL_INTERVAL)

            payload = {"publish_id": publish_id}
            result = await self._api_post(TIKTOK_STATUS_URL, payload)
            status = result.get("status", "UNKNOWN")

            log.info(
                "publish_status_poll",
                publish_id=publish_id,
                status=status,
                attempt=attempt + 1,
            )

            if status in ("PUBLISH_COMPLETE", "SUCCESS"):
                return {"publish_id": publish_id, "status": "published", **result}
            if status in ("FAILED", "ERROR"):
                raise RuntimeError(f"TikTok publish failed: {result}")

        raise TimeoutError(f"TikTok publish polling timed out after {POST_STATUS_MAX_POLLS} attempts")

    async def _api_post(self, url: str, payload: dict) -> dict:
        """POST to TikTok API with auth headers and random user-agent."""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=UTF-8",
            "User-Agent": random.choice(_USER_AGENTS),
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if data.get("error", {}).get("code", "ok") != "ok":
            raise RuntimeError(f"TikTok API error: {data['error']}")

        return data.get("data", data)

    # ── Media Preparation ─────────────────────────────────────────────────────

    def _scrub_and_prepare_media(self, file_paths: list[str]) -> list[str]:
        """Strip EXIF, inject fake metadata, and return clean file paths."""
        clean = []
        for path in file_paths:
            try:
                stripped = strip_metadata(path)
                randomized = randomize_metadata(stripped)
                clean.append(randomized)
            except Exception as exc:
                log.warning("media_prep_failed", path=path, error=str(exc))
                clean.append(path)  # Use original if scrubbing fails
        return clean

    # ── Caption Builder ───────────────────────────────────────────────────────

    def _build_caption(self, caption: str, hashtags: Optional[list[str]]) -> str:
        """Combine caption and hashtags, respecting TikTok's 2200-char limit."""
        if hashtags:
            tag_string = " ".join(
                h if h.startswith("#") else f"#{h}" for h in hashtags
            )
            full = f"{caption}\n\n{tag_string}"
        else:
            full = caption
        return full[:2200]


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _replace_env_var(content: str, key: str, value: str) -> str:
    """Replace a key=value line in .env file content."""
    import re
    pattern = rf"^{re.escape(key)}=.*$"
    replacement = f"{key}={value}"
    if re.search(pattern, content, re.MULTILINE):
        return re.sub(pattern, replacement, content, flags=re.MULTILINE)
    return content + f"\n{replacement}\n"


# ─── CLI Entry Point ──────────────────────────────────────────────────────────


async def main():
    """Test uploader in dry-run mode with the latest approved content."""
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
    image_path = pkg.get("image_path")
    if not image_path or not Path(image_path).exists():
        print(f"❌ Image not found: {image_path}")
        return

    script = pkg.get("script", {})
    caption = script.get("caption", pkg.get("product_name", "Smart Home Gadget"))
    hashtags = script.get("hashtags", ["#racunshopee", "#fyp"])

    uploader = TikTokUploader(dry_run=True)
    result = await uploader.upload_photo_post(
        image_paths=[image_path],
        caption=caption,
        hashtags=hashtags,
    )
    print(f"\n✅ Dry-run result: {json.dumps(result, indent=2)}")


if __name__ == "__main__":
    asyncio.run(main())
