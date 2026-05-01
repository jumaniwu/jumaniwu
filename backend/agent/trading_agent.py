"""Core AI trading agent powered by Claude."""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Literal

import anthropic

if TYPE_CHECKING:
    from agent.risk_manager import RiskManager
    from agent.strategy import TechnicalAnalyzer, AnalysisResult
    from api.websocket import WebSocketBroadcaster
    from data.database import Database
    from data.market_data import MarketDataFetcher
    from exchange.connector import ExchangeConnector
    from exchange.paper_trader import PaperTrader

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert quantitative crypto trading agent. Your role is to analyze technical indicators and market data, then decide whether to BUY, SELL, or HOLD for a given trading pair.

You must respond ONLY with a valid JSON object following this exact schema:
{
  "action": "buy" | "sell" | "hold",
  "confidence": 0.0 to 1.0,
  "reasoning": "concise 1-3 sentence explanation",
  "risk_factors": ["list", "of", "risks"],
  "supporting_signals": ["list of signals supporting this decision"]
}

Rules:
- Only recommend "buy" if confidence >= 0.65
- Only recommend "sell" if confidence >= 0.60
- Default to "hold" when signals are mixed or confidence is low
- Consider all indicators holistically, not in isolation
- Never explain your format — only return the JSON object"""


@dataclass
class AgentDecisionResult:
    pair: str
    action: Literal["buy", "sell", "hold"]
    confidence: float
    reasoning: str
    risk_factors: list[str]
    supporting_signals: list[str]
    raw_response: str
    error: str = ""


@dataclass
class AgentConfig:
    enabled: bool
    mode: Literal["paper", "live"]
    loop_interval_minutes: int
    pairs: list[str]
    max_concurrent_positions: int
    ai_model: str
    ai_max_tokens: int
    ai_temperature: float


class TradingAgent:
    def __init__(
        self,
        config: AgentConfig,
        db: "Database",
        market_data: "MarketDataFetcher",
        analyzer: "TechnicalAnalyzer",
        risk_manager: "RiskManager",
        paper_trader: "PaperTrader",
        connector: "ExchangeConnector",
        broadcaster: "WebSocketBroadcaster",
        anthropic_api_key: str,
    ):
        self._cfg = config
        self._db = db
        self._market_data = market_data
        self._analyzer = analyzer
        self._risk = risk_manager
        self._paper = paper_trader
        self._connector = connector
        self._broadcaster = broadcaster
        self._claude = anthropic.AsyncAnthropic(api_key=anthropic_api_key)

        self._running = False
        self._task: asyncio.Task | None = None
        self._started_at: datetime | None = None
        self._last_tick: datetime | None = None
        self._next_tick: datetime | None = None
        self._tick_count = 0
        self._halted_reason: str = ""

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self, mode: Literal["paper", "live"] | None = None) -> None:
        if self._running:
            logger.warning("Agent already running")
            return
        if mode:
            self._cfg.mode = mode
        self._running = True
        self._halted_reason = ""
        self._started_at = datetime.now(timezone.utc)
        self._task = asyncio.create_task(self._loop(), name="trading-agent-loop")
        logger.info("Agent started in %s mode for pairs: %s", self._cfg.mode, self._cfg.pairs)
        await self._broadcaster.broadcast({"type": "agent_started", "data": {"mode": self._cfg.mode}})

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Agent stopped")
        await self._broadcaster.broadcast({"type": "agent_stopped", "data": {}})

    async def _loop(self) -> None:
        while self._running:
            try:
                await self._tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Unhandled error in agent loop: %s", e)
                await self._broadcaster.broadcast({"type": "error", "data": {"message": str(e)}})

            interval = self._cfg.loop_interval_minutes * 60
            self._next_tick = datetime.now(timezone.utc).replace(
                second=0, microsecond=0
            )
            await asyncio.sleep(interval)

    # ── Main Tick ─────────────────────────────────────────────────────────────

    async def _tick(self) -> None:
        self._tick_count += 1
        self._last_tick = datetime.now(timezone.utc)
        logger.info("=== Agent tick #%d ===", self._tick_count)

        # Fetch current prices for all pairs
        current_prices = await self._market_data.get_multi_pair_prices(self._cfg.pairs)
        if not current_prices:
            logger.warning("No price data available — skipping tick")
            return

        # Update position mark-to-market
        await self._paper.update_position_prices(current_prices)

        # Check exit conditions (stop-loss / take-profit)
        exits = await self._paper.check_exit_conditions(current_prices, self._risk)
        for exit_event in exits:
            await self._broadcaster.broadcast({"type": "position_closed", "data": exit_event})
            logger.info("Position auto-closed: %s reason=%s", exit_event.get("pair"), exit_event.get("reason"))

        # Check daily loss limit
        summary = self._paper.get_portfolio_summary(current_prices)
        if self._risk.is_daily_loss_limit_breached(
            summary["day_start_balance"], summary["total_value"]
        ):
            self._halted_reason = "daily_loss_limit"
            await self._broadcaster.broadcast({
                "type": "agent_halted",
                "data": {"reason": "daily_loss_limit", "daily_pnl_pct": summary["daily_pnl_pct"]},
            })
            self._running = False
            return

        # Process each configured pair
        open_positions = await self._db.get_positions()
        for pair in self._cfg.pairs:
            if pair not in current_prices:
                continue
            try:
                await self._process_pair(pair, current_prices[pair], open_positions, summary)
            except Exception as e:
                logger.error("Error processing pair %s: %s", pair, e)

        # Broadcast full status
        status = await self.get_status()
        await self._broadcaster.broadcast({"type": "tick_complete", "data": status})
        await self._broadcaster.broadcast({"type": "price_update", "data": current_prices})

    async def _process_pair(
        self,
        pair: str,
        current_price: float,
        open_positions: list[dict],
        portfolio: dict,
    ) -> None:
        # Fetch OHLCV and run technical analysis
        ohlcv = await self._market_data.get_ohlcv(pair, limit=200)
        if len(ohlcv) < 30:
            logger.warning("Not enough OHLCV data for %s (%d candles)", pair, len(ohlcv))
            return

        analysis = self._analyzer.analyze(ohlcv, pair)
        can_open, block_reason = self._risk.can_open_position(open_positions, pair)
        has_position = self._paper.has_position(pair)

        # Ask Claude for decision
        decision = await self._ask_claude(pair, analysis, portfolio, current_price, can_open, has_position)

        # Save decision to DB
        await self._db.save_decision({
            "pair": pair,
            "decision": decision.action,
            "confidence": decision.confidence,
            "reasoning": decision.reasoning,
            "risk_factors": json.dumps(decision.risk_factors),
            "supporting_signals": json.dumps(decision.supporting_signals),
            "signals_json": json.dumps({
                "verdict": analysis.verdict,
                "score": analysis.score,
                "indicators": [
                    {"name": i.name, "value": i.value, "signal": i.signal, "note": i.note}
                    for i in analysis.indicators
                ],
            }),
            "raw_response": decision.raw_response,
            "executed": False,
            "created_at": datetime.utcnow(),
        })

        await self._broadcaster.broadcast({
            "type": "ai_decision",
            "data": {
                "pair": pair,
                "action": decision.action,
                "confidence": decision.confidence,
                "reasoning": decision.reasoning,
                "risk_factors": decision.risk_factors,
                "supporting_signals": decision.supporting_signals,
                "ta_verdict": analysis.verdict,
                "ta_score": analysis.score,
                "ts": datetime.now(timezone.utc).isoformat(),
            },
        })

        # Execute trade
        if decision.action == "buy" and can_open:
            size = self._risk.calculate_position_size(portfolio["total_value"], current_price, "buy")
            valid, err = self._risk.validate_trade(portfolio["available_balance"], size.notional)
            if not valid:
                logger.warning("Trade rejected for %s: %s", pair, err)
                return
            result = await self._paper.execute_buy(
                pair, size.quantity, current_price,
                size.stop_loss, size.take_profit,
                ai_reasoning=decision.reasoning,
            )
            if result.get("success"):
                await self._broadcaster.broadcast({"type": "position_opened", "data": {
                    "pair": pair, "price": current_price, "quantity": size.quantity,
                    "stop_loss": size.stop_loss, "take_profit": size.take_profit,
                    "notional": size.notional,
                }})
                logger.info("Opened %s position in %s @ %.4f", self._cfg.mode, pair, current_price)

        elif decision.action == "sell" and has_position:
            result = await self._paper.execute_sell(pair, current_price, reason="signal")
            if result.get("success"):
                await self._broadcaster.broadcast({"type": "position_closed", "data": {
                    "pair": pair, "price": current_price,
                    "pnl": result.get("pnl"), "reason": "signal",
                }})

        elif not can_open and decision.action == "buy":
            logger.info("BUY signal for %s blocked: %s", pair, block_reason)

    # ── Claude Integration ────────────────────────────────────────────────────

    async def _ask_claude(
        self,
        pair: str,
        analysis: "AnalysisResult",
        portfolio: dict,
        current_price: float,
        can_open: bool,
        has_position: bool,
    ) -> AgentDecisionResult:
        size = self._risk.calculate_position_size(portfolio["total_value"], current_price)
        prompt = self._build_prompt(pair, analysis, portfolio, current_price, can_open, has_position, size)

        try:
            response = await self._claude.messages.create(
                model=self._cfg.ai_model,
                max_tokens=self._cfg.ai_max_tokens,
                temperature=self._cfg.ai_temperature,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            parsed = json.loads(raw)

            action = str(parsed.get("action", "hold")).lower()
            confidence = float(parsed.get("confidence", 0.0))

            if action not in ("buy", "sell", "hold"):
                action = "hold"
            confidence = max(0.0, min(1.0, confidence))

            # Enforce confidence thresholds
            if action == "buy" and confidence < 0.65:
                action = "hold"
            if action == "sell" and confidence < 0.60:
                action = "hold"

            return AgentDecisionResult(
                pair=pair, action=action, confidence=confidence,
                reasoning=str(parsed.get("reasoning", "")),
                risk_factors=list(parsed.get("risk_factors", [])),
                supporting_signals=list(parsed.get("supporting_signals", [])),
                raw_response=raw,
            )

        except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
            logger.error("Claude response parse error for %s: %s", pair, e)
            return AgentDecisionResult(
                pair=pair, action="hold", confidence=0.0,
                reasoning=f"Parse error: {e}", risk_factors=[], supporting_signals=[],
                raw_response="", error=str(e),
            )
        except Exception as e:
            logger.error("Claude API error for %s: %s", pair, e)
            return AgentDecisionResult(
                pair=pair, action="hold", confidence=0.0,
                reasoning=f"API error: {e}", risk_factors=[], supporting_signals=[],
                raw_response="", error=str(e),
            )

    def _build_prompt(
        self,
        pair: str,
        analysis: "AnalysisResult",
        portfolio: dict,
        current_price: float,
        can_open: bool,
        has_position: bool,
        size,
    ) -> str:
        open_count = len([p for p in self._paper.get_positions_snapshot({})])
        return f"""Analyze and decide: BUY, SELL, or HOLD for {pair}

