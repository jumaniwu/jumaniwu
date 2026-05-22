"use client";

/**
 * Singleton WebSocket manager. Connects once, auto-reconnects on drop,
 * and pipes every message through the Zustand store's applyTick action.
 * Components never touch the socket directly.
 */

import { useTradingStore } from "@/store/tradingStore";
import type { WsPayload } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS  = 16_000;

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionallyClosed = false;

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempts, RECONNECT_MAX_MS);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

export function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  intentionallyClosed = false;

  const { setConnected, applyTick } = useTradingStore.getState();

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    reconnectAttempts = 0;
    setConnected(true);
    console.info("[WS] Connected to HFT server");
  };

  socket.onmessage = (ev: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(ev.data) as WsPayload;
      applyTick(payload);
    } catch {
      // malformed frame — ignore
    }
  };

  socket.onerror = () => {
    setConnected(false);
  };

  socket.onclose = () => {
    setConnected(false);
    if (!intentionallyClosed) {
      scheduleReconnect();
    }
  };
}

export function disconnect() {
  intentionallyClosed = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  socket?.close();
  socket = null;
}
