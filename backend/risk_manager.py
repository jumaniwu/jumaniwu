"""
RiskManager — pre-trade checks that sit between signal generation and execution.

Checks (in order):
  1. Circuit breaker: trading halted if drawdown exceeds MAX_DRAWDOWN_PCT
  2. Cooldown: minimum seconds between orders on the same symbol
  3. Max open orders: total orders across all exchanges capped
  4. Position size: per-symbol notional ceiling
  5. Daily loss limit: cumulative realised + unrealised loss ceiling

All limits are hard-coded constants. None can be disabled at runtime.
Failed checks raise RiskVetoError — the signal is discarded, never executed.
"""

import logging
import time
from dataclasses import dataclass, field

log = logging.getLogger(__name__)

# ── Hard limits ───────────────────────────────────────────────────────────────

MAX_DRAWDOWN_PCT    = 15.0   # halt all trading above this portfolio drawdown
MAX_OPEN_ORDERS     = 10     # across all exchanges
COOLDOWN_SECONDS    = 5.0    # minimum gap between orders on same symbol
MAX_SYMBOL_NOTIONAL = 300.0  # per-symbol exposure ceiling (USD)
MAX_DAILY_LOSS      = 250.0  # cumulative daily loss ceiling (USD)


# ── Exceptions ────────────────────────────────────────────────────────────────

class RiskVetoError(RuntimeError):
    """Raised when a pre-trade risk check blocks a signal."""


# ── Risk state ────────────────────────────────────────────────────────────────

@dataclass
class RiskState:
    circuit_open:     bool  = False   # True → all trading halted
    daily_loss:       float = 0.0     # cumulative day's P&L (negative = loss)
    open_order_count: int   = 0
    last_order_ts:    dict[str, float] = field(default_factory=dict)   # symbol → ts
    symbol_notional:  dict[str, float] = field(default_factory=dict)   # symbol → USD


# ── Manager ───────────────────────────────────────────────────────────────────

class RiskManager:

    def __init__(self) -> None:
        self._state = RiskState()
        self._day_start = self._today_epoch()
        log.info(
            "RiskManager ready — drawdown_halt=%.0f%%  cooldown=%.1fs  "
            "max_orders=%d  max_sym_notional=$%.0f  max_daily_loss=$%.0f",
            MAX_DRAWDOWN_PCT, COOLDOWN_SECONDS,
            MAX_OPEN_ORDERS, MAX_SYMBOL_NOTIONAL, MAX_DAILY_LOSS,
        )

    # ── Public API ────────────────────────────────────────────────────────────

    def check(
        self,
        symbol: str,
        qty: float,
        price: float,
        *,
        current_drawdown_pct: float = 0.0,
        current_unrealised_pnl: float = 0.0,
    ) -> None:
        """
        Run all pre-trade checks. Raises RiskVetoError on any failure.
        Call this BEFORE every execution_manager.execute_limit_order().
        """
        self._maybe_reset_daily()
        notional = qty * price

        self._check_circuit_breaker(current_drawdown_pct)
        self._check_daily_loss(current_unrealised_pnl)
        self._check_open_orders()
        self._check_cooldown(symbol)
        self._check_symbol_notional(symbol, notional)

    def on_order_placed(self, symbol: str, notional: float) -> None:
        """Update risk state after a successful order placement."""
        now = time.time()
        self._state.last_order_ts[symbol]   = now
        self._state.open_order_count        += 1
        self._state.symbol_notional[symbol] = (
            self._state.symbol_notional.get(symbol, 0.0) + notional
        )

    def on_order_filled(self, pnl: float) -> None:
        """Update daily P&L when a fill completes."""
        self._state.daily_loss += pnl   # negative pnl increases daily_loss magnitude

    def on_order_closed(self, symbol: str, notional: float) -> None:
        """Reduce exposure when an order closes."""
        self._state.open_order_count = max(0, self._state.open_order_count - 1)
        self._state.symbol_notional[symbol] = max(
            0.0, self._state.symbol_notional.get(symbol, 0.0) - notional
        )

    def open_circuit(self, reason: str) -> None:
        self._state.circuit_open = True
        log.error("CIRCUIT BREAKER OPEN — %s", reason)

    def close_circuit(self) -> None:
        self._state.circuit_open = False
        log.warning("CIRCUIT BREAKER CLOSED — trading resumed")

    @property
    def state(self) -> RiskState:
        return self._state

    # ── Individual checks ─────────────────────────────────────────────────────

    def _check_circuit_breaker(self, drawdown_pct: float) -> None:
        if drawdown_pct >= MAX_DRAWDOWN_PCT:
            self.open_circuit(f"drawdown {drawdown_pct:.1f}% >= {MAX_DRAWDOWN_PCT:.0f}%")
        if self._state.circuit_open:
            raise RiskVetoError(
                f"Circuit breaker OPEN — all trading halted "
                f"(drawdown={drawdown_pct:.1f}%)"
            )

    def _check_daily_loss(self, unrealised_pnl: float) -> None:
        total_loss = min(0.0, self._state.daily_loss + unrealised_pnl)
        if abs(total_loss) >= MAX_DAILY_LOSS:
            raise RiskVetoError(
                f"Daily loss limit reached: ${abs(total_loss):.2f} >= ${MAX_DAILY_LOSS:.0f}"
            )

    def _check_open_orders(self) -> None:
        if self._state.open_order_count >= MAX_OPEN_ORDERS:
            raise RiskVetoError(
                f"Max open orders reached: {self._state.open_order_count}/{MAX_OPEN_ORDERS}"
            )

    def _check_cooldown(self, symbol: str) -> None:
        last = self._state.last_order_ts.get(symbol, 0.0)
        elapsed = time.time() - last
        if elapsed < COOLDOWN_SECONDS:
            raise RiskVetoError(
                f"Cooldown active on {symbol}: {elapsed:.1f}s < {COOLDOWN_SECONDS:.0f}s"
            )

    def _check_symbol_notional(self, symbol: str, new_notional: float) -> None:
        current = self._state.symbol_notional.get(symbol, 0.0)
        if current + new_notional > MAX_SYMBOL_NOTIONAL:
            raise RiskVetoError(
                f"Symbol notional limit: ${current + new_notional:.2f} > "
                f"${MAX_SYMBOL_NOTIONAL:.0f} for {symbol}"
            )

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _today_epoch() -> float:
        import datetime
        today = datetime.date.today()
        return time.mktime(today.timetuple())

    def _maybe_reset_daily(self) -> None:
        if time.time() - self._day_start >= 86400:
            self._day_start = self._today_epoch()
            self._state.daily_loss = 0.0
            log.info("RiskManager: daily P&L counter reset")
