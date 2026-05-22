"""
Bybit clients — Paper (public WebSocket) and Live (pybit, LIVE mode only).

PAPER: subscribes ONLY to the public orderbook WebSocket. No API key.
LIVE:  imports pybit at runtime (not at module import time) and initialises
       a private session using the encrypted credentials from Config.
"""

import asyncio
import json
import logging
from typing import AsyncIterator, Optional

import httpx

from clients.base import BaseBybitClient

log = logging.getLogger(__name__)

# Public REST + WebSocket endpoints
_BYBIT_PUBLIC_WS      = "wss://stream.bybit.com/v5/public/linear"
_BYBIT_TESTNET_WS     = "wss://stream-testnet.bybit.com/v5/public/linear"
_BYBIT_PUBLIC_REST    = "https://api.bybit.com"
_BYBIT_TESTNET_REST   = "https://api-testnet.bybit.com"


# ── Paper client — public read-only ──────────────────────────────────────────

class PaperBybitClient(BaseBybitClient):
    """
    Connects to Bybit's PUBLIC WebSocket BBO stream.
    No API key is required. No write access is possible.
    """

    def __init__(self, symbols: list[str] | None = None, testnet: bool = False):
        self._symbols  = symbols or ["BTCUSDT", "ETHUSDT"]
        self._ws_url   = _BYBIT_TESTNET_WS if testnet else _BYBIT_PUBLIC_WS
        self._ws       = None
        self._connected = False

    async def connect(self) -> None:
        # Lazy import — websockets only needed when a connection is requested
        try:
            import websockets
        except ImportError as exc:
            raise RuntimeError("'websockets' package required: pip install websockets") from exc

        self._ws = await websockets.connect(self._ws_url)
        subscribe_msg = {
            "op": "subscribe",
            "args": [f"orderbook.1.{sym}" for sym in self._symbols],
        }
        await self._ws.send(json.dumps(subscribe_msg))
        self._connected = True
        log.info("PaperBybitClient connected to public WS (%s)", self._ws_url)

    async def disconnect(self) -> None:
        if self._ws:
            await self._ws.close()
            self._connected = False
            log.info("PaperBybitClient disconnected")

    async def stream_ticks(self) -> AsyncIterator[dict]:
        if not self._connected or not self._ws:
            raise RuntimeError("Call connect() before streaming ticks")
        async for raw in self._ws:
            try:
                yield json.loads(raw)
            except json.JSONDecodeError:
                continue

    async def get_ticker(self, symbol: str = "BTCUSDT", testnet: bool = False) -> dict:
        """One-shot REST fetch of latest ticker (public endpoint)."""
        base = _BYBIT_TESTNET_REST if testnet else _BYBIT_PUBLIC_REST
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{base}/v5/market/tickers", params={"category": "linear", "symbol": symbol})
            resp.raise_for_status()
            return resp.json()


# ── Live client — private session (LIVE mode ONLY) ───────────────────────────

class LiveBybitClient(BaseBybitClient):
    """
    Authenticated Bybit client using pybit.
    This class MUST NOT be instantiated when TRADING_MODE=PAPER.
    The ClientFactory enforces this with an assertion guard.
    """

    def __init__(self, api_key: str, api_secret: str, testnet: bool = False):
        # Conditional import — pybit is optional and only installed in LIVE envs
        try:
            from pybit.unified_trading import HTTP, WebSocket as PybitWS
        except ImportError as exc:
            raise RuntimeError(
                "pybit package is required for LIVE mode: pip install pybit"
            ) from exc

        self._session = HTTP(
            testnet=testnet,
            api_key=api_key,
            api_secret=api_secret,
        )
        self._PybitWS = PybitWS
        self._testnet = testnet
        self._ws: Optional[object] = None
        log.warning("LiveBybitClient initialised — LIVE trading enabled on Bybit")

    async def connect(self) -> None:
        # pybit WebSocket is callback-based; wrap in asyncio
        loop = asyncio.get_event_loop()
        self._ws = self._PybitWS(
            channel_type="private",
            testnet=self._testnet,
            api_key=self._session.api_key,
            api_secret=self._session.api_secret,
        )
        log.info("LiveBybitClient WS connected (private channel)")

    async def disconnect(self) -> None:
        if self._ws:
            self._ws.exit()
        log.info("LiveBybitClient WS disconnected")

    async def stream_ticks(self) -> AsyncIterator[dict]:
        # Private WS uses callbacks; callers should register callbacks directly
        # This stub satisfies the interface for type-checker compliance
        return
        yield  # make this a generator

    def get_session(self):
        """Return the underlying pybit HTTP session for direct REST calls."""
        return self._session
