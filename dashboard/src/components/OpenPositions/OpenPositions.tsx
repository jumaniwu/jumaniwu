"use client";

import { memo, useMemo } from "react";
import { useTradingStore } from "@/store/tradingStore";
import { useFlash, flashClass } from "@/lib/useFlash";
import type { PolyPosition } from "@/types";

// ── Micro sparkline ───────────────────────────────────────────────────────────

function MiniSparkline({ prices }: { prices: number[] }) {
  if (prices.length < 3) {
    return <td style={{ width: 46 }} />;
  }

  const W = 44, H = 14;
  const min   = Math.min(...prices);
  const max   = Math.max(...prices);
  const range = max - min || 1e-9;

  const pts = prices
    .map((p, i) => {
      const x = ((i / (prices.length - 1)) * W).toFixed(1);
      const y = (H - ((p - min) / range) * (H - 2) - 1).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");

  const isUp   = prices[prices.length - 1] >= prices[0];
  const stroke = isUp ? "#00FF41" : "#FF2B4A";
  const lastY  = (H - ((prices[prices.length - 1] - min) / range) * (H - 2) - 1).toFixed(1);

  return (
    <td className="px-1 py-0" style={{ width: 46 }}>
      <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.65" />
        <circle cx={W} cy={lastY} r="1.5" fill={stroke} opacity="0.9" />
      </svg>
    </td>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

const Row = memo(function Row({
  pos,
  history,
}: {
  pos:     PolyPosition;
  history: number[];
}) {
  const pnl   = pos.unrealized_pnl;
  const flash = useFlash(pnl);

  const pnlStr   = (pnl >= 0 ? "+" : "") + pnl.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const pnlColor = pnl >= 0 ? "text-term-green" : "text-term-red";

  const absVal = Math.abs(pnl);
  const glowPx = absVal > 300 ? 8 : absVal > 100 ? 4 : absVal > 30 ? 2 : 0;
  const glowRgb = pnl >= 0 ? "0,255,65" : "255,43,74";

  return (
    <tr
      className={`border-b border-term-border transition-colors ${flashClass(flash)}`}
      style={glowPx ? { boxShadow: `inset 2.5px 0 0 rgba(${glowRgb},0.55)` } : undefined}
    >
      {/* Contract name + ID */}
      <td className="px-1.5 py-1">
        <div className="text-2xs text-term-white leading-tight truncate max-w-[100px]">{pos.name}</div>
        <div className="text-3xs text-term-muted">{pos.id}</div>
      </td>

      {/* Side badge */}
      <td className="px-1 py-1 text-center">
        <span className={`badge ${pos.side === "YES" ? "badge-yes" : "badge-no"}`}>
          {pos.side}
        </span>
      </td>

      {/* Sparkline */}
      <MiniSparkline prices={history} />

      {/* Current price */}
      <td className="px-1.5 py-1 text-right tabular-nums text-2xs text-term-cyan">
        {pos.current_price.toFixed(3)}
      </td>

      {/* uPnL */}
      <td
        className={`px-1.5 py-1 text-right text-2xs font-semibold tabular-nums ${pnlColor}`}
        style={glowPx > 0 ? { textShadow: `0 0 ${glowPx}px rgba(${glowRgb},0.6)` } : undefined}
      >
        {pnlStr}
      </td>
    </tr>
  );
},
// Custom comparator — only re-render if price or PnL changed
(prev, next) =>
  prev.pos.current_price  === next.pos.current_price  &&
  prev.pos.unrealized_pnl === next.pos.unrealized_pnl &&
  prev.history.length     === next.history.length     &&
  prev.history[prev.history.length - 1] === next.history[next.history.length - 1]
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function OpenPositions() {
  const positions      = useTradingStore((s) => s.positions);
  const positionHistory = useTradingStore((s) => s.positionHistory);
  const totalFlash     = useFlash(positions.reduce((a, p) => a + p.unrealized_pnl, 0));

  // Sort by absolute uPnL descending — biggest movers at top
  const sorted = useMemo(
    () => [...positions].sort((a, b) => Math.abs(b.unrealized_pnl) - Math.abs(a.unrealized_pnl)),
    [positions],
  );

  const totalPnl      = positions.reduce((a, p) => a + p.unrealized_pnl, 0);
  const totalExposure = positions.reduce((a, p) => a + p.size, 0);
  const totalPnlStr   = (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(2);

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="ph">
        <span>OPEN POSITIONS</span>
        <span className={`tabular-nums font-bold text-xs ${totalPnl >= 0 ? "text-term-green" : "text-term-red"} ${flashClass(totalFlash)}`}>
          {totalPnlStr}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="pb">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: "#111211" }}>
            <tr className="border-b border-term-border">
              {[
                { label: "CONTRACT", cls: "text-left" },
                { label: "SIDE",     cls: "text-center" },
                { label: "TREND",    cls: "text-center" },
                { label: "PRICE",    cls: "text-right" },
                { label: "UPNL",     cls: "text-right" },
              ].map(({ label, cls }) => (
                <th key={label} className={`px-1.5 py-1 ${cls} text-3xs text-term-muted tracking-widest font-normal`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sorted.map((p) => (
              <Row
                key={p.id}
                pos={p}
                history={positionHistory[p.id] ?? []}
              />
            ))}
          </tbody>

          {/* ── Totals row ──────────────────────────────────────────────── */}
          <tfoot>
            <tr
              className="border-t-2 border-term-border-hi"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              <td className="px-1.5 py-1 text-3xs text-term-muted tracking-wider" colSpan={2}>
                TOTAL EXPOSURE
              </td>
              <td />
              <td className="px-1.5 py-1 text-right text-2xs text-term-muted tabular-nums">
                {totalExposure.toLocaleString()}
              </td>
              <td
                className={`px-1.5 py-1 text-right text-2xs font-bold tabular-nums ${totalPnl >= 0 ? "text-term-green" : "text-term-red"}`}
              >
                {totalPnlStr}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="pf">
        <span>POLYMARKET · SORTED BY |PNL|</span>
        <span className="text-term-cyan">{positions.length}&nbsp;ACTIVE</span>
      </div>
    </>
  );
}
