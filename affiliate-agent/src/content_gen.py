"""
content_gen.py — AI Content Generation Engine

Uses Gemini 1.5 Flash (primary) and Groq/Llama3 (fallback) to generate
viral TikTok scripts in Indonesian "Bahasa Gaul" using the PAS framework.

Also generates UGC-style product images via Pollinations.ai (free, no auth).

Script Framework: P-A-S (Problem → Agitate → Solution)
Target Audience: Indonesian TikTok users aged 18–35
Content Style: "Racun Shopee" — casual, conversational, FOMO-driven
"""

import asyncio
import json
import os
import re
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional

import google.generativeai as genai
import httpx
from dotenv import load_dotenv
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential

from .utils.helpers import ensure_dir, safe_filename, strip_metadata
from .utils.logger import get_logger

load_dotenv()
log = get_logger("content_gen")

# ─── Configuration ────────────────────────────────────────────────────────────

DATA_DIR = Path(os.getenv("DATA_DIR", "data"))
IMAGES_DIR = DATA_DIR / "images"

GEMINI_MODEL = "gemini-1.5-flash"
GROQ_MODEL = "llama3-8b-8192"

# Pollinations.ai — free, no API key required
POLLINATIONS_BASE = "https://image.pollinations.ai/prompt"
IMAGE_WIDTH = 1080
IMAGE_HEIGHT = 1920  # TikTok 9:16 ratio

# ─── Prompt Templates ─────────────────────────────────────────────────────────

_SCRIPT_SYSTEM_PROMPT = """Kamu adalah content creator TikTok Indonesia terpopuler yang spesialis di niche
Home & Living / Smart Home. Gaya bahasamu santai, gaul, dan bikin orang langsung pengen beli.
Kamu paham psikologi marketing dan selalu pakai framework PAS (Problem-Agitate-Solution).
Selalu output dalam format JSON yang valid."""

_SCRIPT_USER_TEMPLATE = """Buatkan script video TikTok viral untuk produk berikut:

PRODUK: {name}
DESKRIPSI: {description}
HARGA: Rp {price:,.0f} (diskon {discount_pct}% dari Rp {original_price:,.0f})
RATING: {rating} ⭐ | TERJUAL: {sold_monthly}/bulan

Gunakan framework PAS dengan bahasa gaul/santai khas TikTok Indonesia:
- Hook kuat (2-3 detik pertama, bikin orang stop scroll)
- Problem: masalah yang relate sama penonton
- Agitate: perparah masalahnya, bikin feel terasa
- Solution: produk ini sebagai jawaban
- CTA: dorong cekout SEKARANG (FOMO, limited, dll)

Gunakan ekspresi seperti: "racun shopee", "cekout sekarang", "link di bio",
"demi apaan", "ini gila sih", "worth banget", "auto order", dll.

Durasi video: 45-60 detik saat dibacakan.

Output HANYA dalam JSON ini (no markdown):
{{
  "hook": "...",
  "problem": "...",
  "agitate": "...",
  "solution": "...",
  "cta": "...",
  "full_script": "...",
  "caption": "...",
  "hashtags": ["#racunshopee", "..."],
  "estimated_duration_sec": 0
}}"""

_IMAGE_PROMPT_TEMPLATE = """iPhone 14 Pro candid photo, {product_description},
on a clean modern Indonesian home counter, natural morning sunlight streaming in,
slightly warm tones, bokeh background, real home environment not studio,
authentic UGC lifestyle content, no watermarks, photorealistic,
shot by a real person not professional photographer, 4K detail"""


# ─── Main Class ───────────────────────────────────────────────────────────────


