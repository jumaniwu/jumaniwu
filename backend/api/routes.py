"""REST API routes for the trading agent."""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory backtest job store
_backtest_jobs: dict[str, dict] = {}


# ── Pydantic Models ──────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    mode: Literal["paper", "live"] = "paper"


class ConfigPatch(BaseModel):
    pairs: list[str] | None = None
    loop_interval_minutes: int | None = None
    max_concurrent_positions: int | None = None
    max_position_pct: float | None = None
    stop_loss_pct: float | None = None
    take_profit_pct: float | None = None
    daily_loss_limit_pct: float | None = None


class BacktestRequest(BaseModel):
    pairs: list[str] = ["BTC/USDT"]
    start_date: str = "2025-01-01"
    end_date: str = "2025-12-31"
    initial_balance: float = 10000.0
    timeframe: str = "1h"


# ── Agent Control ────────────────────────────────────────────────────────────

@router.get("/status")
async def get_status(request: Request) -> dict:
    agent = request.app.state.agent
    return await agent.get_status()


@router.post("/start")
async def start_agent(body: StartRequest, request: Request) -> dict:
    agent = request.app.state.agent
    if agent._running:
        return {"status": "already_running", "mode": agent._cfg.mode}
    await agent.start(mode=body.mode)
    return {"status": "started", "mode": body.mode}


@router.post("/stop")
async def stop_agent(request: Request) -> dict:
    agent = request.app.state.agent
    if not agent._running:
        return {"status": "already_stopped"}
    await agent.stop()
    return {"status": "stopped"}


# ── Positions & Trades ───────────────────────────────────────────────────────

@router.get("/positions")
async def get_positions(request: Request) -> list:
    db = request.app.state.db
    agent = request.app.state.agent
    try:
        prices = await request.app.state.market_data.get_multi_pair_prices(
            request.app.state.config.agent.pairs
        )
    except Exception:
        prices = {}
    return agent._paper.get_positions_snapshot(prices)


@router.get("/trades")
async def get_trades(
    request: Request,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list:
    db = request.app.state.db
    return await db.get_trades(limit=limit, offset=offset)


@router.get("/decisions")
async def get_decisions(
    request: Request,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list:
    db = request.app.state.db
    return await db.get_decisions(limit=limit)


@router.get("/performance")
async def get_performance(request: Request) -> dict:
    db = request.app.state.db
    snapshots = await db.get_performance_snapshots(limit=30)
    stats = await db.get_trade_stats()
    return {"snapshots": snapshots, "stats": stats}


# ── Configuration ────────────────────────────────────────────────────────────

@router.get("/config")
async def get_config(request: Request) -> dict:
    cfg = request.app.state.config
    return {
        "agent": {
            "mode": cfg.agent.mode,
            "pairs": cfg.agent.pairs,
            "loop_interval_minutes": cfg.agent.loop_interval_minutes,
            "max_concurrent_positions": cfg.agent.max_concurrent_positions,
        },
        "risk": {
            "max_position_pct": cfg.risk.max_position_pct,
            "stop_loss_pct": cfg.risk.stop_loss_pct,
            "take_profit_pct": cfg.risk.take_profit_pct,
            "daily_loss_limit_pct": cfg.risk.daily_loss_limit_pct,
        },
        "paper": {
            "initial_balance": cfg.paper.initial_balance,
            "fee_rate": cfg.paper.fee_rate,
        },
        "exchange": {
            "id": cfg.exchange.id,
            "sandbox": cfg.exchange.sandbox,
        },
        "ai": {
            "model": cfg.ai.model,
        },
    }


@router.patch("/config")
async def patch_config(body: ConfigPatch, request: Request) -> dict:
    cfg = request.app.state.config
    agent = request.app.state.agent
    risk = request.app.state.risk_manager

    if body.pairs is not None:
        cfg.agent.pairs = body.pairs
        agent._cfg.pairs = body.pairs
    if body.loop_interval_minutes is not None:
        cfg.agent.loop_interval_minutes = body.loop_interval_minutes
        agent._cfg.loop_interval_minutes = body.loop_interval_minutes
    if body.max_concurrent_positions is not None:
        cfg.agent.max_concurrent_positions = body.max_concurrent_positions
        agent._cfg.max_concurrent_positions = body.max_concurrent_positions
        risk.cfg.max_concurrent_positions = body.max_concurrent_positions
    if body.max_position_pct is not None:
        risk.cfg.max_position_pct = body.max_position_pct
    if body.stop_loss_pct is not None:
        risk.cfg.stop_loss_pct = body.stop_loss_pct
    if body.take_profit_pct is not None:
        risk.cfg.take_profit_pct = body.take_profit_pct
    if body.daily_loss_limit_pct is not None:
        risk.cfg.daily_loss_limit_pct = body.daily_loss_limit_pct

    return {"status": "updated"}


# ── Backtest ─────────────────────────────────────────────────────────────────

@router.post("/backtest")
async def run_backtest(body: BacktestRequest, request: Request) -> dict:
    job_id = str(uuid.uuid4())
    _backtest_jobs[job_id] = {"status": "running", "created_at": datetime.utcnow().isoformat()}

    backtester = request.app.state.backtester
    market_data = request.app.state.market_data

    async def run():
        try:
            results = []
            for pair in body.pairs:
                ohlcv = await market_data.get_ohlcv(pair, body.timeframe, limit=1000, use_cache=False)
                result = backtester.run(ohlcv, pair, body.initial_balance)
                results.append(result)
            _backtest_jobs[job_id] = {
                "status": "completed",
                "results": results,
                "completed_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            _backtest_jobs[job_id] = {"status": "failed", "error": str(e)}

    asyncio.create_task(run())
    return {"job_id": job_id, "status": "running"}


@router.get("/backtest/{job_id}")
async def get_backtest_result(job_id: str) -> dict:
    job = _backtest_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Backtest job not found")
    return job
