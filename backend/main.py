"""FastAPI entry point for the crypto trading AI agent."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from agent.risk_manager import RiskConfig, RiskManager
from agent.strategy import TechnicalAnalyzer
from agent.trading_agent import AgentConfig, TradingAgent
from api.routes import router as api_router
from api.websocket import WebSocketBroadcaster, websocket_endpoint
from backtester.backtester import Backtester
from data.database import Database
from data.market_data import MarketDataFetcher
from exchange.connector import ExchangeConnector
from exchange.paper_trader import PaperTrader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

load_dotenv()


# ── Config Dataclasses ───────────────────────────────────────────────────────

@dataclass
class ExchangeCfg:
    id: str = "binance"
    sandbox: bool = True


@dataclass
class PaperCfg:
    initial_balance: float = 10000.0
    fee_rate: float = 0.001


@dataclass
class DataCfg:
    ohlcv_timeframe: str = "1h"
    ohlcv_limit: int = 200
    cache_ttl_seconds: int = 60


@dataclass
class AICfg:
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 1024
    temperature: float = 0.0


@dataclass
class DatabaseCfg:
    path: str = "./data/trading.db"


@dataclass
class APICfg:
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = field(default_factory=lambda: ["*"])


@dataclass
class AgentCfg:
    enabled: bool = False
    mode: str = "paper"
    loop_interval_minutes: int = 5
    pairs: list[str] = field(default_factory=lambda: ["BTC/USDT", "ETH/USDT"])
    max_concurrent_positions: int = 3


@dataclass
class AppConfig:
    agent: AgentCfg = field(default_factory=AgentCfg)
    exchange: ExchangeCfg = field(default_factory=ExchangeCfg)
    paper: PaperCfg = field(default_factory=PaperCfg)
    data: DataCfg = field(default_factory=DataCfg)
    ai: AICfg = field(default_factory=AICfg)
    risk: RiskConfig = field(default_factory=RiskConfig)
    database: DatabaseCfg = field(default_factory=DatabaseCfg)
    api: APICfg = field(default_factory=APICfg)


def load_config() -> AppConfig:
    cfg_path = Path(__file__).parent / "config.yaml"
    raw: dict = {}
    if cfg_path.exists():
        with open(cfg_path) as f:
            raw = yaml.safe_load(f) or {}

    a = raw.get("agent", {})
    e = raw.get("exchange", {})
    p = raw.get("paper", {})
    d = raw.get("data", {})
    ai = raw.get("ai", {})
    r = raw.get("risk", {})
    db = raw.get("database", {})
    api = raw.get("api", {})

    return AppConfig(
        agent=AgentCfg(
            enabled=a.get("enabled", False),
            mode=os.getenv("AGENT_MODE", a.get("mode", "paper")),
            loop_interval_minutes=int(a.get("loop_interval_minutes", 5)),
            pairs=a.get("pairs", ["BTC/USDT", "ETH/USDT"]),
            max_concurrent_positions=int(a.get("max_concurrent_positions", 3)),
        ),
        exchange=ExchangeCfg(
            id=os.getenv("EXCHANGE_ID", e.get("id", "binance")),
            sandbox=os.getenv("EXCHANGE_SANDBOX", str(e.get("sandbox", "true"))).lower() == "true",
        ),
        paper=PaperCfg(
            initial_balance=float(p.get("initial_balance", 10000.0)),
            fee_rate=float(p.get("fee_rate", 0.001)),
        ),
        data=DataCfg(
            ohlcv_timeframe=d.get("ohlcv_timeframe", "1h"),
            ohlcv_limit=int(d.get("ohlcv_limit", 200)),
            cache_ttl_seconds=int(d.get("cache_ttl_seconds", 60)),
        ),
        ai=AICfg(
            model=ai.get("model", "claude-sonnet-4-6"),
            max_tokens=int(ai.get("max_tokens", 1024)),
            temperature=float(ai.get("temperature", 0.0)),
        ),
        risk=RiskConfig(
            max_position_pct=float(r.get("max_position_pct", 0.02)),
            stop_loss_pct=float(r.get("stop_loss_pct", 0.02)),
            take_profit_pct=float(r.get("take_profit_pct", 0.04)),
            daily_loss_limit_pct=float(r.get("daily_loss_limit_pct", 0.05)),
            max_concurrent_positions=int(a.get("max_concurrent_positions", 3)),
        ),
        database=DatabaseCfg(path=db.get("path", "./data/trading.db")),
        api=APICfg(
            host=api.get("host", "0.0.0.0"),
            port=int(api.get("port", 8000)),
            cors_origins=api.get("cors_origins", ["*"]),
        ),
    )


# ── Application Lifespan ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    config = load_config()
    logger.info("Starting CryptoAgent API (mode=%s, exchange=%s, sandbox=%s)",
                config.agent.mode, config.exchange.id, config.exchange.sandbox)

    # Database
    db = Database(config.database.path)
    await db.init()
    logger.info("Database initialized at %s", config.database.path)

    # Exchange connector
    connector = ExchangeConnector(
        exchange_id=config.exchange.id,
        api_key=os.getenv("EXCHANGE_API_KEY", ""),
        api_secret=os.getenv("EXCHANGE_API_SECRET", ""),
        sandbox=config.exchange.sandbox,
    )
    try:
        await connector.init()
    except Exception as e:
        logger.warning("Exchange connector failed to init: %s — running without live exchange", e)

    # Core components
    paper_trader = PaperTrader(config.paper.initial_balance, config.paper.fee_rate, db)
    market_data = MarketDataFetcher(connector, db, config.data.cache_ttl_seconds)
    analyzer = TechnicalAnalyzer()
    risk_manager = RiskManager(config.risk)
    broadcaster = WebSocketBroadcaster()
    backtester_inst = Backtester(analyzer, risk_manager)

    agent_cfg = AgentConfig(
        enabled=config.agent.enabled,
        mode=config.agent.mode,
        loop_interval_minutes=config.agent.loop_interval_minutes,
        pairs=config.agent.pairs,
        max_concurrent_positions=config.agent.max_concurrent_positions,
        ai_model=config.ai.model,
        ai_max_tokens=config.ai.max_tokens,
        ai_temperature=config.ai.temperature,
    )

    agent = TradingAgent(
        config=agent_cfg,
        db=db,
        market_data=market_data,
        analyzer=analyzer,
        risk_manager=risk_manager,
        paper_trader=paper_trader,
        connector=connector,
        broadcaster=broadcaster,
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
    )

    # Store everything in app.state for route access
    app.state.agent = agent
    app.state.db = db
    app.state.broadcaster = broadcaster
    app.state.config = config
    app.state.market_data = market_data
    app.state.risk_manager = risk_manager
    app.state.backtester = backtester_inst

    if config.agent.enabled:
        await agent.start()

    yield

    logger.info("Shutting down CryptoAgent API...")
    await agent.stop()
    await connector.close()
    await db.close()
    logger.info("Shutdown complete")


# ── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="CryptoAgent API",
    description="AI-powered crypto trading agent backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket_endpoint(websocket, app.state.broadcaster)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "CryptoAgent API"}


if __name__ == "__main__":
    import uvicorn
    cfg = load_config()
    uvicorn.run("main:app", host=cfg.api.host, port=cfg.api.port, reload=True)
