"""
Polymarket clients — Paper (public CLOB HTTP) and Live (py_clob_client + Web3).

PAPER: uses only the public Polymarket CLOB REST API. No private key is touched.
LIVE:  loads py_clob_client and eth_account at runtime, derives the CLOB API
       credentials from the EVM private key, and enables signed order placement.
"""

import logging
from typing import Optional

import httpx

from clients.base import BasePolymarketClient

log = logging.getLogger(__name__)

_CLOB_BASE = "https://clob.polymarket.com"
_GAMMA_BASE = "https://gamma-api.polymarket.com"


# ── Paper client — public REST only ──────────────────────────────────────────

class PaperPolymarketClient(BasePolymarketClient):
    """
    Read-only Polymarket client using the public CLOB REST API.
    No wallet, no private key, no signed requests.
    """

    def __init__(self, http_timeout: float = 10.0):
        self._timeout = http_timeout

    async def get_markets(self, limit: int = 50, active_only: bool = True) -> list[dict]:
        """Fetch active markets from the public Gamma API."""
        params: dict = {"limit": limit}
        if active_only:
            params["active"] = "true"
            params["closed"] = "false"

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{_GAMMA_BASE}/markets", params=params)
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else data.get("markets", [])

    async def get_orderbook(self, token_id: str) -> dict:
        """Fetch public orderbook (best bid/ask) for a given token ID."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{_CLOB_BASE}/book", params={"token_id": token_id})
            resp.raise_for_status()
            return resp.json()

    async def get_price(self, token_id: str, side: str = "buy") -> Optional[float]:
        """Return the best price for a given side ('buy' or 'sell')."""
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{_CLOB_BASE}/price",
                    params={"token_id": token_id, "side": side},
                )
                resp.raise_for_status()
                return float(resp.json().get("price", 0))
        except Exception as exc:
            log.warning("get_price(%s, %s) failed: %s", token_id, side, exc)
            return None


# ── Live client — authenticated (LIVE mode ONLY) ──────────────────────────────

class LivePolymarketClient(BasePolymarketClient):
    """
    Authenticated Polymarket CLOB client using py_clob_client + eth_account.
    This class MUST NOT be instantiated when TRADING_MODE=PAPER.
    The ClientFactory enforces this with an assertion guard.
    """

    def __init__(
        self,
        private_key: str,        # 0x-prefixed EVM private key
        chain_id: int = 137,     # 137 = Polygon mainnet
        api_key: str = "",
        api_secret: str = "",
        api_passphrase: str = "",
    ):
        # Conditional imports — these packages are optional and LIVE-only
        try:
            from py_clob_client.client import ClobClient
            from eth_account import Account
        except ImportError as exc:
            raise RuntimeError(
                "py_clob_client and eth_account are required for LIVE mode: "
                "pip install py-clob-client eth-account"
            ) from exc

        account = Account.from_key(private_key)
        self._address = account.address

        # Build CLOB client — uses L1 auth if no API creds, L2 if provided
        if api_key and api_secret and api_passphrase:
            from py_clob_client.clob_types import ApiCreds
            creds = ApiCreds(
                api_key=api_key,
                api_secret=api_secret,
                api_passphrase=api_passphrase,
            )
            self._clob = ClobClient(
                host=_CLOB_BASE,
                chain_id=chain_id,
                key=private_key,
                creds=creds,
            )
            log.info("LivePolymarketClient: L2 auth (API creds provided)")
        else:
            self._clob = ClobClient(
                host=_CLOB_BASE,
                chain_id=chain_id,
                key=private_key,
            )
            log.info("LivePolymarketClient: L1 auth (signing with EVM key)")

        log.warning(
            "LivePolymarketClient initialised — wallet address: %s", self._address
        )

    async def get_markets(self, limit: int = 50, active_only: bool = True) -> list[dict]:
        """Fetch markets via authenticated CLOB client."""
        # py_clob_client is sync — run in thread pool to avoid blocking the loop
        import asyncio
        loop = asyncio.get_event_loop()
        markets = await loop.run_in_executor(None, self._clob.get_markets)
        return markets if isinstance(markets, list) else []

    async def get_orderbook(self, token_id: str) -> dict:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, lambda: self._clob.get_order_book(token_id)
        )

    async def place_market_order(
        self,
        token_id: str,
        side: str,
        amount_usdc: float,
    ) -> dict:
        """Place a signed market order on Polymarket (LIVE only)."""
        from py_clob_client.clob_types import MarketOrderArgs, BUY, SELL
        import asyncio

        order_side = BUY if side.upper() == "BUY" else SELL
        args = MarketOrderArgs(token_id=token_id, amount=amount_usdc)
        signed = self._clob.create_market_order(args)

        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(
            None, lambda: self._clob.post_order(signed, order_side)
        )
        return resp

    @property
    def wallet_address(self) -> str:
        return self._address
