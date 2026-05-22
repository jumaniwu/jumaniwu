"use client";

import { useTradingStore } from "@/store/tradingStore";
import { useFlash, flashClass } from "@/lib/useFlash";

function StatRow({
  label,
  value,
  color,
  mono = true,
}: {
  label: string;
  value: string;
  color: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-1 py-[3px] border-b border-term-border/50 last:border-0">
      <span className="text-2xs text-term-muted tracking-wider uppercase flex-none">{label}</span>
      <span className={`text-2xs font-semibold ${mono ? "tabular-nums" : ""} ${color}`}>{value}</span>
    </div>
  );
}

function RiskBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped < 5  ? "#00FF41" :
    clamped < 12 ? "#FFD200" :
    clamped < 20 ? "#FF8C00" : "#FF2B4A";
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-3xs text-term-muted">
        <span>DRAWDOWN RISK</span>
        <span style={{ color }}>{clamped.toFixed(2)}%</span>
      </div>
      <div className="risk-bar-track">
        <div
          className="risk-bar-fill"
          style={{ width: `${clamped}%`, background: color, boxShadow: `0 0 4px ${color}60` }}
        />
      </div>
    </div>
  );
}

export default function WalletPnL() {
  const wallet = useTradingStore((s) => s.wallet);

  const pnl      = wallet?.total_pnl  ?? 0;
  const winRate  = wallet?.win_rate   ?? 0;
  const wins     = wallet?.wins       ?? 0;
  const losses   = wallet?.losses     ?? 0;
  const drawdown = wallet?.drawdown   ?? 0;
  const ratio    = losses > 0 ? (wins / losses).toFixed(2) : "∞";

  const flash    = useFlash(pnl);
  const pnlStr   = (pnl >= 0 ? "+" : "") + pnl.toLocaleString("en-US", { minimumFractionDigits: 2 });

  const winColor =
    winRate > 65 ? "text-term-green" :
    winRate > 50 ? "text-term-yellow" : "text-term-red";

  return (
    <>
      {/* Header */}
      <div className="ph">
        <span>WALLET &amp; PNL</span>
        <span className="text-term-green" style={{ textShadow: "0 0 6px rgba(0,255,65,0.5)" }}>●</span>
      </div>

      {/* Giant PNL */}
      <div
        className={`px-2 py-2 border-b border-term-border ${flashClass(flash)}`}
        style={{ transition: "background 0s" }}
      >
        <div className="text-3xs text-term-muted tracking-widest uppercase mb-0.5">All-Time PNL</div>
        <div className={`text-xl font-bold leading-none ${pnl >= 0 ? "n-pos-glow" : "n-neg-glow"}`}>
          ${pnlStr}
        </div>
        <div className="text-3xs text-term-muted mt-1">
          PORTFOLIO&nbsp;
          <span className="text-term-white tabular-nums">
            ${(10000 + pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-1 px-2 py-1.5 flex flex-col gap-0 overflow-hidden">
        <StatRow label="Win Rate"  value={`${winRate}%`}         color={winColor} />
        <StatRow label="Fills W"   value={String(wins)}          color="text-term-green" />
        <StatRow label="Fills L"   value={String(losses)}        color="text-term-red" />
        <StatRow label="W/L Ratio" value={ratio}                 color="text-term-cyan" />
        <StatRow label="Total"     value={String(wins + losses)} color="text-term-white" />
      </div>

      {/* Risk bar */}
      <div className="px-2 py-2 border-t border-term-border">
        <RiskBar pct={drawdown} />
      </div>

      {/* Footer */}
      <div className="pf">
        <span>BYBIT × POLYMARKET</span>
        <span className="text-term-cyan">v2.4.1</span>
      </div>
    </>
  );
}
