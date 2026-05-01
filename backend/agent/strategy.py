"""Technical analysis engine — Python port of js/technicalAnalysis.js."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Literal

import numpy as np

logger = logging.getLogger(__name__)

Signal = Literal["buy", "sell", "hold"]


@dataclass
class IndicatorResult:
    name: str
    value: float | None
    signal: Signal
    display_value: str
    weight: float
    note: str


@dataclass
class AnalysisResult:
    pair: str
    current_price: float
    verdict: Signal
    score: float          # 0–100
    indicators: list[IndicatorResult] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    atr_value: float = 0.0
    atr_pct: float = 0.0

    def to_prompt_lines(self) -> str:
        lines = [
            f"Composite Verdict: {self.verdict.upper()} (Score: {self.score:.1f}/100)",
            f"Buy Signals: {sum(1 for i in self.indicators if i.signal == 'buy')}",
            f"Sell Signals: {sum(1 for i in self.indicators if i.signal == 'sell')}",
            f"Neutral Signals: {sum(1 for i in self.indicators if i.signal == 'hold')}",
            "",
            "Indicator Details:",
        ]
        for ind in self.indicators:
            lines.append(f"- {ind.name}: {ind.display_value} → {ind.signal.upper()} ({ind.note})")
        return "\n".join(lines)


class TechnicalAnalyzer:
    """Walk-forward technical analysis. Mirrors js/technicalAnalysis.js weights."""

    # Indicator weights (same as frontend)
    _WEIGHTS = {
        "RSI": 2.0, "MACD": 2.0, "SMA200": 2.0,
        "SMA50": 1.5, "EMA12": 1.5,
        "SMA20": 1.0, "BB": 1.0, "STOCH": 1.0,
    }

    def analyze(self, ohlcv: list[list], pair: str) -> AnalysisResult:
        if len(ohlcv) < 30:
            return AnalysisResult(pair=pair, current_price=0.0, verdict="hold", score=50.0,
                                  reasons=["Insufficient data"])

        o = np.array([c[1] for c in ohlcv], dtype=float)
        h = np.array([c[2] for c in ohlcv], dtype=float)
        l = np.array([c[3] for c in ohlcv], dtype=float)
        c = np.array([c[4] for c in ohlcv], dtype=float)
        current_price = float(c[-1])

        indicators: list[IndicatorResult] = []

        # RSI
        rsi_data = self._rsi(c)
        if rsi_data:
            v = rsi_data["value"]
            if v < 30:
                sig, note = "buy", f"Oversold (< 30)"
            elif v > 70:
                sig, note = "sell", f"Overbought (> 70)"
            else:
                sig, note = "hold", f"Neutral zone"
            indicators.append(IndicatorResult("RSI(14)", v, sig, f"{v:.1f}", self._WEIGHTS["RSI"], note))

        # MACD
        macd_data = self._macd(c)
        if macd_data:
            hist = macd_data["histogram"]
            prev_hist = macd_data["prev_histogram"]
            if hist > 0 and hist > prev_hist:
                sig, note = "buy", "Bullish momentum increasing"
            elif hist < 0 and hist < prev_hist:
                sig, note = "sell", "Bearish momentum increasing"
            elif macd_data["macd"] > macd_data["signal"]:
                sig, note = "buy", "MACD above signal line"
            elif macd_data["macd"] < macd_data["signal"]:
                sig, note = "sell", "MACD below signal line"
            else:
                sig, note = "hold", "No clear signal"
            indicators.append(IndicatorResult(
                "MACD(12/26/9)", macd_data["macd"], sig,
                f"{macd_data['macd']:.4f}", self._WEIGHTS["MACD"], note,
            ))

        # Bollinger Bands
        bb_data = self._bollinger_bands(c)
        if bb_data:
            pct_b = bb_data["pct_b"]
            if pct_b < 0.0:
                sig, note = "buy", "Price below lower band"
            elif pct_b > 1.0:
                sig, note = "sell", "Price above upper band"
            elif pct_b < 0.2:
                sig, note = "buy", "Price near lower band"
            elif pct_b > 0.8:
                sig, note = "sell", "Price near upper band"
            else:
                sig, note = "hold", "Price in middle band"
            indicators.append(IndicatorResult(
                "Bollinger Bands", pct_b, sig,
                f"%B={pct_b:.2f}", self._WEIGHTS["BB"], note,
            ))

        # SMA 20
        sma20 = self._sma(c, 20)
        if sma20 is not None:
            if current_price > sma20:
                sig, note = "buy", f"Price above SMA20 ({sma20:.4f})"
            else:
                sig, note = "sell", f"Price below SMA20 ({sma20:.4f})"
            indicators.append(IndicatorResult("SMA20", sma20, sig, f"{sma20:.4f}", self._WEIGHTS["SMA20"], note))

        # SMA 50
        sma50 = self._sma(c, 50)
        if sma50 is not None:
            if current_price > sma50:
                sig, note = "buy", f"Price above SMA50 ({sma50:.4f})"
            else:
                sig, note = "sell", f"Price below SMA50 ({sma50:.4f})"
            indicators.append(IndicatorResult("SMA50", sma50, sig, f"{sma50:.4f}", self._WEIGHTS["SMA50"], note))

        # SMA 200
        sma200 = self._sma(c, 200)
        if sma200 is not None:
            if current_price > sma200:
                sig, note = "buy", f"Price above SMA200 — bull trend"
            else:
                sig, note = "sell", f"Price below SMA200 — bear trend"
            indicators.append(IndicatorResult("SMA200", sma200, sig, f"{sma200:.4f}", self._WEIGHTS["SMA200"], note))

        # EMA 12 vs EMA 26
        ema12 = self._ema(c, 12)
        ema26 = self._ema(c, 26)
        if ema12 is not None and ema26 is not None:
            if ema12 > ema26:
                sig, note = "buy", f"EMA12 ({ema12:.4f}) > EMA26 ({ema26:.4f})"
            else:
                sig, note = "sell", f"EMA12 ({ema12:.4f}) < EMA26 ({ema26:.4f})"
            indicators.append(IndicatorResult("EMA12/26", ema12, sig, f"{ema12:.4f}/{ema26:.4f}", self._WEIGHTS["EMA12"], note))

        # Stochastic
        stoch = self._stochastic(h, l, c)
        if stoch:
            k, d = stoch["k"], stoch["d"]
            if k < 20 and d < 20:
                sig, note = "buy", f"Oversold %K={k:.1f}"
            elif k > 80 and d > 80:
                sig, note = "sell", f"Overbought %K={k:.1f}"
            elif k > d and k < 50:
                sig, note = "buy", "Bullish crossover in lower zone"
            elif k < d and k > 50:
                sig, note = "sell", "Bearish crossover in upper zone"
            else:
                sig, note = "hold", f"%K={k:.1f} %D={d:.1f}"
            indicators.append(IndicatorResult("Stochastic", k, sig, f"%K={k:.1f}/%D={d:.1f}", self._WEIGHTS["STOCH"], note))

        # ATR
        atr_val = self._atr(h, l, c)
        atr_pct = (atr_val / current_price * 100) if atr_val and current_price else 0.0

        # Composite score
        total_weight = sum(ind.weight for ind in indicators)
        if total_weight == 0:
            score = 50.0
        else:
            weighted_score = sum(
                (ind.weight * (100 if ind.signal == "buy" else 0 if ind.signal == "sell" else 50))
                for ind in indicators
            )
            score = weighted_score / total_weight

        if score >= 60:
            verdict: Signal = "buy"
        elif score <= 40:
            verdict = "sell"
        else:
            verdict = "hold"

        reasons = [ind.note for ind in indicators if ind.signal == verdict][:3]

        return AnalysisResult(
            pair=pair,
            current_price=current_price,
            verdict=verdict,
            score=round(score, 2),
            indicators=indicators,
            reasons=reasons,
            atr_value=atr_val or 0.0,
            atr_pct=round(atr_pct, 4),
        )

    # ── Primitives ────────────────────────────────────────────────────────────

    def _sma(self, closes: np.ndarray, period: int) -> float | None:
        if len(closes) < period:
            return None
        return float(np.mean(closes[-period:]))

    def _ema(self, closes: np.ndarray, period: int) -> float | None:
        if len(closes) < period:
            return None
        k = 2.0 / (period + 1)
        ema = float(np.mean(closes[:period]))
        for price in closes[period:]:
            ema = price * k + ema * (1 - k)
        return ema

    def _rsi(self, closes: np.ndarray, period: int = 14) -> dict | None:
        if len(closes) < period + 1:
            return None
        deltas = np.diff(closes)
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)

        avg_gain = float(np.mean(gains[:period]))
        avg_loss = float(np.mean(losses[:period]))

        for i in range(period, len(deltas)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        if avg_loss == 0:
            return {"value": 100.0}
        rs = avg_gain / avg_loss
        return {"value": round(100 - 100 / (1 + rs), 2)}

    def _macd(self, closes: np.ndarray, fast=12, slow=26, signal=9) -> dict | None:
        if len(closes) < slow + signal:
            return None
        ema_fast = self._ema_series(closes, fast)
        ema_slow = self._ema_series(closes, slow)

        min_len = min(len(ema_fast), len(ema_slow))
        macd_line = ema_fast[-min_len:] - ema_slow[-min_len:]

        if len(macd_line) < signal:
            return None
        signal_line = self._ema_series(macd_line, signal)
        histogram = macd_line[-len(signal_line):][-1] - signal_line[-1]
        prev_histogram = (macd_line[-len(signal_line):][-2] - signal_line[-2]) if len(signal_line) > 1 else 0.0

        return {
            "macd": round(float(macd_line[-1]), 6),
            "signal": round(float(signal_line[-1]), 6),
            "histogram": round(float(histogram), 6),
            "prev_histogram": round(float(prev_histogram), 6),
        }

    def _ema_series(self, data: np.ndarray, period: int) -> np.ndarray:
        k = 2.0 / (period + 1)
        result = np.empty(len(data) - period + 1)
        result[0] = np.mean(data[:period])
        for i in range(1, len(result)):
            result[i] = data[period - 1 + i] * k + result[i - 1] * (1 - k)
        return result

    def _bollinger_bands(self, closes: np.ndarray, period: int = 20, mult: float = 2.0) -> dict | None:
        if len(closes) < period:
            return None
        window = closes[-period:]
        mid = float(np.mean(window))
        std = float(np.std(window, ddof=1))
        upper = mid + mult * std
        lower = mid - mult * std
        price = float(closes[-1])
        band_width = upper - lower
        pct_b = (price - lower) / band_width if band_width > 0 else 0.5
        return {"upper": upper, "middle": mid, "lower": lower, "pct_b": round(pct_b, 4)}

    def _atr(self, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int = 14) -> float | None:
        if len(closes) < period + 1:
            return None
        tr = np.maximum(
            highs[1:] - lows[1:],
            np.maximum(np.abs(highs[1:] - closes[:-1]), np.abs(lows[1:] - closes[:-1])),
        )
        if len(tr) < period:
            return None
        atr = float(np.mean(tr[:period]))
        for i in range(period, len(tr)):
            atr = (atr * (period - 1) + tr[i]) / period
        return round(atr, 6)

    def _stochastic(self, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
                    k_period: int = 14, d_period: int = 3) -> dict | None:
        if len(closes) < k_period + d_period:
            return None
        k_values = []
        for i in range(k_period - 1, len(closes)):
            window_h = highs[i - k_period + 1: i + 1]
            window_l = lows[i - k_period + 1: i + 1]
            hh, ll = float(np.max(window_h)), float(np.min(window_l))
            if hh == ll:
                k_values.append(50.0)
            else:
                k_values.append((closes[i] - ll) / (hh - ll) * 100)

        if len(k_values) < d_period:
            return None
        k = k_values[-1]
        d = float(np.mean(k_values[-d_period:]))
        return {"k": round(k, 2), "d": round(d, 2)}
