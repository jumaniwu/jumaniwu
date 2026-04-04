"""
researcher.py — Shopee Product Research Module

Fetches trending products in the "Home & Living" / "Smart Home Gadgets" niche
from Shopee via the Apify scraper actor. Falls back to a direct Shopee API
scrape if Apify is unavailable or quota is exhausted.

Filters products by: Rating >= 4.7 | Monthly Sold >= 100

Output: List of normalised product dicts saved to data/products.json
"""

import asyncio
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from apify_client import ApifyClient
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

from .utils.helpers import ensure_dir, validate_product
from .utils.logger import get_logger

load_dotenv()
log = get_logger("researcher")

# ─── Constants ────────────────────────────────────────────────────────────────

# Apify actor IDs to try in order (first available with quota wins)
APIFY_ACTOR_IDS = [
    "bebity/shopee-products-scraper",
    "apify/shopee-scraper",
]

TARGET_KEYWORDS = [
    kw.strip()
    for kw in os.getenv(
        "TARGET_KEYWORDS",
        "lampu LED pintar,smart plug,robot vacuum,air purifier,kitchen gadget,smart home",
    ).split(",")
    if kw.strip()
]

MIN_RATING = float(os.getenv("MIN_PRODUCT_RATING", "4.7"))
MIN_SOLD = int(os.getenv("MIN_MONTHLY_SOLD", "100"))
DATA_DIR = Path(os.getenv("DATA_DIR", "data"))

# Shopee's internal search API (fallback)
SHOPEE_SEARCH_API = "https://shopee.co.id/api/v4/search/search_items"
SHOPEE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Mobile Safari/537.36"
    ),
    "Referer": "https://shopee.co.id/",
    "X-API-SOURCE": "pc",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
}


# ─── Main Class ───────────────────────────────────────────────────────────────


