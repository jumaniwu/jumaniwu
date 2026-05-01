"""Market data fetcher with DB-backed OHLCV cache."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from data.database import Database
    from exchange.connector import ExchangeConnector

logger = logging.getLogger(__name__)

# In-memory TTL cache: (pair, timeframe) -> (data, fetched_epoch)
_mem_cache: dict[tuple, tuple[list, float]] = {}


class MarketDataFetcher:
    def __init__(self, connector: "ExchangeConnector", db: "Database", cache_ttl: int = 60):
        self._connector = connector
        self._db = db
        self._cache_ttl = cache_ttl

    async def get_ohlcv(
        self,
        pair: str,
        timeframe: str = "1h",
        limit: int = 200,
        use_cache: bool = True,
    ) -> list[list]:
        key = (pair, timeframe)
        now = time.monotonic()

        if use_cache and key in _mem_cache:
            data, ts = _mem_cache[key]
            if now - ts < self._cache_ttl:
                return data

        if use_cache:
            cached = await self._db.get_ohlcv_cache(pair, timeframe, limit)
            if cached:
                _mem_cache[key] = (cached, now)
                return cached

        try:
            data = await self._connector.fetch_ohlcv(pair, timeframe, limit)
            if data:
                _mem_cache[key] = (data, now)
                await self._db.save_ohlcv_cache(pair, timeframe, data)
                return data
        except Exception as e:
            logger.error("Failed to fetch OHLCV for %s: %s", pair, e)

        # Fallback to whatever is in cache even if stale
        fallback = await self._db.get_ohlcv_cache(pair, timeframe, limit)
        if fallback:
            logger.warning("Using stale cache for %s", pair)
            return fallback

        return []

    async def get_current_price(self, pair: str) -> float | None:
        try:
            return await self._connector.get_current_price(pair)
        except Exception as e:
            logger.error("Failed to fetch ticker for %s: %s", pair, e)
            return None

    async def get_multi_pair_ohlcv(
        self,
        pairs: list[str],
        timeframe: str = "1h",
        limit: int = 200,
    ) -> dict[str, list[list]]:
        tasks = [self.get_ohlcv(pair, timeframe, limit) for pair in pairs]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        out = {}
        for pair, result in zip(pairs, results):
            if isinstance(result, Exception):
                logger.error("OHLCV error for %s: %s", pair, result)
                out[pair] = []
            else:
                out[pair] = result
        return out

    async def get_multi_pair_prices(self, pairs: list[str]) -> dict[str, float]:
        tasks = [self.get_current_price(pair) for pair in pairs]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return {
            pair: price
            for pair, price in zip(pairs, results)
            if price is not None and not isinstance(price, Exception)
        }