class ContentEngine:
    """Generate TikTok scripts and product visuals for Shopee affiliate content."""

    def __init__(
        self,
        gemini_key: Optional[str] = None,
        groq_key: Optional[str] = None,
    ):
        self.gemini_key = gemini_key or os.getenv("GEMINI_API_KEY", "")
        self.groq_key = groq_key or os.getenv("GROQ_API_KEY", "")

        # Initialise Gemini
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
            self._gemini_model = genai.GenerativeModel(
                model_name=GEMINI_MODEL,
                generation_config=genai.GenerationConfig(
                    temperature=0.85,
                    top_p=0.95,
                    max_output_tokens=1024,
                ),
                system_instruction=_SCRIPT_SYSTEM_PROMPT,
            )
        else:
            self._gemini_model = None
            log.warning("gemini_key_missing", note="Will use Groq fallback only")

        # Initialise Groq
        self._groq_client = Groq(api_key=self.groq_key) if self.groq_key else None

        ensure_dir(str(IMAGES_DIR))

    # ── Public API ────────────────────────────────────────────────────────────

    async def generate_for_product(self, product: dict) -> dict:
        """Full pipeline: generate script + image for one product.

        Args:
            product: Normalised product dict from researcher.py.

        Returns:
            Content package dict with script, image_path, and product info.
        """
        log.info("content_gen_start", product=product.get("name", "?")[:50])

        script = await self.generate_script(product)
        image_prompt = self.build_image_prompt(product, script)
        image_path = await self.generate_image(image_prompt, product.get("name", "product"))

        package = {
            "product": product,
            "script": script,
            "image_path": image_path,
            "image_prompt": image_prompt,
            "generated_at": datetime.utcnow().isoformat(),
        }

        log.info("content_gen_done", product=product.get("name", "?")[:50], image=image_path)
        return package

    async def generate_all(self, products: list[dict]) -> list[dict]:
        """Generate content for a list of products (sequential to respect rate limits).

        Args:
            products: List of product dicts from researcher.py.

        Returns:
            List of content packages.
        """
        packages = []
        for product in products:
            try:
                pkg = await self.generate_for_product(product)
                packages.append(pkg)
                # Brief pause between Gemini calls to respect free tier rate limits
                await asyncio.sleep(5)
            except Exception as exc:
                log.error("content_gen_failed", product=product.get("name"), error=str(exc))
        self._save_packages(packages)
        return packages

    # ── Script Generation ─────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=4, max=30))
    async def generate_script(self, product: dict) -> dict:
        """Generate a PAS-framework TikTok script for a product.

        Tries Gemini 1.5 Flash first, falls back to Groq Llama3.

        Args:
            product: Normalised product dict.

        Returns:
            Parsed script dict with hook, problem, agitate, solution, cta, etc.
        """
        prompt = self._build_pas_prompt(product)

        raw_text = None
        if self._gemini_model:
            try:
                raw_text = await self._call_gemini(prompt)
            except Exception as exc:
                log.warning("gemini_failed", error=str(exc), fallback="groq")

        if raw_text is None and self._groq_client:
            raw_text = await self._call_groq(prompt)

        if raw_text is None:
            raise RuntimeError("Both Gemini and Groq failed — check API keys.")

        return self._parse_script_json(raw_text, product)

    # ── Image Prompt & Generation ─────────────────────────────────────────────

    def build_image_prompt(self, product: dict, script: dict) -> str:
        """Build a UGC-style Pollinations.ai prompt for the product.

        Args:
            product: Normalised product dict.
            script: Generated script dict (for context).

        Returns:
            URL-safe image generation prompt string.
        """
        product_desc = product.get("name", "smart home gadget")
        # Keep it concise for Pollinations
        short_desc = product_desc[:60]
        return _IMAGE_PROMPT_TEMPLATE.format(product_description=short_desc)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=30))
    async def generate_image(self, prompt: str, product_name: str) -> str:
        """Download a generated image from Pollinations.ai.

        Pollinations.ai is completely free with no API key required.
        Generates realistic UGC-style product images.

        Args:
            prompt: English image generation prompt.
            product_name: Used to name the saved file.

        Returns:
            Absolute path to the saved (and EXIF-stripped) image file.
        """
        encoded_prompt = urllib.parse.quote(prompt, safe="")
        url = (
            f"{POLLINATIONS_BASE}/{encoded_prompt}"
            f"?width={IMAGE_WIDTH}&height={IMAGE_HEIGHT}"
            f"&nologo=true&enhance=true&model=flux"
        )

        filename = f"{safe_filename(product_name)}_{int(datetime.utcnow().timestamp())}.jpg"
        save_path = str(IMAGES_DIR / filename)

        log.info("image_gen_start", product=product_name[:40])

        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            with open(save_path, "wb") as f:
                f.write(resp.content)

        # Strip AI generation metadata immediately
        strip_metadata(save_path)
        log.info("image_gen_done", path=save_path, size_kb=len(resp.content) // 1024)
        return save_path

    # ── LLM Backends ─────────────────────────────────────────────────────────

    async def _call_gemini(self, prompt: str) -> str:
        """Call Gemini 1.5 Flash and return the text response.

        Runs in an executor since the Google AI client is synchronous.
        """
        loop = asyncio.get_event_loop()

        def _sync_call():
            response = self._gemini_model.generate_content(prompt)
            return response.text

        return await loop.run_in_executor(None, _sync_call)

    async def _call_groq(self, prompt: str) -> str:
        """Call Groq Llama3 as a fallback LLM.

        Runs in an executor since the Groq client is synchronous.
        """
        loop = asyncio.get_event_loop()

        def _sync_call():
            response = self._groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": _SCRIPT_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.85,
                max_tokens=1024,
            )
            return response.choices[0].message.content

        return await loop.run_in_executor(None, _sync_call)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _build_pas_prompt(self, product: dict) -> str:
        """Render the PAS script generation prompt with product data."""
        return _SCRIPT_USER_TEMPLATE.format(
            name=product.get("name", "Produk Smart Home"),
            description=product.get("description", "")[:300],
            price=product.get("price", 0),
            original_price=product.get("original_price", 0),
            discount_pct=product.get("discount_pct", 0),
            rating=product.get("rating", 0),
            sold_monthly=product.get("sold_monthly", 0),
        )

    def _parse_script_json(self, raw_text: str, product: dict) -> dict:
        """Extract and parse the JSON script from LLM output.

        Handles cases where the LLM wraps the JSON in markdown code fences.

        Args:
            raw_text: Raw LLM response string.
            product: Product dict (used for fallback values).

        Returns:
            Validated script dict.
        """
        # Strip markdown code fences if present
        text = re.sub(r"```(?:json)?\s*", "", raw_text).strip()
        text = re.sub(r"```\s*$", "", text).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Try to extract JSON object with regex
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group())
                except json.JSONDecodeError:
                    data = {}
            else:
                data = {}

        # Ensure required keys with sensible fallbacks
        product_name = product.get("name", "produk ini")
        defaults = {
            "hook": f"Woy! Ini dia produk yang lagi viral banget! 🔥",
            "problem": f"Pernah ngerasa capek dan buang-buang waktu karena {product_name}?",
            "agitate": "Bayangin kalau masalah ini terus dibiarkan... makin parah deh!",
            "solution": f"Tenang! {product_name} hadir buat solve masalah kamu! ✅",
            "cta": f"Cekout sekarang sebelum kehabisan! Link di bio ya! 🛒",
            "full_script": raw_text[:500],
            "caption": f"Racun shopee alert! 🚨 {product_name} bikin hidup lebih gampang. Link di bio!",
            "hashtags": ["#racunshopee", "#smarthomeliving", "#rekomendasiproduk", "#fyp"],
            "estimated_duration_sec": 50,
        }

        for key, val in defaults.items():
            if key not in data or not data[key]:
                data[key] = val

        # Ensure hashtags is a list
        if isinstance(data.get("hashtags"), str):
            data["hashtags"] = [h.strip() for h in data["hashtags"].split() if h.startswith("#")]

        return data

    def _save_packages(self, packages: list[dict]) -> None:
        """Save generated content packages to data/scripts.json."""
        # Don't serialize the full image bytes — just paths
        out = []
        for pkg in packages:
            out.append({
                "product_name": pkg["product"].get("name"),
                "product_url": pkg["product"].get("affiliate_url"),
                "script": pkg["script"],
                "image_path": pkg.get("image_path"),
                "generated_at": pkg.get("generated_at"),
            })

        out_path = DATA_DIR / "scripts.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        log.info("scripts_saved", path=str(out_path), count=len(out))


# ─── CLI Entry Point ──────────────────────────────────────────────────────────


async def main():
    # Load products from previous researcher.py run
    products_path = DATA_DIR / "products.json"
    if not products_path.exists():
        print("❌ data/products.json not found. Run researcher.py first.")
        return

    with open(products_path, encoding="utf-8") as f:
        products = json.load(f)

    print(f"📦 Generating content for {len(products)} products...")
    engine = ContentEngine()
    packages = await engine.generate_all(products[:2])  # Limit to 2 for testing

    for pkg in packages:
        script = pkg["script"]
        print(f"\n🎬 {pkg['product']['name'][:50]}")
        print(f"   Hook    : {script.get('hook', '')[:80]}")
        print(f"   CTA     : {script.get('cta', '')[:80]}")
        print(f"   Image   : {pkg.get('image_path')}")


if __name__ == "__main__":
    asyncio.run(main())
