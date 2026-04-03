"""
Shared utility functions:
- Image metadata scrubbing / randomisation
- Randomised posting delays (anti-ban jitter)
- Affiliate URL shortening
- Product validation
"""

import asyncio
import io
import os
import random
import struct
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

import httpx
import piexif
from PIL import Image

from .logger import get_logger

log = get_logger("helpers")


# ─────────────────────────────────────────────────────────────────────────────
# Image Metadata
# ─────────────────────────────────────────────────────────────────────────────

_FAKE_CAMERAS = [
    ("Apple", "iPhone 14 Pro"),
    ("Apple", "iPhone 13"),
    ("Samsung", "SM-S918B"),
    ("Google", "Pixel 7"),
    ("Xiaomi", "2210132C"),
]

_FAKE_SOFTWARE = ["17.4.1", "17.2", "16.7.2", "Android 13", "Android 14"]


def strip_metadata(image_path: str) -> str:
    """Remove all EXIF metadata from a JPEG image.

    Opens the image with Pillow (which drops EXIF) and re-saves it.
    The original file is overwritten in-place.

    Args:
        image_path: Absolute path to the image file.

    Returns:
        The same path (modified in-place).
    """
    path = Path(image_path)
    try:
        with Image.open(path) as img:
            # Convert to RGB to safely strip all metadata layers
            clean = img.convert("RGB")
            clean.save(str(path), format="JPEG", quality=92, optimize=True)
        log.info("metadata_stripped", file=path.name)
    except Exception as exc:
        log.warning("metadata_strip_failed", file=path.name, error=str(exc))
    return str(path)


def randomize_metadata(image_path: str) -> str:
    """Inject convincing but fake EXIF metadata into a JPEG to mimic a phone shot.

    Adds camera make/model, software version, and a randomised timestamp so
    the file looks like organic UGC rather than AI-generated content.

    Args:
        image_path: Absolute path to the image file.

    Returns:
        The same path (modified in-place).
    """
    path = Path(image_path)
    try:
        make, model = random.choice(_FAKE_CAMERAS)
        software = random.choice(_FAKE_SOFTWARE)

        # Random date within the last 30 days
        days_ago = random.randint(0, 30)
        hours = random.randint(7, 21)
        minutes = random.randint(0, 59)
        seconds = random.randint(0, 59)
        fake_dt = datetime.now().replace(
            hour=hours, minute=minutes, second=seconds
        )
        dt_str = fake_dt.strftime("%Y:%m:%d %H:%M:%S")

        exif_dict = {
            "0th": {
                piexif.ImageIFD.Make: make.encode(),
                piexif.ImageIFD.Model: model.encode(),
                piexif.ImageIFD.Software: software.encode(),
                piexif.ImageIFD.DateTime: dt_str.encode(),
            },
            "Exif": {
                piexif.ExifIFD.DateTimeOriginal: dt_str.encode(),
                piexif.ExifIFD.DateTimeDigitized: dt_str.encode(),
            },
            "1st": {},
            "GPS": {},
            "Interop": {},
        }

        exif_bytes = piexif.dump(exif_dict)
        piexif.insert(exif_bytes, str(path))
        log.info("metadata_randomized", file=path.name, camera=f"{make} {model}")
    except Exception as exc:
        log.warning("metadata_randomize_failed", file=path.name, error=str(exc))
    return str(path)


# ─────────────────────────────────────────────────────────────────────────────
# Anti-Ban Jitter
# ─────────────────────────────────────────────────────────────────────────────


async def jitter_delay(base_seconds: int = 300, variance_pct: float = 0.4) -> None:
    """Sleep for a randomised duration around a base value.

    Example: base=300s ±40% => sleep between 180s and 420s.
    This prevents the bot from posting at identical clock times.

    Args:
        base_seconds: Centre of the delay range in seconds.
        variance_pct: Fraction of base to vary by (0.4 = ±40%).
    """
    variance = int(base_seconds * variance_pct)
    actual = base_seconds + random.randint(-variance, variance)
    actual = max(actual, 1)
    log.info("jitter_delay", base=base_seconds, actual=actual)
    await asyncio.sleep(actual)


def jitter_delay_sync(base_seconds: int = 300, variance_pct: float = 0.4) -> None:
    """Synchronous version of jitter_delay."""
    variance = int(base_seconds * variance_pct)
    actual = base_seconds + random.randint(-variance, variance)
    actual = max(actual, 1)
    log.info("jitter_delay_sync", base=base_seconds, actual=actual)
    time.sleep(actual)


# ─────────────────────────────────────────────────────────────────────────────
# URL Shortener
# ─────────────────────────────────────────────────────────────────────────────


async def shorten_affiliate_url(long_url: str) -> str:
    """Shorten a Shopee affiliate URL using TinyURL's free API.

    Falls back to the original URL if the request fails.

    Args:
        long_url: Full Shopee affiliate link.

    Returns:
        Shortened URL string.
    """
    try:
        encoded = urllib.parse.quote(long_url, safe="")
        tinyurl_api = f"https://tinyurl.com/api-create.php?url={encoded}"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(tinyurl_api)
            resp.raise_for_status()
            short = resp.text.strip()
            if short.startswith("http"):
                log.info("url_shortened", original=long_url[:60], short=short)
                return short
    except Exception as exc:
        log.warning("url_shortening_failed", error=str(exc), url=long_url[:60])
    return long_url


# ─────────────────────────────────────────────────────────────────────────────
# Product Validation
# ─────────────────────────────────────────────────────────────────────────────


def validate_product(
    product: dict,
    min_rating: float = 4.7,
    min_sold: int = 100,
) -> bool:
    """Validate a product against quality thresholds.

    Args:
        product: Normalised product dict (must have 'rating' and 'sold_monthly').
        min_rating: Minimum acceptable star rating.
        min_sold: Minimum monthly units sold.

    Returns:
        True if the product meets all criteria.
    """
    rating = float(product.get("rating", 0))
    sold = int(product.get("sold_monthly", 0))
    name = product.get("name", "")

    if not name:
        log.debug("product_rejected", reason="no_name")
        return False
    if rating < min_rating:
        log.debug("product_rejected", reason="low_rating", rating=rating, min=min_rating)
        return False
    if sold < min_sold:
        log.debug("product_rejected", reason="low_sales", sold=sold, min=min_sold)
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# File Helpers
# ─────────────────────────────────────────────────────────────────────────────


def ensure_dir(path: str) -> str:
    """Create directory (and parents) if it doesn't exist."""
    Path(path).mkdir(parents=True, exist_ok=True)
    return path


def safe_filename(text: str, max_len: int = 60) -> str:
    """Convert arbitrary text to a safe filesystem filename."""
    safe = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in text)
    return safe[:max_len].strip("_")
