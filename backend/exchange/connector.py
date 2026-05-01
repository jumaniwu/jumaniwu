"""ccxt async wrapper — supports any exchange by config."""
from __future__ import annotations

import logging

import ccxt.async_support as ccxt

logger = logging.getLogger(__name__)


class ExchangeConnector:
    def __init__(self, exchange_id: str, api_key: str, api_secret: str, sandbox: bool = True):
        self._exchange_id = exchange_id
        self._api_key = api_key
        self._api_secret = api_secret
        self._sandbox = sandbox
        self._exchange: ccxt.Exchange | None = None

    async def init(self) -> None:
        cls = getattr(ccxt, self._exchange_id, None)
        if cls is None:
            raise ValueError(f"Unknown exchange: {self._exchange_id}")
        self._exchange = cls({
            "apiKey": self._api_key,
            "secret": self._api_secret,
            "enableRateLimit": True,
            "options": {"defaultType": "spot"},
        })
        if self._sandbox:
            self._exchange.set_sandbox_mode(True)
        try:
            await self._exchange.load_markets()
            logger.info("Exchange %s initialized (sandbox=%s)", self._exchange_id, self._sandbox)
        except Exception as e:
            logger.warning("Could not load markets: %s — exchange may be unavailable", e)

    @property
    def exchange(self) -> ccxt.Exchange:
        if self._exchange is None:
            raise RuntimeError("ExchangeConnector not initialized — call await init() first")
        return self._exchange

    async def fetch_ohlcv(self, pair: str, timeframe: str = "1h", limit: int = 200) -> list[list]:
        """Returns [[timestamp_ms, open, high, low, close, volume], ...]"""
        data = await self.exchange.fetch_ohlcv(pair, timeframe, limit=limit)
        return data

    async def fetch_ticker(self, pair: str) -> dict:
        return await self.exchange.fetch_ticker(pair)

    async def get_current_price(self, pair: str) -> float:
        ticker = await self.fetch_ticker(pair)
        return float(ticker["last"])

    async def fetch_balance(self) -> dict:
        return await self.exchange.fetch_balance()

    async def create_market_order(self, pair: str, side: str, quantity: float) -> dict:
        return await self.exchange.create_market_order(pair, side, quantity)

    async def create_limit_order(self, pair: str, side: str, quantity: float, price: float) -> dict:
        return await self.exchange.create_limit_order(pair, side, quantity, price)

    async def cancel_order(self, order_id: str, pair: str) -> dict:
        return await self.exchange.cancel_order(order_id, pair)

    async def fetch_order(self, order_id: str, pair: str) -> dict:
        return await self.exchange.fetch_order(order_id, pair)

    async def close(self) -> None:
        if self._exchange:
            await self._exchange.close()
            logger.info("Exchange connection closed")
