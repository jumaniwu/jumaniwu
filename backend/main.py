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

        # Log entries — every 2-5 ticks randomly
        log_counter += 1
        log_entry = None
        if log_counter >= 3:
            log_entry = generate_log_entry()
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    global clients, executor
    clients  = await ClientFactory.create(cfg)
    executor = ExecutionManager(cfg, clients)
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
    return {
        "status":       "ok",
        "mode":         TRADING_MODE_STR,
        "clients":      len(connected_clients),
        "btc_price":    round(btc_sim.price, 2),
        "eth_price":    round(eth_sim.price, 2),
        **({"paper_fills": paper_fills} if paper_fills is not None else {}),
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
