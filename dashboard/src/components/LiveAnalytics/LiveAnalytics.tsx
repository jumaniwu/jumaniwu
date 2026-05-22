"use client";

import { useTradingStore } from "@/store/tradingStore";

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-2xs">
        <span className="text-term-muted">{label}</span>
        <span className={`tabular-nums ${color}`}>{value.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
      </div>
      <div className="h-1.5 bg-term-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width:      `${pct}%`,
            background: color.includes("green") ? "#00FF41" : color.includes("red") ? "#FF2B4A" : "#00E5FF",
            boxShadow:  color.includes("green") ? "0 0 4px rgba(0,255,65,0.4)" : undefined,
          }}
        />
      </div>
    </div>
  );
}

export default function LiveAnalytics() {
  const analytics = useTradingStore((s) => s.analytics);

  const roiByDay    = analytics?.roi_by_day ?? [];
  const volByHour   = analytics?.volume_by_hour ?? {};
  const total24h    = analytics?.total_volume_24h ?? 0;
  const avgRoi      = analytics?.avg_roi_daily ?? 0;

  const maxVol = Math.max(...Object.values(volByHour), 1);
  const maxRoi = Math.max(...roiByDay.map((d) => Math.abs(d.roi)), 1);

  // Show last 8 hours for volume bars
  const hourEntries = Object.entries(volByHour).slice(-8);
  // Show last 7 days for ROI
  const roiEntries  = roiByDay.slice(-7);

  return (
    <div className="h-full flex flex-col">
      <div className="panel-header">
        <span>LIVE ANALYTICS</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1.5 flex flex-col gap-3">

        {/* Volume */}
        <div className="flex flex-col gap-1">
          <div className="text-2xs text-term-muted tracking-widest uppercase border-b border-term-border pb-0.5">
            Volume (24h) — ${(total24h / 1_000_000).toFixed(2)}M
          </div>
          {hourEntries.map(([hour, vol]) => (
            <MiniBar
              key={hour}
              label={hour}
              value={Math.round(vol / 1000)}
              max={Math.round(maxVol / 1000)}
              color="text-term-cyan"
            />
          ))}
        </div>

        {/* ROI by day */}
        <div className="flex flex-col gap-1">
          <div className="text-2xs text-term-muted tracking-widest uppercase border-b border-term-border pb-0.5">
            Daily ROI — avg {avgRoi > 0 ? "+" : ""}{avgRoi.toFixed(2)}%
          </div>
          {roiEntries.map((d) => (
            <MiniBar
              key={d.day}
              label={d.day}
              value={d.roi}
              max={maxRoi}
              color={d.roi >= 0 ? "text-term-green" : "text-term-red"}
            />
          ))}
        </div>

      </div>

      <div className="panel-header border-t border-b-0">
        <span className="text-term-muted">METRICS</span>
        <span className={`text-2xs font-bold ${avgRoi >= 0 ? "text-term-green" : "text-term-red"}`}>
          ROI {avgRoi >= 0 ? "+" : ""}{avgRoi.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