=== PORTFOLIO STATE ===
Mode: {self._cfg.mode.upper()}
Portfolio Value: ${portfolio['total_value']:.2f}
Available Balance: ${portfolio['available_balance']:.2f}
Open Positions: {open_count} / {self._cfg.max_concurrent_positions}
Already in this pair: {'YES' if has_position else 'NO'}
Today's PnL: {portfolio['daily_pnl_pct']:.2f}%
Can open new position: {'YES' if can_open else 'NO'}

=== CURRENT MARKET ===
Pair: {pair}
Current Price: ${current_price:.6f}

=== TECHNICAL ANALYSIS ===
{analysis.to_prompt_lines()}
ATR(14): {analysis.atr_value:.6f} ({analysis.atr_pct:.2f}% of price — volatility indicator)

=== IF BUYING ===
Proposed Entry: ${current_price:.6f}
Stop-Loss: ${size.stop_loss:.6f} (-{self._risk.cfg.stop_loss_pct * 100:.1f}%)
Take-Profit: ${size.take_profit:.6f} (+{self._risk.cfg.take_profit_pct * 100:.1f}%)
Position Size: ${size.notional:.2f} ({self._risk.cfg.max_position_pct * 100:.0f}% of portfolio)
Risk/Reward: 1:{self._risk.cfg.take_profit_pct / self._risk.cfg.stop_loss_pct:.1f}"""

    # ── Status ────────────────────────────────────────────────────────────────

    async def get_status(self) -> dict:
        current_prices = {}
        try:
            current_prices = await self._market_data.get_multi_pair_prices(self._cfg.pairs)
        except Exception:
            pass
        summary = self._paper.get_portfolio_summary(current_prices)
        stats = await self._db.get_trade_stats()
        now = datetime.now(timezone.utc)
        return {
            "running": self._running,
            "mode": self._cfg.mode,
            "halted_reason": self._halted_reason,
            "pairs": self._cfg.pairs,
            "tick_count": self._tick_count,
            "uptime_seconds": int((now - self._started_at).total_seconds()) if self._started_at else 0,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "last_tick": self._last_tick.isoformat() if self._last_tick else None,
            "next_tick": self._next_tick.isoformat() if self._next_tick else None,
            "portfolio": summary,
            "stats": stats,
            "current_prices": current_prices,
        }