class ShopeeResearcher:
    """Fetch and filter trending Shopee products for affiliate content creation."""

    def __init__(self, apify_token: Optional[str] = None):
        self.apify_token = apify_token or os.getenv("APIFY_TOKEN", "")
        self._apify_client = ApifyClient(self.apify_token) if self.apify_token else None
        ensure_dir(str(DATA_DIR / "images"))
        ensure_dir(str(DATA_DIR / "videos"))

    # ── Public API ────────────────────────────────────────────────────────────

    async def fetch_products(
        self, keywords: Optional[list[str]] = None
    ) -> list[dict]:
        """Fetch, filter, and return products for the given keyword list.

        Tries Apify first; falls back to direct scraping.

        Args:
            keywords: List of search keywords. Defaults to TARGET_KEYWORDS.

        Returns:
            List of normalised + validated product dicts.
        """
        keywords = keywords or TARGET_KEYWORDS
        log.info("research_start", keywords=keywords, min_rating=MIN_RATING, min_sold=MIN_SOLD)

        all_raw: list[dict] = []

        for kw in keywords:
            try:
                if self._apify_client:
                    raw = await self._run_apify_actor(kw)
                else:
                    raw = await self._fallback_scrape(kw)
                log.info("keyword_scraped", keyword=kw, count=len(raw))
                all_raw.extend(raw)
            except Exception as exc:
                log.error("keyword_scrape_failed", keyword=kw, error=str(exc))

        normalised = [self._normalize_product(p) for p in all_raw]
        filtered = self._filter_products(normalised)

        # Deduplicate by shopee_url
        seen: set[str] = set()
        unique = []
        for p in filtered:
            url = p.get("shopee_url", "")
            if url and url not in seen:
                seen.add(url)
                unique.append(p)

        log.info("research_complete", total_scraped=len(all_raw), after_filter=len(unique))
        self._save_products(unique)
        return unique

    # ── Apify Scraping ────────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=5, max=30))
    async def _run_apify_actor(self, keyword: str) -> list[dict]:
        """Run an Apify actor to scrape Shopee search results.

        Tries each actor ID in APIFY_ACTOR_IDS until one succeeds.

        Args:
            keyword: Shopee search keyword.

        Returns:
            Raw list of item dicts from the actor dataset.
        """
        if not self._apify_client:
            return await self._fallback_scrape(keyword)

        actor_input = {
            "keyword": keyword,
            "maxItems": 30,
            "countryCode": "id",
            "sortBy": "sales",  # Sort by highest sales
        }

        for actor_id in APIFY_ACTOR_IDS:
            try:
                log.info("apify_actor_start", actor=actor_id, keyword=keyword)
                run = self._apify_client.actor(actor_id).call(run_input=actor_input)
                items = list(
                    self._apify_client.dataset(run["defaultDatasetId"]).iterate_items()
                )
                log.info("apify_actor_done", actor=actor_id, items=len(items))
                return items
            except Exception as exc:
                log.warning("apify_actor_failed", actor=actor_id, error=str(exc))

        # All Apify actors failed — fall back
        return await self._fallback_scrape(keyword)

    # ── Fallback Scraper ──────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=20))
    async def _fallback_scrape(self, keyword: str) -> list[dict]:
        """Direct async scrape of Shopee's internal search API.

        Uses Shopee's mobile/web API endpoint which returns structured JSON.

        Args:
            keyword: Search term.

        Returns:
            List of raw product dicts from Shopee's response.
        """
        log.info("fallback_scrape_start", keyword=keyword)
        params = {
            "by": "sales",
            "keyword": keyword,
            "limit": 30,
            "newest": 0,
            "order": "desc",
            "page_type": "search",
            "scenario": "PAGE_GLOBAL_SEARCH",
            "version": 2,
        }

        async with httpx.AsyncClient(
            headers=SHOPEE_HEADERS, timeout=30, follow_redirects=True
        ) as client:
            resp = await client.get(SHOPEE_SEARCH_API, params=params)
            resp.raise_for_status()
            data = resp.json()

        items = data.get("items", []) or []
        log.info("fallback_scrape_done", keyword=keyword, items=len(items))
        return items

    # ── Normalisation ─────────────────────────────────────────────────────────

    def _normalize_product(self, raw: dict) -> dict:
        """Convert raw Shopee/Apify item to a standard product schema.

        Handles differences between Apify actor output and direct Shopee API.

        Args:
            raw: Raw product dict from scraper.

        Returns:
            Normalised product dict.
        """
        # Try Apify actor output first, then direct Shopee API format
        item = raw.get("item_basic", raw)  # Shopee API wraps in item_basic

        name = (
            item.get("name")
            or item.get("title")
            or item.get("productName")
            or ""
        )
        description = (
            item.get("description")
            or item.get("desc")
            or ""
        )[:500]  # Truncate long descriptions

        # Price handling (Shopee stores prices * 100000)
        price_raw = item.get("price") or item.get("price_min") or 0
        price = _parse_shopee_price(price_raw)

        orig_price_raw = item.get("price_before_discount") or item.get("original_price") or 0
        original_price = _parse_shopee_price(orig_price_raw) or price

        discount_pct = 0
        if original_price and original_price > price:
            discount_pct = int((1 - price / original_price) * 100)

        # Rating
        rating_star = item.get("item_rating", {})
        if isinstance(rating_star, dict):
            rating = float(rating_star.get("rating_star", 0) or 0)
        else:
            rating = float(item.get("rating", 0) or item.get("ratingStar", 0) or 0)

        # Sales
        sold = int(
            item.get("historical_sold")
            or item.get("sold")
            or item.get("monthlySold")
            or item.get("sales")
            or 0
        )

        # URLs
        shop_id = item.get("shopid") or ""
        item_id = item.get("itemid") or item.get("id") or ""
        shopee_url = (
            item.get("url")
            or item.get("link")
            or (
                f"https://shopee.co.id/product/{shop_id}/{item_id}"
                if shop_id and item_id
                else ""
            )
        )
        affiliate_url = item.get("affiliate_link") or item.get("affiliateUrl") or shopee_url

        # Image
        image_url = (
            item.get("image")
            or item.get("imageUrl")
            or _build_shopee_image_url(item.get("images", [None])[0] if item.get("images") else None)
        )

        return {
            "name": name,
            "description": description,
            "price": price,
            "original_price": original_price,
            "discount_pct": discount_pct,
            "rating": rating,
            "sold_monthly": sold,
            "shopee_url": shopee_url,
            "affiliate_url": affiliate_url,
            "image_url": image_url,
            "category": "Smart Home",
            "fetched_at": datetime.utcnow().isoformat(),
        }

    # ── Filtering ─────────────────────────────────────────────────────────────

    def _filter_products(self, products: list[dict]) -> list[dict]:
        """Apply quality filters to the normalised product list."""
        return [
            p for p in products
            if validate_product(p, min_rating=MIN_RATING, min_sold=MIN_SOLD)
        ]

    # ── Persistence ───────────────────────────────────────────────────────────

    def _save_products(self, products: list[dict]) -> None:
        """Save products to data/products.json for downstream modules."""
        out_path = DATA_DIR / "products.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        log.info("products_saved", path=str(out_path), count=len(products))


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _parse_shopee_price(raw_price) -> float:
    """Shopee stores prices as integer * 100000. Convert to IDR."""
    if not raw_price:
        return 0.0
    try:
        val = float(raw_price)
        # Shopee API multiplies prices by 100000
        if val > 1_000_000:
            val = val / 100_000
        return round(val, 2)
    except (TypeError, ValueError):
        return 0.0


def _build_shopee_image_url(image_hash: Optional[str]) -> str:
    """Build Shopee CDN image URL from a hash string."""
    if not image_hash:
        return ""
    return f"https://cf.shopee.co.id/file/{image_hash}"


# ─── CLI Entry Point ──────────────────────────────────────────────────────────


async def main():
    researcher = ShopeeResearcher()
    products = await researcher.fetch_products()
    print(f"\n✅ Found {len(products)} qualifying products.\n")
    for i, p in enumerate(products[:3], 1):
        print(f"[{i}] {p['name']}")
        print(f"    Price  : Rp {p['price']:,.0f}")
        print(f"    Rating : {p['rating']} ⭐  | Sold: {p['sold_monthly']}/mo")
        print(f"    URL    : {p['shopee_url'][:80]}\n")


if __name__ == "__main__":
    asyncio.run(main())
