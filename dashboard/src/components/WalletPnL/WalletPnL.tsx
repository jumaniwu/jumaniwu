"use client";

import { useTradingStore } from "@/store/tradingStore";

function Stat({ label, value, color = "white" }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    green: "text-term-green",
    red:   "text-term-red",
    yellow: "text-term-yellow",
    white: "text-term-white",
    cyan:  "text-term-cyan",
  };
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs text-term-muted tracking-widest uppercase">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${colorMap[color] ?? colorMap.white}`}>{value}</span>
    </div>
  );
}

export default function WalletPnL() {
  const wallet = useTradingStore((s) => s.wallet);

  const pnl      = wallet?.total_pnl ?? 0;
  const winRate  = wallet?.win_rate  ?? 0;
  const wins     = wallet?.wins      ?? 0;
  const losses   = wallet?.losses    ?? 0;
  const drawdown = wallet?.drawdown  ?? 0;

  const pnlStr   = (pnl >= 0 ? "+" : "") + pnl.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const pnlColor = pnl >= 0 ? "green" : "red";

  return (
    <div className="h-full flex flex-col p-2 gap-2">
      <div className="panel-header">
        <span>WALLET &amp; PNL</span>
        <span className="text-term-green text-2xs">●</span>
      </div>

      {/* Giant PNL */}
      <div className="flex-none flex flex-col px-1">
        <span className="text-2xs text-term-muted tracking-widest uppercase">All-Time PNL</span>
        <span className={`text-xl font-bold tabular-nums leading-tight ${pnl >= 0 ? "num-pos-glow" : "num-neg-glow"}`}>
          ${pnlStr}
        </span>
      </div>

      <div className="border-t border-term-border my-0.5" />

      {/* Stats grid */}
      <div className="flex flex-col gap-2 px-1">
        <Stat label="Win Rate"  value={`${winRate}%`}    color={winRate > 60 ? "green" : winRate > 45 ? "yellow" : "red"} />
        <Stat label="Fills W/L" value={`${wins} / ${losses}`} color="white" />
        <Stat label="Drawdown"  value={`${drawdown}%`}   color={drawdown < 5 ? "green" : drawdown < 10 ? "yellow" : "red"} />
        <Stat label="Ratio"     value={losses > 0 ? (wins / losses).toFixed(2) : "∞"} color="cyan" />
      </div>

      <div className="mt-auto px-1">
        <div className="text-2xs text-term-muted">
          <span className="text-term-green">▐</span>
          <span className="ml-1">BYBIT × POLYMARKET</span>
        </div>
        <div className="text-2xs text-term-muted tracking-wider">
          <span className="text-term-cyan">▐</span>
          <span className="ml-1">ARB ENGINE v2.4.1</span>
        </div>
      </div>
    </div>
  );
}
