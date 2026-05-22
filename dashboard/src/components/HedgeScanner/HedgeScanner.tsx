"use client";

import { useTradingStore } from "@/store/tradingStore";

const SIGNAL_STYLE: Record<string, { color: string; label: string }> = {
  NEUTRAL:       { color: "text-term-muted",  label: "── NEUTRAL" },
  ARBIT:         { color: "text-term-green",   label: "▲ ARB OPPTY" },
  REVERSE_ARBIT: { color: "text-term-red",     label: "▼ REV-ARB" },
};

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-1.5 border-r border-b border-term-border last:border-r-0">
      <div className="text-3xs text-term-muted tracking-widest uppercase">{label}</div>
      <div className={`text-2xs font-bold tabular-nums mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

export default function HedgeScanner() {
  const hedge = useTradingStore((s) => s.hedge);

  const history = hedge?.history ?? [];
  const maxAbs  = Math.max(...history.map(Math.abs), 0.001);
  const sig     = SIGNAL_STYLE[hedge?.signal ?? "NEUTRAL"];

  return (
    <>
      <div className="ph">
        <span>HEDGE SCANNER</span>
        <span className={`font-bold ${sig.color}`}>{sig.label}</span>
      </div>

      {/* 2×2 stats grid */}
      <div className="grid grid-cols-2 border-b border-term-border flex-none">
        <StatCell
          label="BYBIT MID"
          value={hedge ? `$${hedge.bybit_mid.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "---"}
          color="text-term-white"
        />
        <StatCell
          label="POLY IMPLIED"
          value={hedge ? hedge.poly_implied.toFixed(4) : "---"}
          color="text-term-cyan"
        />
        <StatCell
          label="SPREAD $"
          value={hedge ? `$${hedge.spread.toFixed(2)}` : "---"}
          color={hedge && hedge.spread >= 0 ? "text-term-green" : "text-term-red"}
        />
        <StatCell
          label="SPREAD %"
          value={hedge ? `${hedge.spread_pct.toFixed(4)}%` : "---"}
          color={hedge && hedge.spread_pct >= 0 ? "text-term-green" : "text-term-red"}
        />
      </div>

      {/* Two-sided histogram centered on zero */}
      <div className="flex-1 min-h-0 flex flex-col px-2 pt-1.5 pb-1 gap-1">
        <div className="text-3xs text-term-muted tracking-widest uppercase">SPREAD HISTORY</div>

        <div className="hist-container">
          {history.map((v, i) => {
            const halfH = (Math.abs(v) / maxAbs) * 48; // max 48% of half-height
            const isPos = v >= 0;
            return (
              <div key={i} className="hist-bar-wrap">
                {isPos
                  ? <div className="hist-bar-pos" style={{ height: `${halfH}%` }} />
                  : <div className="hist-bar-neg" style={{ height: `${halfH}%` }} />
                }
              </div>
            );
          })}
          {/* Zero axis */}
          <div
            style={{
              position: "absolute",
              left: 0, right: 0,
              top: "50%",
              height: "1px",
              background: "#383838",
              zIndex: 2,
            }}
          />
        </div>

        {/* Min / max labels */}
        <div className="flex justify-between text-3xs text-term-muted tabular-nums">
          <span>{maxAbs > 0 ? `-${maxAbs.toFixed(3)}%` : "0"}</span>
          <span className="text-term-muted-2">ZERO</span>
          <span>{maxAbs > 0 ? `+${maxAbs.toFixed(3)}%` : "0"}</span>
        </div>
      </div>
    </>
  );
}
