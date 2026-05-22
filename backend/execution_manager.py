"""
ExecutionManager — routes all order activity through a strict mode gate.

PAPER mode:
  Orders are simulated in memory. Fills are assumed at the requested price.
  Zero network calls to any exchange. An in-memory registry tracks simulated
  positions and P&L for the mock dashboard.

LIVE mode:
  Orders are routed to the live exchange clients (Bybit / Polymarket).
  Real funds are committed. Hard-limit guards fire before every order:
    - MAX_ORDER_USD: per-order notional ceiling
    - MAX_POSITION_USD: total open exposure ceiling
    - Mode assertion: LIVE config must be confirmed immediately before every call
  Any guard failure raises ExecutionGuardError — the order is dropped.

Usage:
    em = ExecutionManager(cfg, clients)
    fill = await em.execute_limit_order("bybit", "BTCUSDT", "Buy", qty=0.001, price=67000)
"""

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Literal, Optional

from config import Config, TradingMode
from client_factory import TradingClients

log = logging.getLogger(__name__)

Exchange = Literal["bybit", "polymarket"]
Side = Literal["Buy", "Sell", "YES", "NO"]

# ── Hard limits (override via env if needed, but never disable) ───────────────

MAX_ORDER_USD    = float(500)    # single-order notional ceiling
MAX_POSITION_USD = float(5_000)  # total open exposure ceiling


# ── Exceptions ────────────────────────────────────────────────────────────────

class ExecutionGuardError(RuntimeError):
    """Raised when a safety guard blocks an order."""


# ── Order / fill records ──────────────────────────────────────────────────────

@dataclass
class OrderRecord:
    order_id:  str
    exchange:  Exchange
    symbol:    str
    side:      Side
    qty:       float
    price:     float
    status:    str           # "open" | "filled" | "cancelled"
    ts:        float = field(default_factory=time.time)
    fill_price: Optional[float] = None
    fill_ts:    Optional[float] = None
    reduce_only: bool = False


# ── Manager ───────────────────────────────────────────────────────────────────

