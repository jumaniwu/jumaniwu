// ── Raw WebSocket payload types ───────────────────────────────────────────────

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceTick {
  symbol: string;
  price: number;
  candle?: Candle;
}

export interface PolyPosition {
  id: string;
  name: string;
  side: "YES" | "NO";
  entry_price: number;
  size: number;
  current_price: number;
  unrealized_pnl: number;
}

export interface HedgeData {
  bybit_mid: number;
  poly_implied: number;
  spread: number;
  spread_pct: number;
  signal: "NEUTRAL" | "ARBIT" | "REVERSE_ARBIT";
  history: number[];
}

export interface StateMachineData {
  current_node: string;
  completed_nodes: string[];
  node_entry_ts: number;                  // unix timestamp (seconds) when current node was entered
  visit_counts: Record<string, number>;   // how many times each node has been visited
  ticks_in_state: number;                 // raw tick counter for current node
}

export interface EquityPoint {
  time: number;
  value: number;
}

export interface WalletData {
  total_pnl: number;
  win_rate: number;
  wins: number;
  losses: number;
  drawdown: number;
  equity_curve: EquityPoint[];
}

export interface AnalyticsData {
  volume_by_hour: Record<string, number>;
  roi_by_day: { day: string; roi: number }[];
  total_volume_24h: number;
  avg_roi_daily: number;
}

export interface LogEntry {
  timestamp: string;
  tag: string;
  label: string;
  message: string;
  color: "green" | "red" | "yellow" | "cyan" | "magenta" | "orange";
}

export type TradingMode = "PAPER" | "LIVE";

export interface WsPayload {
  ts: number;
  type?: string;
  ping_ms?: number;
  mode?: TradingMode;
  btc?: PriceTick;
  eth?: PriceTick;
  positions?: PolyPosition[];
  hedge?: HedgeData;
  state_machine?: StateMachineData;
  wallet?: WalletData;
  analytics?: AnalyticsData;
  log?: LogEntry;
}
