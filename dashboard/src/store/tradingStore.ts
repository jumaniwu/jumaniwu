"use client";

/**
 * Central Zustand store for all HFT dashboard state.
 * Each slice is updated independently so only subscribed components re-render.
 * This is the key to zero-lag 10 Hz tick handling.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  PriceTick,
  PolyPosition,
  HedgeData,
  StateMachineData,
  WalletData,
  AnalyticsData,
  LogEntry,
  Candle,
} from "@/types";

const MAX_LOG_ENTRIES = 200;
const MAX_CANDLES     = 500;

// ── State shape ───────────────────────────────────────────────────────────────

interface TradingState {
  // Connection
  connected: boolean;
  pingMs: number;
  lastTs: number;

  // Prices
  btc: PriceTick | null;
  eth: PriceTick | null;
  btcCandles: Candle[];
  ethCandles: Candle[];

  // Positions
  positions: PolyPosition[];

  // Hedge scanner
  hedge: HedgeData | null;

  // State machine
  stateMachine: StateMachineData;

  // Wallet
  wallet: WalletData | null;

  // Analytics
  analytics: AnalyticsData | null;

  // Logs
  logs: LogEntry[];

  // ── Actions ──────────────────────────────────────────────────────────────
  setConnected: (v: boolean) => void;
  applyTick: (payload: import("@/types").WsPayload) => void;
}

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector((set) => ({
    connected: false,
    pingMs: 0,
    lastTs: 0,

    btc: null,
    eth: null,
    btcCandles: [],
    ethCandles: [],

    positions: [],
    hedge: null,

    stateMachine: {
      current_node: "tick_feed",
      completed_nodes: [],
    },

    wallet: null,
    analytics: null,
    logs: [],

    setConnected: (v) => set({ connected: v }),

    applyTick: (payload) =>
      set((state) => {
        const next: Partial<TradingState> = {
          lastTs: payload.ts,
        };

        if (payload.ping_ms !== undefined) next.pingMs = payload.ping_ms;

        if (payload.btc) {
          next.btc = payload.btc;
          if (payload.btc.candle) {
            const candles = [...state.btcCandles];
            const last = candles[candles.length - 1];
            if (last && last.time === payload.btc.candle.time) {
              candles[candles.length - 1] = payload.btc.candle;
            } else {
              candles.push(payload.btc.candle);
            }
            next.btcCandles = candles.slice(-MAX_CANDLES);
          }
        }

        if (payload.eth) {
          next.eth = payload.eth;
          if (payload.eth.candle) {
            const candles = [...state.ethCandles];
            const last = candles[candles.length - 1];
            if (last && last.time === payload.eth.candle.time) {
              candles[candles.length - 1] = payload.eth.candle;
            } else {
              candles.push(payload.eth.candle);
            }
            next.ethCandles = candles.slice(-MAX_CANDLES);
          }
        }

        if (payload.positions) next.positions = payload.positions;
        if (payload.hedge) next.hedge = payload.hedge;
        if (payload.state_machine) next.stateMachine = payload.state_machine;
        if (payload.wallet) next.wallet = payload.wallet;
        if (payload.analytics) next.analytics = payload.analytics;

        if (payload.log) {
          const logs = [payload.log, ...state.logs].slice(0, MAX_LOG_ENTRIES);
          next.logs = logs;
        }

        return next;
      }),
  }))
);
