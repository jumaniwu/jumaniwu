"""Risk management — position sizing, stop-loss, daily loss limit."""
from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PositionSizeResult:
    quantity: float
    notional: float
    stop_loss: float
    take_profit: float
    risk_amount: float


@dataclass
class RiskConfig:
    max_position_pct: float = 0.02
    stop_loss_pct: float = 0.02
    take_profit_pct: float = 0.04
    daily_loss_limit_pct: float = 0.05
    max_concurrent_positions: int = 3


class RiskManager:
    def __init__(self, config: RiskConfig):
        self.cfg = config

    def calculate_position_size(
        self,
        portfolio_value: float,
        entry_price: float,
        side: str = "buy",
    ) -> PositionSizeResult:
        notional = portfolio_value * self.cfg.max_position_pct
        quantity = notional / entry_price

        if side == "buy":
            stop_loss = entry_price * (1 - self.cfg.stop_loss_pct)
            take_profit = entry_price * (1 + self.cfg.take_profit_pct)
        else:
            stop_loss = entry_price * (1 + self.cfg.stop_loss_pct)
            take_profit = entry_price * (1 - self.cfg.take_profit_pct)

        risk_amount = notional * self.cfg.stop_loss_pct

        return PositionSizeResult(
            quantity=round(quantity, 8),
            notional=round(notional, 2),
            stop_loss=round(stop_loss, 8),
            take_profit=round(take_profit, 8),
            risk_amount=round(risk_amount, 4),
        )

    def is_daily_loss_limit_breached(self, day_start_value: float, current_value: float) -> bool:
        if day_start_value <= 0:
            return False
        drawdown = (day_start_value - current_value) / day_start_value
        if drawdown >= self.cfg.daily_loss_limit_pct:
            logger.warning(
                "Daily loss limit breached: drawdown=%.2f%% limit=%.2f%%",
                drawdown * 100, self.cfg.daily_loss_limit_pct * 100,
            )
            return True
        return False

    def can_open_position(self, open_positions: list[dict], pair: str) -> tuple[bool, str]:
        if any(p["pair"] == pair for p in open_positions):
            return False, f"Already have open position in {pair}"
        if len(open_positions) >= self.cfg.max_concurrent_positions:
            return False, f"Max concurrent positions ({self.cfg.max_concurrent_positions}) reached"
        return True, ""

    def should_stop_loss(self, stop_loss_price: float, current_price: float, side: str = "buy") -> bool:
        if side == "buy":
            return current_price <= stop_loss_price
        return current_price >= stop_loss_price

    def should_take_profit(self, take_profit_price: float, current_price: float, side: str = "buy") -> bool:
        if side == "buy":
            return current_price >= take_profit_price
        return current_price <= take_profit_price

    def validate_trade(self, available_balance: float, notional: float) -> tuple[bool, str]:
        if notional > available_balance:
            return False, f"Insufficient balance: need ${notional:.2f}, have ${available_balance:.2f}"
        if notional <= 0:
            return False, "Position notional must be > 0"
        return True, ""
