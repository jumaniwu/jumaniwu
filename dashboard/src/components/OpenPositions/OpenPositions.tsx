"use client";

import { useTradingStore } from "@/store/tradingStore";
import { useFlash, flashClass } from "@/lib/useFlash";
import type { PolyPosition } from "@/types";

function Row({ pos }: { pos: PolyPosition }) {
  const pnl   = pos.unrealized_pnl;
  const flash = useFlash(pnl);

  const pnlStr   = (pnl >= 0 ? "+" : "") + pnl.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const pnlColor = pnl >= 0 ? "text-term-green" : "text-term-red";

  // Intensity glow based on absolute PnL magnitude
  const absVal  = Math.abs(pnl);
  const glowPx  = absVal > 200 ? 6 : absVal > 50 ? 3 : 0;
  const glowClr = pnl >= 0 ? `rgba(0,255,65,0.5)` : `rgba(255,43,74,0.5)`;

  return (
    <tr
      className={`border-b border-term-border animate-fade-in-row transition-colors ${flashClass(flash)}`}
      style={glowPx ? { boxShadow: `inset 2px 0 0 ${glowClr}` } : undefined}
    >
      <td className="px-1.5 py-1">
        <div className="text-2xs text-term-white leading-tight">{pos.name}</div>
        <div className="text-3xs text-term-muted">{pos.id}</div>
      </td>
      <td className="px-1 py-1 text-center">
        <span className={`badge ${pos.side === "YES" ? "badge-yes" : "badge-no"}`}>
          {pos.side}
        </span>
      </td>
      <td className="px-1.5 py-1 text-right tabular-nums text-2xs text-term-cyan">
        {pos.current_price.toFixed(3)}
      </td>
      <td className="px-1.5 py-1 text-right tabular-nums text-2xs text-term-muted">
        {pos.size.toLocaleString()}
      </td>
      <td
        className={`px-1.5 py-1 text-right text-2xs font-semibold tabular-nums ${pnlColor}`}
        style={glowPx > 0 ? { textShadow: `0 0 ${glowPx}px ${glowClr}` } : undefined}
      >
        {pnlStr}
      </td>
    </tr>
  );
}

export default function OpenPositions() {
  const positions = useTradingStore((s) => s.positions);
  const totalPnl  = positions.reduce((acc, p) => acc + p.unrealized_pnl, 0);
  const totalFlash = useFlash(totalPnl);

  return (
    <>
      <div className="ph">
        <span>OPEN POSITIONS</span>
        <span className={`tabular-nums font-bold ${totalPnl >= 0 ? "text-term-green" : "text-term-red"} ${flashClass(totalFlash)}`}>
          {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
        </span>
      </div>

      <div className="pb">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: "#111211" }}>
            <tr className="border-b border-term-border">
              {["CONTRACT", "SIDE", "PRICE", "SIZE", "UPNL"].map((h) => (
                <th key={h} className="px-1.5 py-1 text-left text-3xs text-term-muted tracking-widest font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => <Row key={p.id} pos={p} />)}
          </tbody>
        </table>
      </div>

      <div className="pf">
        <span>POLYMARKET</span>
        <span className="text-term-cyan">{positions.length}&nbsp;ACTIVE</span>
      </div>
    </>
  );
}
