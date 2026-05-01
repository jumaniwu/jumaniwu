"""WebSocket broadcaster for real-time agent updates."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class WebSocketBroadcaster:
    def __init__(self):
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        logger.info("WebSocket client connected (total: %d)", len(self._connections))
        await self._send(ws, {"type": "connected", "data": {"clients": len(self._connections)}})

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)
        logger.info("WebSocket client disconnected (total: %d)", len(self._connections))

    async def broadcast(self, message: dict) -> None:
        if not self._connections:
            return
        payload = json.dumps({**message, "ts": datetime.now(timezone.utc).isoformat()})
        dead: set[WebSocket] = set()
        for ws in self._connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        self._connections -= dead

    async def _send(self, ws: WebSocket, message: dict) -> None:
        try:
            await ws.send_text(json.dumps({**message, "ts": datetime.now(timezone.utc).isoformat()}))
        except Exception as e:
            logger.warning("Failed to send WebSocket message: %s", e)

    @property
    def connection_count(self) -> int:
        return len(self._connections)


async def websocket_endpoint(ws: WebSocket, broadcaster: WebSocketBroadcaster) -> None:
    await broadcaster.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await ws.send_text(json.dumps({"type": "pong", "ts": datetime.now(timezone.utc).isoformat()}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        broadcaster.disconnect(ws)
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        broadcaster.disconnect(ws)
