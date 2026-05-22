"use client";

import { useTradingStore } from "@/store/tradingStore";
import type { PolyPosition } from "@/types";

function Row({ pos }: { pos: PolyPosition }) {
  const pnl      = pos.unrealized_pnl;
  const pnlColor = pnl >= 0 ? "text-term-green" : "text-term-red";
  const pnlStr   = (pnl >= 0 ? "+" : "") + pnl.toLocaleString("en-US", { minimumFractionDigits: 2 });

  return (
    <tr className="border-b border-term-border hover:bg-white/[0.02] transition-colors animate-fade-in-row">
      <td className="px-1.5 py-0.5">
        <div className="text-2xs text-term-white leading-tight">{pos.name}</div>
        <div className="text-2xs text-term-muted">{pos.id}</div>
      </td>
      <td className="px-1.5 py-0.5 text-center">
        <span className={`text-2xs font-bold ${pos.side === "YES" ? "text-term-green" : "text-term-red"}`}>
          {pos.side}
        </span>
      </td>
      <td className="px-1.5 py-0.5 text-right tabular-nums text-2xs text-term-cyan">
        {pos.current_price.toFixed(3)}
      </td>
      <td className="px-1.5 py-0.5 text-right tabular-nums text-2xs text-term-muted">
        {pos.size.toLocaleString()}
      </td>
      <td className={`px-1.5 py-0.5 text-right tabular-nums text-2xs font-semibold ${pnlColor}`}>
        {pnlStr}
      </td>
    </tr>
  );
}

export default function OpenPositions() {
  const positions = useTradingStore((s) => s.positions);
  const totalPnl  = positions.reduce((acc, p) => acc + p.unrealized_pnl, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="panel-header">
        <span>OPEN POSITIONS</span>
        <span className={`tabular-nums text-2xs font-bold ${totalPnl >= 0 ? "text-term-green" : "text-term-red"}`}>
          {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-term-panel z-10">
            <tr className="border-b border-term-border">
              {["CONTRACT", "SIDE", "PRICE", "SIZE", "UPNL"].map((h) => (
                <th key={h} className="px-1.5 py-0.5 text-left text-2xs text-term-muted tracking-wider font-normal">
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

      <div className="panel-header border-t border-b-0">
        <span className="text-term-muted">POLYMARKET CONTRACTS</span>
        <span className="text-term-cyan text-2xs">{positions.length} ACTIVE</span>
      </div>
    </div>
  );
}
