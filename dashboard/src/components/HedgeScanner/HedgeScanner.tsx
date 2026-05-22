"use client";

import { useTradingStore } from "@/store/tradingStore";

const SIGNAL_COLORS: Record<string, string> = {
  NEUTRAL:       "text-term-muted",
  ARBIT:         "text-term-green",
  REVERSE_ARBIT: "text-term-red",
};

const SIGNAL_LABELS: Record<string, string> = {
  NEUTRAL:       "NEUTRAL",
  ARBIT:         "▲ ARB OPPTY",
  REVERSE_ARBIT: "▼ REV-ARB",
};

export default function HedgeScanner() {
  const hedge = useTradingStore((s) => s.hedge);

  const history  = hedge?.history ?? [];
  const maxAbs   = Math.max(...history.map(Math.abs), 0.01);

  return (
    <div className="h-full flex flex-col">
      <div className="panel-header">
        <span>HEDGE SCANNER</span>
        <span className={`text-2xs font-bold ${SIGNAL_COLORS[hedge?.signal ?? "NEUTRAL"]}`}>
          {SIGNAL_LABELS[hedge?.signal ?? "NEUTRAL"]}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-px border-b border-term-border">
        {[
          { label: "BYBIT MID",    value: hedge ? `$${hedge.bybit_mid.toLocaleString()}` : "---", color: "text-term-white" },
          { label: "POLY IMPLIED", value: hedge ? hedge.poly_implied.toFixed(4)          : "---", color: "text-term-cyan"  },
          { label: "SPREAD $",     value: hedge ? `$${hedge.spread.toFixed(2)}`          : "---", color: hedge && hedge.spread >= 0 ? "text-term-green" : "text-term-red" },
          { label: "SPREAD %",     value: hedge ? `${hedge.spread_pct.toFixed(4)}%`      : "---", color: hedge && hedge.spread_pct >= 0 ? "text-term-green" : "text-term-red" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-1.5 bg-term-bg/30">
            <div className="text-2xs text-term-muted tracking-wider">{label}</div>
            <div className={`text-xs tabular-nums font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Spread histogram */}
      <div className="flex-1 p-1.5 flex flex-col gap-1 overflow-hidden">
        <div className="text-2xs text-term-muted tracking-wider mb-1">SPREAD HISTORY</div>
        <div className="flex-1 flex items-end gap-px min-h-0">
          {history.map((v, i) => {
            const height = Math.round(Math.abs(v) / maxAbs * 100);
            const isPos  = v >= 0;
            return (
              <div
                key={i}
                className="flex-1 min-w-0 rounded-[1px] transition-all duration-100"
                style={{
                  height:     `${Math.max(2, height)}%`,
                  background: isPos ? "rgba(0,255,65,0.7)" : "rgba(255,43,74,0.7)",
                  boxShadow:  isPos ? "0 0 2px rgba(0,255,65,0.3)" : "0 0 2px rgba(255,43,74,0.3)",
                }}
              />
            );
          })}
        </div>
        {/* Zero line */}
        <div className="h-px bg-term-border w-full" />
      </div>
    </div>
  );
}
