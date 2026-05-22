"use client";

/**
 * Central Zustand store for all HFT dashboard state.
 * subscribeWithSelector middleware lets components subscribe to fine-grained
 * slices — only the subscribing component re-renders, not the whole tree.
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
  TradingMode,
} from "@/types";

const MAX_LOG_ENTRIES  = 200;
const MAX_CANDLES      = 500;
const MAX_PRICE_HIST   = 30;   // sparkline history depth per position

// ── State shape ───────────────────────────────────────────────────────────────

interface TradingState {
  // Connection
  connected:   boolean;
  pingMs:      number;
  lastTs:      number;
  tradingMode: TradingMode;

  // Prices
  btc:        PriceTick | null;
  eth:        PriceTick | null;
  btcCandles: Candle[];
  ethCandles: Candle[];

  // Positions + per-position price history for sparklines
  positions:       PolyPosition[];
  positionHistory: Record<string, number[]>;

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
    connected:   false,
    pingMs:      0,
    lastTs:      0,
    tradingMode: "PAPER" as TradingMode,

    btc: null,
    eth: null,
    btcCandles: [],
    ethCandles: [],

    positions:       [],
    positionHistory: {},

    hedge: null,

    stateMachine: {
      current_node:    "tick_feed",
      completed_nodes: [],
      node_entry_ts:   Date.now() / 1000,
      visit_counts:    { tick_feed: 1 },
      ticks_in_state:  0,
    },

    wallet:    null,
    analytics: null,
    logs:      [],

    setConnected: (v) => set({ connected: v }),

    applyTick: (payload) =>
      set((state) => {
        const next: Partial<TradingState> = { lastTs: payload.ts };

        if (payload.ping_ms !== undefined) next.pingMs = payload.ping_ms;
        if (payload.mode !== undefined)    next.tradingMode = payload.mode;

        // ── BTC candles ──────────────────────────────────────────────────
        if (payload.btc) {
          next.btc = payload.btc;
          if (payload.btc.candle) {
            const candles = [...state.btcCandles];
            const last    = candles[candles.length - 1];
            if (last && last.time === payload.btc.candle.time) {
              candles[candles.length - 1] = payload.btc.candle;
            } else {
              candles.push(payload.btc.candle);
            }
            next.btcCandles = candles.slice(-MAX_CANDLES);
          }
        }

        // ── ETH candles ──────────────────────────────────────────────────
        if (payload.eth) {
          next.eth = payload.eth;
          if (payload.eth.candle) {
            const candles = [...state.ethCandles];
            const last    = candles[candles.length - 1];
            if (last && last.time === payload.eth.candle.time) {
              candles[candles.length - 1] = payload.eth.candle;
            } else {
              candles.push(payload.eth.candle);
            }
            next.ethCandles = candles.slice(-MAX_CANDLES);
          }
        }

        // ── Positions + sparkline history (same update, single re-render) ─
        if (payload.positions) {
          next.positions = payload.positions;
          const hist = { ...state.positionHistory };
          for (const p of payload.positions) {
            const arr = [...(hist[p.id] ?? []), p.current_price];
            hist[p.id] = arr.length > MAX_PRICE_HIST ? arr.slice(-MAX_PRICE_HIST) : arr;
          }
          next.positionHistory = hist;
        }

        if (payload.hedge)          next.hedge         = payload.hedge;
        if (payload.state_machine)  next.stateMachine  = payload.state_machine;
        if (payload.wallet)         next.wallet        = payload.wallet;
        if (payload.analytics)      next.analytics     = payload.analytics;

        if (payload.log) {
          next.logs = [payload.log, ...state.logs].slice(0, MAX_LOG_ENTRIES);
        }

        return next;
      }),
  }))
);
