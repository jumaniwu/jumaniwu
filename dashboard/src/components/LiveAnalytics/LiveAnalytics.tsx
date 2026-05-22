"use client";

import { useTradingStore } from "@/store/tradingStore";

/* Sharp terminal-style bar — no border-radius, supports negative values */
function Bar({
  label,
  value,
  max,
  positive,
}: {
  label: string;
  value: number;
  max: number;
  positive: boolean;
}) {
  const pct    = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const color  = positive ? "#00FF41" : "#FF2B4A";
  const shadow = positive ? "0 0 4px rgba(0,255,65,0.35)" : "0 0 4px rgba(255,43,74,0.35)";

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-3xs text-term-muted w-[28px] flex-none text-right tabular-nums">{label}</span>
      <div className="flex-1 h-[7px] bg-term-bg relative overflow-hidden">
        <div
          style={{ width: `${pct}%`, height: "100%", background: color, boxShadow: shadow, transition: "width 0.3s linear" }}
        />
      </div>
      <span
        className="text-3xs tabular-nums w-[40px] flex-none text-right"
        style={{ color, textShadow: pct > 60 ? shadow : "none" }}
      >
        {positive
          ? (value / 1000).toFixed(0) + "K"
          : (value >= 0 ? "+" : "") + value.toFixed(1) + "%"}
      </span>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 mb-1 mt-0.5">
      <span className="text-3xs text-term-muted tracking-widest uppercase">{text}</span>
      <div className="flex-1 h-px bg-term-border" />
    </div>
  );
}

export default function LiveAnalytics() {
  const analytics = useTradingStore((s) => s.analytics);

  const roiByDay  = analytics?.roi_by_day    ?? [];
  const volByHour = analytics?.volume_by_hour ?? {};
  const total24h  = analytics?.total_volume_24h ?? 0;
  const avgRoi    = analytics?.avg_roi_daily   ?? 0;

  const maxVol = Math.max(...Object.values(volByHour), 1);
  const maxRoi = Math.max(...roiByDay.map((d) => Math.abs(d.roi)), 0.01);

  const hourEntries = Object.entries(volByHour).slice(-10);
  const roiEntries  = roiByDay.slice(-7);

  return (
    <>
      <div className="ph">
        <span>LIVE ANALYTICS</span>
        <span className={`font-bold tabular-nums text-3xs ${avgRoi >= 0 ? "text-term-green" : "text-term-red"}`}>
          ROI&nbsp;{avgRoi >= 0 ? "+" : ""}{avgRoi.toFixed(2)}%
        </span>
      </div>

      <div className="pb px-2 py-1.5 flex flex-col gap-0.5">

        {/* ── Volume ─────────────────────────────────────────────── */}
        <SectionLabel text={`VOL 24H — $${(total24h / 1_000_000).toFixed(1)}M`} />
        {hourEntries.map(([hour, vol]) => (
          <Bar key={hour} label={hour.slice(0, 5)} value={vol} max={maxVol} positive />
        ))}

        {/* ── ROI ────────────────────────────────────────────────── */}
        <SectionLabel text={`DAILY ROI — avg ${avgRoi >= 0 ? "+" : ""}${avgRoi.toFixed(2)}%`} />
        {roiEntries.map((d) => (
          <Bar key={d.day} label={d.day} value={d.roi} max={maxRoi} positive={d.roi >= 0} />
        ))}

      </div>

      <div className="pf">
        <span>METRICS</span>
        <span className="text-term-cyan tabular-nums text-3xs">
          {(total24h / 1_000_000).toFixed(2)}M&nbsp;VOL
        </span>
      </div>
    </>
  );
}
