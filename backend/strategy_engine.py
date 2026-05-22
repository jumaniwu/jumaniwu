"""
StrategyEngine — consumes hedge-scanner and state-machine ticks, emits
trade signals, routes them through RiskManager, and fires ExecutionManager.

Signal logic (mid-price mispricing):
  - ARBIT signal:  Bybit mid < Poly implied → BUY Bybit, hedge on Poly
  - REVERSE_ARBIT: Bybit mid > Poly implied → SELL Bybit, hedge on Poly
  - NEUTRAL:       spread inside threshold → no action

The engine enforces the mode gate itself: in PAPER mode it calls
ExecutionManager.execute_limit_order(), which does an in-memory fill.
In LIVE mode the same call routes to the real exchange.
The StrategyEngine is completely unaware of which path is taken.
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Literal, Optional

from risk_manager import RiskManager, RiskVetoError
from execution_manager import ExecutionManager, OrderRecord

log = logging.getLogger(__name__)

# ── Signal threshold ──────────────────────────────────────────────────────────

MIN_SPREAD_PCT  = 0.30   # minimum spread % to trigger a signal
ORDER_QTY_BTC   = 0.001  # BTC lot size per signal
ORDER_QTY_ETH   = 0.01   # ETH lot size per signal
HEDGE_NOTIONAL  = 5.0    # USDC notional per Polymarket hedge leg

Signal = Literal["ARBIT", "REVERSE_ARBIT", "NEUTRAL"]


@dataclass
class TradeSignal:
    signal:       Signal
    spread_pct:   float
    bybit_price:  float
    poly_price:   float
    ts:           float


@dataclass
class StrategyResult:
    signal:    TradeSignal
    vetoed:    bool
    veto_reason: Optional[str]
    bybit_fill: Optional[OrderRecord]
    poly_fill:  Optional[OrderRecord]
    elapsed_ms: float


# ── Engine ────────────────────────────────────────────────────────────────────

class StrategyEngine:

    def __init__(
        self,
        executor: ExecutionManager,
        risk:     RiskManager,
        symbol:   str = "BTCUSDT",
    ) -> None:
        self._executor = executor
        self._risk     = risk
        self._symbol   = symbol
        self._btc_mode = symbol == "BTCUSDT"
        self._qty      = ORDER_QTY_BTC if self._btc_mode else ORDER_QTY_ETH
        log.info("StrategyEngine ready — symbol=%s  qty=%.4f", symbol, self._qty)

    # ── Public API ────────────────────────────────────────────────────────────

    async def on_tick(
        self,
        hedge: dict,
        wallet_drawdown: float = 0.0,
        unrealised_pnl: float  = 0.0,
    ) -> Optional[StrategyResult]:
        """
        Called every time a hedge-scanner tick arrives.
        Returns a StrategyResult if a signal was evaluated, None if NEUTRAL.
        """
        signal_str: Signal = hedge.get("signal", "NEUTRAL")
        spread_pct = hedge.get("spread_pct", 0.0)

        if signal_str == "NEUTRAL" or abs(spread_pct) < MIN_SPREAD_PCT:
            return None

        bybit_price = hedge.get("bybit_mid", 0.0)
        poly_price  = hedge.get("poly_implied", 0.0)

        signal = TradeSignal(
            signal=signal_str,
            spread_pct=spread_pct,
            bybit_price=bybit_price,
            poly_price=poly_price,
            ts=time.time(),
        )

        return await self._execute_signal(signal, wallet_drawdown, unrealised_pnl)

    # ── Execution ─────────────────────────────────────────────────────────────

    async def _execute_signal(
        self,
        signal: TradeSignal,
        wallet_drawdown: float,
        unrealised_pnl: float,
    ) -> StrategyResult:
        t0 = time.perf_counter()

        # ── Risk pre-check ────────────────────────────────────────────────────
        bybit_notional = self._qty * signal.bybit_price
        try:
            self._risk.check(
                self._symbol,
                self._qty,
                signal.bybit_price,
                current_drawdown_pct=wallet_drawdown,
                current_unrealised_pnl=unrealised_pnl,
            )
        except RiskVetoError as exc:
            log.debug("Signal vetoed: %s", exc)
            return StrategyResult(
                signal=signal,
                vetoed=True,
                veto_reason=str(exc),
                bybit_fill=None,
                poly_fill=None,
                elapsed_ms=(time.perf_counter() - t0) * 1000,
            )

        # ── Determine direction ───────────────────────────────────────────────
        if signal.signal == "ARBIT":
            bybit_side = "Buy"
            poly_side  = "YES"  # buy YES = long poly
        else:
            bybit_side = "Sell"
            poly_side  = "NO"

        # ── Fire both legs concurrently ───────────────────────────────────────
        bybit_fill: Optional[OrderRecord] = None
        poly_fill:  Optional[OrderRecord] = None

        try:
            bybit_fill, poly_fill = await asyncio.gather(
                self._executor.execute_limit_order(
                    "bybit",
                    self._symbol,
                    bybit_side,
                    qty=self._qty,
                    price=signal.bybit_price,
                ),
                self._executor.execute_limit_order(
                    "polymarket",
                    "BTCUSDT",
                    poly_side,
                    qty=HEDGE_NOTIONAL / max(signal.poly_price, 0.001),
                    price=signal.poly_price,
                ),
            )
            self._risk.on_order_placed(self._symbol, bybit_notional)
            log.info(
                "SIGNAL %s  spread=%.2f%%  bybit=%s@%.2f  poly=%s@%.4f",
                signal.signal, signal.spread_pct,
                bybit_side, signal.bybit_price,
                poly_side, signal.poly_price,
            )
        except Exception as exc:
            log.error("Execution error: %s", exc)
            return StrategyResult(
                signal=signal,
                vetoed=True,
                veto_reason=f"Execution error: {exc}",
                bybit_fill=None,
                poly_fill=None,
                elapsed_ms=(time.perf_counter() - t0) * 1000,
            )

        return StrategyResult(
            signal=signal,
            vetoed=False,
            veto_reason=None,
            bybit_fill=bybit_fill,
            poly_fill=poly_fill,
            elapsed_ms=(time.perf_counter() - t0) * 1000,
        )
