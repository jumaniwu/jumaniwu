"""Walk-forward backtester — uses TA signals only (no Claude calls)."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from agent.strategy import TechnicalAnalyzer
    from agent.risk_manager import RiskManager

logger = logging.getLogger(__name__)


@dataclass
class BacktestTrade:
    pair: str
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    pnl_pct: float
    open_idx: int
    close_idx: int
    close_reason: str


@dataclass
class BacktestResult:
    pair: str
    initial_balance: float
    final_balance: float
    total_return_pct: float
    total_trades: int
    winning_trades: int
    win_rate: float
    max_drawdown_pct: float
    sharpe_ratio: float
    trades: list[dict] = field(default_factory=list)
    equity_curve: list[dict] = field(default_factory=list)


class Backtester:
    def __init__(self, analyzer: "TechnicalAnalyzer", risk_manager: "RiskManager"):
        self._analyzer = analyzer
        self._risk = risk_manager

    def run(
        self,
        ohlcv: list[list],
        pair: str,
        initial_balance: float = 10000.0,
        min_candles: int = 50,
        fee_rate: float = 0.001,
    ) -> dict:
        if len(ohlcv) < min_candles + 10:
            return {"error": f"Not enough data: {len(ohlcv)} candles (need {min_candles + 10})"}

        balance = initial_balance
        equity_curve = [{"idx": 0, "value": balance}]
        trades: list[BacktestTrade] = []

        in_position = False
        entry_price = 0.0
        entry_quantity = 0.0
        stop_loss = 0.0
        take_profit = 0.0
        entry_idx = 0

        # Walk forward: at candle i, use only data up to i
        for i in range(min_candles, len(ohlcv)):
            window = ohlcv[:i + 1]
            closes = [c[4] for c in window]
            current_price = float(closes[-1])
            high = float(ohlcv[i][2])
            low = float(ohlcv[i][3])
            ts = ohlcv[i][0]

            # Check exit conditions if in position
            if in_position:
                exit_reason = None
                exit_price = current_price

                if low <= stop_loss:
                    exit_price = stop_loss
                    exit_reason = "stop_loss"
                elif high >= take_profit:
                    exit_price = take_profit
                    exit_reason = "take_profit"

                if exit_reason:
                    pnl = (exit_price - entry_price) * entry_quantity - (
                        entry_price * entry_quantity + exit_price * entry_quantity
                    ) * fee_rate
                    pnl_pct = (exit_price - entry_price) / entry_price * 100
                    balance += exit_price * entry_quantity * (1 - fee_rate)
                    trades.append(BacktestTrade(
                        pair=pair, entry_price=entry_price, exit_price=exit_price,
                        quantity=entry_quantity, pnl=round(pnl, 4), pnl_pct=round(pnl_pct, 4),
                        open_idx=entry_idx, close_idx=i, close_reason=exit_reason,
                    ))
                    in_position = False

            # Run TA analysis on window
            analysis = self._analyzer.analyze(window, pair)

            # Entry signal: only enter if not in position and strong buy
            if not in_position and analysis.verdict == "buy" and analysis.score >= 65:
                notional = balance * self._risk.cfg.max_position_pct
                if notional < 10:
                    equity_curve.append({"idx": i, "ts": ts, "value": round(balance, 2)})
                    continue

                cost = notional * (1 + fee_rate)
                if cost > balance:
                    equity_curve.append({"idx": i, "ts": ts, "value": round(balance, 2)})
                    continue

                entry_price = current_price
                entry_quantity = notional / entry_price
                stop_loss = entry_price * (1 - self._risk.cfg.stop_loss_pct)
                take_profit = entry_price * (1 + self._risk.cfg.take_profit_pct)
                balance -= cost
                entry_idx = i
                in_position = True

            # Signal-based exit if in position
            elif in_position and analysis.verdict == "sell" and analysis.score <= 35:
                pnl_pct = (current_price - entry_price) / entry_price * 100
                pnl = (current_price - entry_price) * entry_quantity - (
                    entry_price * entry_quantity + current_price * entry_quantity
                ) * fee_rate
                balance += current_price * entry_quantity * (1 - fee_rate)
                trades.append(BacktestTrade(
                    pair=pair, entry_price=entry_price, exit_price=current_price,
                    quantity=entry_quantity, pnl=round(pnl, 4), pnl_pct=round(pnl_pct, 4),
                    open_idx=entry_idx, close_idx=i, close_reason="signal",
                ))
                in_position = False

            # Position value for equity curve
            portfolio_val = balance + (entry_quantity * current_price if in_position else 0)
            equity_curve.append({"idx": i, "ts": ts, "value": round(portfolio_val, 2)})

        # Close any remaining position at last price
        if in_position and ohlcv:
            final_price = float(ohlcv[-1][4])
            pnl = (final_price - entry_price) * entry_quantity
            balance += final_price * entry_quantity * (1 - fee_rate)
            trades.append(BacktestTrade(
                pair=pair, entry_price=entry_price, exit_price=final_price,
                quantity=entry_quantity, pnl=round(pnl, 4),
                pnl_pct=round((final_price - entry_price) / entry_price * 100, 4),
                open_idx=entry_idx, close_idx=len(ohlcv) - 1, close_reason="end_of_data",
            ))

        winners = [t for t in trades if t.pnl > 0]
        equity_values = [e["value"] for e in equity_curve]
        total_return_pct = (balance - initial_balance) / initial_balance * 100

        return {
            "pair": pair,
            "initial_balance": initial_balance,
            "final_balance": round(balance, 2),
            "total_return_pct": round(total_return_pct, 4),
            "total_trades": len(trades),
            "winning_trades": len(winners),
            "win_rate": round(len(winners) / len(trades), 4) if trades else 0.0,
            "max_drawdown_pct": round(self._max_drawdown(equity_values), 4),
            "sharpe_ratio": round(self._sharpe(equity_values), 4),
            "trades": [
                {"entry": t.entry_price, "exit": t.exit_price, "pnl": t.pnl,
                 "pnl_pct": t.pnl_pct, "reason": t.close_reason}
                for t in trades
            ],
            "equity_curve": equity_curve[::max(1, len(equity_curve) // 200)],  # downsample
        }

    def _max_drawdown(self, values: list[float]) -> float:
        if len(values) < 2:
            return 0.0
        arr = np.array(values)
        peak = np.maximum.accumulate(arr)
        drawdown = (peak - arr) / np.where(peak == 0, 1, peak) * 100
        return float(np.max(drawdown))

    def _sharpe(self, values: list[float], risk_free: float = 0.0) -> float:
        if len(values) < 2:
            return 0.0
        arr = np.array(values)
        returns = np.diff(arr) / np.where(arr[:-1] == 0, 1, arr[:-1])
        if returns.std() == 0:
            return 0.0
        return float((returns.mean() - risk_free) / returns.std() * np.sqrt(len(returns)))