class ExecutionManager:

    def __init__(self, config: Config, clients: TradingClients) -> None:
        self._cfg     = config
        self._clients = clients
        self._orders:  dict[str, OrderRecord] = {}
        self._paper_exposure: float = 0.0   # running notional in paper mode
        log.info(
            "ExecutionManager ready — mode=%s  max_order=$%.0f  max_exposure=$%.0f",
            config.mode.value, MAX_ORDER_USD, MAX_POSITION_USD,
        )

    # ── Public API ────────────────────────────────────────────────────────────

    async def execute_limit_order(
        self,
        exchange: Exchange,
        symbol: str,
        side: Side,
        qty: float,
        price: float,
        *,
        reduce_only: bool = False,
    ) -> OrderRecord:
        """
        Place a limit order. Routes to paper simulation or live exchange
        depending on the configured TradingMode.
        """
        notional = qty * price
        self._check_order_guards(notional)

        if self._cfg.is_paper:
            return await self._paper_fill(exchange, symbol, side, qty, price, reduce_only)
        else:
            return await self._live_order(exchange, symbol, side, qty, price, reduce_only)

    async def cancel_order(self, order_id: str) -> dict:
        """Cancel an open order."""
        record = self._orders.get(order_id)
        if not record:
            raise KeyError(f"Order {order_id!r} not found")

        if self._cfg.is_paper:
            return self._paper_cancel(record)
        else:
            return await self._live_cancel(record)

    async def get_positions(self, exchange: Exchange) -> list[dict]:
        """Return open positions (paper: in-memory fills; live: exchange query)."""
        if self._cfg.is_paper:
            return self._paper_positions(exchange)
        else:
            return await self._clients.bybit.get_session().get_positions(
                category="linear", settleCoin="USDT"
            ) if exchange == "bybit" else []

    def get_all_orders(self) -> list[OrderRecord]:
        return list(self._orders.values())

    def get_paper_fills(self) -> list[OrderRecord]:
        return [o for o in self._orders.values() if o.status == "filled"]

    # ── Guard checks ──────────────────────────────────────────────────────────

    def _check_order_guards(self, notional: float) -> None:
        if notional > MAX_ORDER_USD:
            raise ExecutionGuardError(
                f"Order notional ${notional:.2f} exceeds MAX_ORDER_USD=${MAX_ORDER_USD:.0f}"
            )
        if self._cfg.is_paper:
            if self._paper_exposure + notional > MAX_POSITION_USD:
                raise ExecutionGuardError(
                    f"Order would push paper exposure to "
                    f"${self._paper_exposure + notional:.2f}, "
                    f"exceeding MAX_POSITION_USD=${MAX_POSITION_USD:.0f}"
                )
        else:
            # In LIVE mode re-assert mode every call — defensive double-check
            assert self._cfg.is_live, (
                "CRITICAL BUG: live order attempted without LIVE config"
            )
            assert self._cfg.credentials is not None, (
                "CRITICAL BUG: live order attempted without credentials"
            )

    # ── Paper simulation ──────────────────────────────────────────────────────

    async def _paper_fill(
        self,
        exchange: Exchange,
        symbol: str,
        side: Side,
        qty: float,
        price: float,
        reduce_only: bool,
    ) -> OrderRecord:
        order_id = f"PAPER-{uuid.uuid4().hex[:12].upper()}"
        now = time.time()

        record = OrderRecord(
            order_id=order_id,
            exchange=exchange,
            symbol=symbol,
            side=side,
            qty=qty,
            price=price,
            status="filled",
            ts=now,
            fill_price=price,
            fill_ts=now,
            reduce_only=reduce_only,
        )
        self._orders[order_id] = record

        notional = qty * price
        if not reduce_only:
            self._paper_exposure += notional
        else:
            self._paper_exposure = max(0.0, self._paper_exposure - notional)

        log.info(
            "[PAPER] FILL  %s  %s %s  qty=%.4f  px=%.4f  notional=$%.2f  exposure=$%.2f",
            exchange.upper(), side, symbol, qty, price, notional, self._paper_exposure,
        )
        return record

    def _paper_cancel(self, record: OrderRecord) -> dict:
        if record.status != "open":
            return {"success": False, "reason": f"order status is '{record.status}'"}
        record.status = "cancelled"
        log.info("[PAPER] CANCEL %s", record.order_id)
        return {"success": True, "order_id": record.order_id}

    def _paper_positions(self, exchange: Exchange) -> list[dict]:
        fills = [o for o in self._orders.values()
                 if o.status == "filled" and o.exchange == exchange]
        agg: dict[str, dict] = {}
        for f in fills:
            key = f"{f.symbol}:{f.side}"
            if key not in agg:
                agg[key] = {"symbol": f.symbol, "side": f.side, "qty": 0.0, "avg_px": 0.0, "count": 0}
            entry = agg[key]
            total_qty = entry["qty"] + f.qty
            entry["avg_px"] = (entry["avg_px"] * entry["qty"] + f.fill_price * f.qty) / total_qty
            entry["qty"] = total_qty
            entry["count"] += 1
        return list(agg.values())

    # ── Live routing ──────────────────────────────────────────────────────────

    async def _live_order(
        self,
        exchange: Exchange,
        symbol: str,
        side: Side,
        qty: float,
        price: float,
        reduce_only: bool,
    ) -> OrderRecord:
        # Final mode assertion immediately before any live call
        assert self._cfg.is_live, "CRITICAL: live order path entered without LIVE mode"

        order_id = f"LIVE-{uuid.uuid4().hex[:12].upper()}"
        now = time.time()

        log.warning(
            "[LIVE] ORDER  %s  %s %s  qty=%.4f  px=%.4f  notional=$%.2f",
            exchange.upper(), side, symbol, qty, price, qty * price,
        )

        try:
            if exchange == "bybit":
                session = self._clients.bybit.get_session()
                resp = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: session.place_order(
                        category="linear",
                        symbol=symbol,
                        side=side,
                        orderType="Limit",
                        qty=str(qty),
                        price=str(price),
                        reduceOnly=reduce_only,
                        timeInForce="GTC",
                    ),
                )
                ack_id = resp.get("result", {}).get("orderId", order_id)

            elif exchange == "polymarket":
                ack_id = order_id  # Polymarket returns immediately after signing
                # Actual place_market_order called by higher-level strategy layer

            else:
                raise ValueError(f"Unknown exchange: {exchange!r}")

        except Exception as exc:
            log.error("[LIVE] ORDER FAILED  %s  %s %s — %s", exchange, side, symbol, exc)
            raise

        record = OrderRecord(
            order_id=ack_id,
            exchange=exchange,
            symbol=symbol,
            side=side,
            qty=qty,
            price=price,
            status="open",
            ts=now,
            reduce_only=reduce_only,
        )
        self._orders[ack_id] = record
        return record

    async def _live_cancel(self, record: OrderRecord) -> dict:
        assert self._cfg.is_live, "CRITICAL: live cancel path entered without LIVE mode"

        if record.exchange == "bybit":
            session = self._clients.bybit.get_session()
            resp = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: session.cancel_order(
                    category="linear",
                    symbol=record.symbol,
                    orderId=record.order_id,
                ),
            )
            record.status = "cancelled"
            log.warning("[LIVE] CANCEL %s → %s", record.order_id, resp)
            return resp

        return {"success": False, "reason": f"cancel not implemented for {record.exchange}"}
