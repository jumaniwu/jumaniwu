"""
Generates realistic mock HFT data streams for the trading dashboard.
All values are synthetic — no real market connections.
"""

import random
import math
import time
from dataclasses import dataclass, field
from typing import Optional

# ── Seed state ────────────────────────────────────────────────────────────────

class PriceSimulator:
    """Geometric Brownian Motion price simulator."""

    def __init__(self, symbol: str, start: float, mu: float = 0.0, sigma: float = 0.0012):
        self.symbol = symbol
        self.price = start
        self.mu = mu
        self.sigma = sigma
        self._open = start
        self._high = start
        self._low = start
        self._tick_count = 0
        self._candle_start = time.time()
        self._candle_interval = 5.0  # 5-second candles

    def tick(self) -> dict:
        dt = 0.1
        shock = random.gauss(0, 1)
        self.price *= math.exp((self.mu - 0.5 * self.sigma ** 2) * dt + self.sigma * math.sqrt(dt) * shock)
        self._high = max(self._high, self.price)
        self._low = min(self._low, self.price)
        self._tick_count += 1

        now = time.time()
        candle = None
        if now - self._candle_start >= self._candle_interval:
            volume = random.uniform(0.5, 8.0) * (1 + abs(shock))
            candle = {
                "time": int(self._candle_start),
                "open": round(self._open, 2),
                "high": round(self._high, 2),
                "low": round(self._low, 2),
                "close": round(self.price, 2),
                "volume": round(volume, 4),
            }
            self._open = self.price
            self._high = self.price
            self._low = self.price
            self._candle_start = now

        return {
            "symbol": self.symbol,
            "price": round(self.price, 2),
            "candle": candle,
        }


class PolymarketSimulator:
    """Simulates Polymarket contract positions."""

    CONTRACTS = [
        {"id": "PM-001", "name": "BTC > 70k EOY",    "side": "YES"},
        {"id": "PM-002", "name": "ETH Merge Q3",     "side": "NO"},
        {"id": "PM-003", "name": "Fed Cut Jul",      "side": "YES"},
        {"id": "PM-004", "name": "BTC < 50k Nov",    "side": "NO"},
        {"id": "PM-005", "name": "Gold ATH Q4",      "side": "YES"},
    ]

    def __init__(self):
        self.positions = {
            c["id"]: {
                **c,
                "entry_price": round(random.uniform(0.30, 0.70), 3),
                "size": round(random.uniform(500, 5000), 0),
                "current_price": round(random.uniform(0.30, 0.70), 3),
                "unrealized_pnl": 0.0,
            }
            for c in self.CONTRACTS
        }

    def tick(self) -> list[dict]:
        updated = []
        for pid, pos in self.positions.items():
            drift = random.gauss(0, 0.004)
            pos["current_price"] = max(0.01, min(0.99, pos["current_price"] + drift))
            pos["unrealized_pnl"] = round(
                (pos["current_price"] - pos["entry_price"]) * pos["size"], 2
            )
            updated.append({**pos, "current_price": round(pos["current_price"], 3)})
        return updated


class HedgeScannerSimulator:
    """Simulates the BTC Bybit/Polymarket spread."""

    def __init__(self):
        self.bybit_mid = 67000.0
        self.poly_implied = 0.62
        self._spread_history: list[float] = []

    def tick(self, btc_price: float) -> dict:
        self.bybit_mid = btc_price
        self.poly_implied = max(0.01, min(0.99, self.poly_implied + random.gauss(0, 0.003)))
        poly_price = self.poly_implied * 100000
        spread = round(btc_price - poly_price, 2)
        spread_pct = round(spread / btc_price * 100, 4)
        self._spread_history.append(spread_pct)
        if len(self._spread_history) > 60:
            self._spread_history.pop(0)

        signal = "NEUTRAL"
        if abs(spread_pct) > 0.15:
            signal = "ARBIT" if spread_pct > 0 else "REVERSE_ARBIT"

        return {
            "bybit_mid": round(btc_price, 2),
            "poly_implied": round(self.poly_implied, 4),
            "spread": spread,
            "spread_pct": spread_pct,
            "signal": signal,
            "history": list(self._spread_history[-30:]),
        }


STATE_MACHINE_NODES = [
    "tick_feed",
    "scan_polymarket",
    "mid_mispricing",
    "limit_fill",
    "hold",
    "resolve",
]

STATE_TRANSITIONS = {
    "tick_feed":       {"next": "scan_polymarket",  "weight": 0.6},
    "scan_polymarket": {"next": "mid_mispricing",   "weight": 0.45},
    "mid_mispricing":  {"next": "limit_fill",       "weight": 0.35},
    "limit_fill":      {"next": "hold",             "weight": 0.7},
    "hold":            {"next": "resolve",          "weight": 0.25},
    "resolve":         {"next": "tick_feed",        "weight": 1.0},
}


