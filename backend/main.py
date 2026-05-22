"""
HFT Trading Dashboard — FastAPI WebSocket Mock Server
Broadcasts synthetic high-frequency trading data to all connected clients.

Run with:
    TRADING_MODE=PAPER uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    TRADING_MODE=LIVE  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import Config
from client_factory import ClientFactory, TradingClients
from execution_manager import ExecutionManager
from risk_manager import RiskManager
from strategy_engine import StrategyEngine
from mock_data import (
    PriceSimulator,
    PolymarketSimulator,
    HedgeScannerSimulator,
    StateMachineSimulator,
    WalletSimulator,
    AnalyticsSimulator,
    generate_log_entry,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Load trading mode config at startup ───────────────────────────────────────
cfg = Config.from_env()
TRADING_MODE_STR = cfg.mode.value  # "PAPER" | "LIVE" — embedded in every WS message

# ── Global simulators (shared state across ticks) ─────────────────────────────
btc_sim = PriceSimulator("BTC/USDT", start=67_420.0, sigma=0.0014)
eth_sim = PriceSimulator("ETH/USDT", start=3_512.0,  sigma=0.0016)
poly_sim = PolymarketSimulator()
hedge_sim = HedgeScannerSimulator()
state_sim = StateMachineSimulator()
wallet_sim = WalletSimulator()
analytics_sim = AnalyticsSimulator()

# ── Connection registry ───────────────────────────────────────────────────────
connected_clients: Set[WebSocket] = set()

async def broadcast(payload: dict) -> None:
    dead: Set[WebSocket] = set()
    msg = json.dumps(payload)
    for ws in connected_clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


# ── Background tick loop ──────────────────────────────────────────────────────
async def tick_loop() -> None:
    """Main HFT data emission loop — ~10 ticks/sec."""
    tick_n = 0
    log_counter = 0

    while True:
        tick_n += 1
        now_ms = int(time.time() * 1000)

        # Price ticks — every tick
        btc = btc_sim.tick()
        eth = eth_sim.tick()

        # Polymarket positions — every tick
        poly_positions = poly_sim.tick()

        # Hedge scanner — every tick
        hedge = hedge_sim.tick(btc["price"])

        # State machine — every tick
        state = state_sim.tick()

        # Wallet & equity — every 3 ticks
        wallet = None
        if tick_n % 3 == 0:
            wallet = wallet_sim.tick(poly_positions)

        # Analytics — every 20 ticks
        analytics = None
        if tick_n % 20 == 0:
            analytics = analytics_sim.tick()

        # Strategy signal — evaluated every tick against current hedge data
        strategy_log = None
        if strategy and hedge:
            wallet_dd  = wallet_sim.drawdown if hasattr(wallet_sim, "drawdown") else 0.0
            upnl_total = sum(p.get("unrealized_pnl", 0.0) for p in poly_positions)
            result = await strategy.on_tick(
                hedge,
                wallet_drawdown=wallet_dd,
                unrealised_pnl=upnl_total,
            )
            if result and not result.vetoed:
                strategy_log = {
                    "timestamp": time.strftime("%H:%M:%S"),
                    "tag":       f"{result.signal.signal[:3]}",
                    "label":     f"±{result.signal.spread_pct:.2f}%",
                    "message":   (
                        f"BYB {result.bybit_fill.side}@{result.bybit_fill.fill_price:.2f}  "
                        f"POLY {result.poly_fill.side}@{result.poly_fill.fill_price:.4f}  "
                        f"[{result.elapsed_ms:.1f}ms]"
                    ),
                    "color": "green" if result.signal.signal == "ARBIT" else "cyan",
                }
            elif result and result.vetoed:
                # Occasionally surface veto reasons as warnings (1-in-5 chance)
                if tick_n % 5 == 0:
                    strategy_log = {
                        "timestamp": time.strftime("%H:%M:%S"),
                        "tag":       "RISK",
                        "label":     "VETO",
                        "message":   result.veto_reason or "risk check failed",
                        "color":     "orange",
                    }

        # Simulated log entries — every 3 ticks when no strategy log fires
        log_counter += 1
        log_entry = strategy_log
        if log_entry is None and log_counter >= 3:
            log_entry = generate_log_entry()
            log_counter = 0
        elif log_entry is not None:
            log_counter = 0

        # Ping latency simulation
        ping_ms = round(0.8 + (tick_n % 7) * 0.3, 2)

        payload: dict = {
            "ts": now_ms,
            "ping_ms": ping_ms,
            "mode": TRADING_MODE_STR,
            "btc": btc,
            "eth": eth,
            "positions": poly_positions,
            "hedge": hedge,
            "state_machine": state,
        }
        if wallet:
            payload["wallet"] = wallet
        if analytics:
            payload["analytics"] = analytics
        if log_entry:
            payload["log"] = log_entry

        if connected_clients:
            await broadcast(payload)

        await asyncio.sleep(0.1)  # 10 Hz


# ── App lifecycle ─────────────────────────────────────────────────────────────

# These are populated during lifespan startup
clients:  TradingClients | None = None
executor: ExecutionManager | None = None
risk:     RiskManager | None = None
strategy: StrategyEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global clients, executor, risk, strategy
    clients  = await ClientFactory.create(cfg)
    executor = ExecutionManager(cfg, clients)
    risk     = RiskManager()
    strategy = StrategyEngine(executor, risk, symbol="BTCUSDT")
    task = asyncio.create_task(tick_loop())
    log.info("HFT tick loop started — mode=%s", TRADING_MODE_STR)
    yield
    task.cancel()
    log.info("HFT tick loop stopped")


app = FastAPI(title="HFT Mock Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST health endpoint ──────────────────────────────────────────────────────
@app.get("/health")
async def health():
    paper_fills = len(executor.get_paper_fills()) if executor and cfg.is_paper else None
    circuit_open = risk.state.circuit_open if risk else False
    return {
        "status":        "ok",
        "mode":          TRADING_MODE_STR,
        "clients":       len(connected_clients),
        "btc_price":     round(btc_sim.price, 2),
        "eth_price":     round(eth_sim.price, 2),
        "circuit_open":  circuit_open,
        **({"paper_fills": paper_fills} if paper_fills is not None else {}),
    }


@app.get("/risk")
async def get_risk():
    if not risk:
        return {"error": "risk manager not initialised"}
    s = risk.state
    return {
        "mode":             TRADING_MODE_STR,
        "circuit_open":     s.circuit_open,
        "daily_loss":       round(s.daily_loss, 4),
        "open_order_count": s.open_order_count,
        "symbol_notional":  {k: round(v, 4) for k, v in s.symbol_notional.items()},
        "limits": {
            "max_drawdown_pct":    15.0,
            "max_open_orders":     10,
            "cooldown_seconds":    5.0,
            "max_symbol_notional": 300.0,
            "max_daily_loss":      250.0,
        },
    }


@app.get("/orders")
async def get_orders():
    if not executor:
        return {"orders": []}
    orders = executor.get_all_orders()
    return {
        "mode":   TRADING_MODE_STR,
        "count":  len(orders),
        "orders": [
            {
                "order_id":   o.order_id,
                "exchange":   o.exchange,
                "symbol":     o.symbol,
                "side":       o.side,
                "qty":        o.qty,
                "price":      o.price,
                "status":     o.status,
                "fill_price": o.fill_price,
            }
            for o in orders
        ],
    }


# ── WebSocket endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.add(ws)
    client_addr = ws.client.host if ws.client else "unknown"
    log.info(f"Client connected: {client_addr} | total={len(connected_clients)}")

    # Send current equity curve immediately on connect so chart isn't empty
    init_payload = {
        "ts": int(time.time() * 1000),
        "type": "init",
        "mode": TRADING_MODE_STR,
        "wallet": wallet_sim.tick(poly_sim.tick()),
        "analytics": analytics_sim.tick(),
    }
    await ws.send_text(json.dumps(init_payload))

    try:
        while True:
            # Keep connection alive; data is pushed from tick_loop
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        connected_clients.discard(ws)
        log.info(f"Client disconnected: {client_addr} | total={len(connected_clients)}")
    except Exception as e:
        connected_clients.discard(ws)
        log.warning(f"Client error ({client_addr}): {e}")
