"""Paper trading simulator — same execute interface as ExchangeConnector."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from data.database import Database
    from agent.risk_manager import RiskManager

logger = logging.getLogger(__name__)


class PaperPosition:
    def __init__(self, pair: str, side: str, entry_price: float, quantity: float,
                 stop_loss: float, take_profit: float, trade_id: int):
        self.pair = pair
        self.side = side
        self.entry_price = entry_price
        self.quantity = quantity
        self.stop_loss = stop_loss
        self.take_profit = take_profit
        self.trade_id = trade_id
        self.opened_at = datetime.utcnow()

    def unrealized_pnl(self, current_price: float) -> float:
        if self.side == "buy":
            return (current_price - self.entry_price) * self.quantity
        return (self.entry_price - current_price) * self.quantity

    def pnl_pct(self, current_price: float) -> float:
        if self.side == "buy":
            return (current_price - self.entry_price) / self.entry_price * 100
        return (self.entry_price - current_price) / self.entry_price * 100


class PaperTrader:
    def __init__(self, initial_balance: float, fee_rate: float, db: "Database"):
        self._balance = initial_balance
        self._initial_balance = initial_balance
        self._fee_rate = fee_rate
        self._db = db
        self._positions: dict[str, PaperPosition] = {}
        self._total_pnl = 0.0
        self._trade_count = 0
        self._day_start_balance = initial_balance

    def reset_day_start(self) -> None:
        self._day_start_balance = self._balance + self._portfolio_value_in_positions({})

    @property
    def balance(self) -> float:
        return self._balance

    @property
    def total_pnl(self) -> float:
        return self._total_pnl

    def get_portfolio_summary(self, current_prices: dict[str, float] | None = None) -> dict:
        cp = current_prices or {}
        position_value = sum(
            p.quantity * cp.get(p.pair, p.entry_price) for p in self._positions.values()
        )
        total_value = self._balance + position_value
        unrealized = sum(
            p.unrealized_pnl(cp.get(p.pair, p.entry_price)) for p in self._positions.values()
        )
        daily_pnl = total_value - self._day_start_balance
        daily_pnl_pct = daily_pnl / self._day_start_balance * 100 if self._day_start_balance else 0
        return {
            "total_value": round(total_value, 2),
            "available_balance": round(self._balance, 2),
            "position_value": round(position_value, 2),
            "unrealized_pnl": round(unrealized, 2),
            "total_pnl": round(self._total_pnl, 2),
            "daily_pnl": round(daily_pnl, 2),
            "daily_pnl_pct": round(daily_pnl_pct, 4),
            "day_start_balance": round(self._day_start_balance, 2),
        }

    def _portfolio_value_in_positions(self, prices: dict) -> float:
        return sum(p.quantity * prices.get(p.pair, p.entry_price) for p in self._positions.values())

    def has_position(self, pair: str) -> bool:
        return pair in self._positions

    def get_positions_snapshot(self, current_prices: dict[str, float]) -> list[dict]:
        result = []
        for pair, pos in self._positions.items():
            cp = current_prices.get(pair, pos.entry_price)
            result.append({
                "pair": pair,
                "side": pos.side,
                "entry_price": pos.entry_price,
                "current_price": cp,
                "quantity": pos.quantity,
                "stop_loss": pos.stop_loss,
                "take_profit": pos.take_profit,
                "unrealized_pnl": round(pos.unrealized_pnl(cp), 4),
                "pnl_pct": round(pos.pnl_pct(cp), 4),
                "trade_id": pos.trade_id,
                "opened_at": pos.opened_at.isoformat() + "Z",
            })
        return result

    async def execute_buy(
        self,
        pair: str,
        quantity: float,
        price: float,
        stop_loss: float,
        take_profit: float,
        ai_reasoning: str = "",
    ) -> dict:
        if pair in self._positions:
            return {"success": False, "error": f"Already have position in {pair}"}

        notional = quantity * price
        fee = notional * self._fee_rate
        total_cost = notional + fee

        if total_cost > self._balance:
            return {"success": False, "error": "Insufficient balance"}

        self._balance -= total_cost
        self._trade_count += 1

        trade = await self._db.save_trade({
            "pair": pair,
            "side": "buy",
            "mode": "paper",
            "entry_price": price,
            "quantity": quantity,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "status": "open",
            "ai_reasoning": ai_reasoning,
            "opened_at": datetime.utcnow(),
        })

        self._positions[pair] = PaperPosition(pair, "buy", price, quantity, stop_loss, take_profit, trade["id"])

        await self._db.upsert_position({
            "pair": pair,
            "side": "buy",
            "entry_price": price,
            "current_price": price,
            "quantity": quantity,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "unrealized_pnl": 0.0,
            "pnl_pct": 0.0,
            "trade_id": trade["id"],
            "opened_at": datetime.utcnow(),
        })

        logger.info("[PAPER] BUY %s qty=%.6f @ %.4f SL=%.4f TP=%.4f", pair, quantity, price, stop_loss, take_profit)
        return {"success": True, "trade_id": trade["id"], "notional": notional, "fee": fee}

    async def execute_sell(
        self,
        pair: str,
        current_price: float,
        reason: str = "signal",
    ) -> dict:
        pos = self._positions.get(pair)
        if not pos:
            return {"success": False, "error": f"No open position in {pair}"}

        notional = pos.quantity * current_price
        fee = notional * self._fee_rate
        proceeds = notional - fee

        pnl = pos.unrealized_pnl(current_price) - (pos.entry_price * pos.quantity * self._fee_rate)
        pnl_pct = pos.pnl_pct(current_price)

        self._balance += proceeds
        self._total_pnl += pnl
        del self._positions[pair]

        await self._db.update_trade(
            pos.trade_id,
            exit_price=current_price,
            status="closed",
            pnl=round(pnl, 4),
            pnl_pct=round(pnl_pct, 4),
            close_reason=reason,
            closed_at=datetime.utcnow(),
        )
        await self._db.delete_position(pair)

        logger.info("[PAPER] SELL %s @ %.4f PnL=%.4f (%.2f%%) reason=%s", pair, current_price, pnl, pnl_pct, reason)
        return {"success": True, "pnl": pnl, "pnl_pct": pnl_pct, "reason": reason}

    async def check_exit_conditions(
        self,
        current_prices: dict[str, float],
        risk_manager: "RiskManager",
    ) -> list[dict]:
        exits = []
        for pair, pos in list(self._positions.items()):
            price = current_prices.get(pair)
            if price is None:
                continue
            if risk_manager.should_stop_loss(pos.stop_loss, price, pos.side):
                result = await self.execute_sell(pair, price, reason="stop_loss")
                exits.append({"pair": pair, "reason": "stop_loss", "price": price, **result})
            elif risk_manager.should_take_profit(pos.take_profit, price, pos.side):
                result = await self.execute_sell(pair, price, reason="take_profit")
                exits.append({"pair": pair, "reason": "take_profit", "price": price, **result})
        return exits

    async def update_position_prices(self, current_prices: dict[str, float]) -> None:
        for pair, pos in self._positions.items():
            cp = current_prices.get(pair)
            if cp is None:
                continue
            await self._db.upsert_position({
                "pair": pair,
                "side": pos.side,
                "entry_price": pos.entry_price,
                "current_price": cp,
                "quantity": pos.quantity,
                "stop_loss": pos.stop_loss,
                "take_profit": pos.take_profit,
                "unrealized_pnl": round(pos.unrealized_pnl(cp), 4),
                "pnl_pct": round(pos.pnl_pct(cp), 4),
                "trade_id": pos.trade_id,
                "opened_at": pos.opened_at,
            })
