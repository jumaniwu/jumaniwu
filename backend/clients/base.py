"""
Abstract base classes for exchange clients.
All concrete Paper/Live implementations must satisfy these interfaces.
"""

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Optional


class BaseBybitClient(ABC):
    """Market data interface for Bybit."""

    @abstractmethod
    async def connect(self) -> None:
        """Open connection / subscribe to feeds."""

    @abstractmethod
    async def disconnect(self) -> None:
        """Tear down connection cleanly."""

    @abstractmethod
    def stream_ticks(self) -> AsyncIterator[dict]:
        """Yield raw BBO/trade ticks as dicts."""


class BasePolymarketClient(ABC):
    """Market data interface for Polymarket CLOB."""

    @abstractmethod
    async def get_markets(self) -> list[dict]:
        """Return list of active market objects."""

    @abstractmethod
    async def get_orderbook(self, token_id: str) -> dict:
        """Return best bid/ask for a given token."""


class BaseOrderExecutor(ABC):
    """Order execution interface — Paper mode stubs, Live mode sends real orders."""

    @abstractmethod
    async def place_limit_order(
        self,
        exchange: str,
        symbol: str,
        side: str,
        qty: float,
        price: float,
        *,
        reduce_only: bool = False,
    ) -> dict:
        """Place a limit order. Returns order-ack dict."""

    @abstractmethod
    async def cancel_order(self, exchange: str, order_id: str) -> dict:
        """Cancel an open order by ID."""

    @abstractmethod
    async def get_positions(self, exchange: str) -> list[dict]:
        """Return open positions."""