class StateMachineSimulator:
    def __init__(self):
        self.current = "tick_feed"
        self.completed: set[str] = set()
        self._ticks_in_state = 0

    def tick(self) -> dict:
        self._ticks_in_state += 1
        trans = STATE_TRANSITIONS[self.current]
        should_advance = random.random() < trans["weight"] and self._ticks_in_state >= 3

        if should_advance:
            self.completed.add(self.current)
            if self.current == "resolve":
                self.completed.clear()
            self.current = trans["next"]
            self._ticks_in_state = 0

        return {
            "current_node": self.current,
            "completed_nodes": list(self.completed),
        }


class WalletSimulator:
    def __init__(self):
        self.total_pnl = 12847.33
        self.wins = 134
        self.losses = 47
        self.peak_pnl = self.total_pnl
        self._equity_curve: list[dict] = []
        self._start_time = int(time.time()) - 3600 * 24 * 30  # 30 days back

        # Seed equity curve
        val = 10000.0
        for i in range(200):
            val += random.gauss(50, 320)
            self._equity_curve.append({
                "time": self._start_time + i * 3600 * 4,
                "value": round(val, 2),
            })

    @property
    def win_rate(self) -> float:
        total = self.wins + self.losses
        return round(self.wins / total * 100, 1) if total > 0 else 0.0

    @property
    def drawdown(self) -> float:
        if self.peak_pnl == 0:
            return 0.0
        return round((self.peak_pnl - self.total_pnl) / self.peak_pnl * 100, 2)

    def tick(self, poly_positions: list[dict]) -> dict:
        delta = sum(p["unrealized_pnl"] for p in poly_positions) * 0.001
        self.total_pnl = round(self.total_pnl + random.gauss(delta, 8), 2)
        self.peak_pnl = max(self.peak_pnl, self.total_pnl)

        if random.random() < 0.04:
            if random.random() < 0.74:
                self.wins += 1
            else:
                self.losses += 1

        now = int(time.time())
        if not self._equity_curve or now - self._equity_curve[-1]["time"] > 30:
            self._equity_curve.append({"time": now, "value": self.total_pnl + 10000})
            if len(self._equity_curve) > 500:
                self._equity_curve.pop(0)

        return {
            "total_pnl": self.total_pnl,
            "win_rate": self.win_rate,
            "wins": self.wins,
            "losses": self.losses,
            "drawdown": self.drawdown,
            "equity_curve": list(self._equity_curve[-100:]),
        }


LOG_TEMPLATES = [
    ("[BUY ]", "YES", lambda p: f"BTC Yes @ {p:.3f}",   "green"),
    ("[SELL]", "NO",  lambda p: f"ETH No  @ {p:.3f}",   "red"),
    ("[FILL]", "OK",  lambda p: f"Limit filled ${p:.2f}","yellow"),
    ("[SCAN]", ">>",  lambda p: f"Spread {p:.4f}%",     "cyan"),
    ("[HEDGE]","<>",  lambda p: f"Delta neutral {p:.3f}","magenta"),
    ("[WARN]", "!!", lambda p: f"Slippage {p:.4f}",     "orange"),
]


def generate_log_entry() -> dict:
    template = random.choice(LOG_TEMPLATES)
    tag, label, msg_fn, color = template
    price = random.uniform(0.2, 0.9)
    ts = time.strftime("%H:%M:%S")
    return {
        "timestamp": ts,
        "tag": tag,
        "label": label,
        "message": msg_fn(price),
        "color": color,
    }


class AnalyticsSimulator:
    def __init__(self):
        self._volume_by_hour: dict[str, float] = {}
        self._roi_by_day: list[dict] = []
        self._start_time = int(time.time())

        for i in range(24):
            hour = f"{i:02d}:00"
            self._volume_by_hour[hour] = round(random.uniform(10000, 800000), 0)

        base_roi = 0.0
        for i in range(14):
            base_roi += random.gauss(0.4, 1.2)
            self._roi_by_day.append({
                "day": f"D-{14 - i}",
                "roi": round(base_roi, 2),
            })

    def tick(self) -> dict:
        hour = time.strftime("%H:00")
        self._volume_by_hour[hour] = self._volume_by_hour.get(hour, 0) + round(
            random.uniform(1000, 15000), 0
        )
        total_volume = sum(self._volume_by_hour.values())
        return {
            "volume_by_hour": self._volume_by_hour,
            "roi_by_day": self._roi_by_day,
            "total_volume_24h": round(total_volume, 0),
            "avg_roi_daily": round(
                sum(d["roi"] for d in self._roi_by_day) / len(self._roi_by_day), 3
            ),
        }
