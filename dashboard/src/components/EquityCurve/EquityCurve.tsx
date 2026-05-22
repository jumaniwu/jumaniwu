"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  LineData,
} from "lightweight-charts";
import { useTradingStore } from "@/store/tradingStore";
import { useFlash, flashClass } from "@/lib/useFlash";

const BASELINE = 10_000; // initial portfolio value in USD

export default function EquityCurve() {
  const wrapRef    = useRef<HTMLDivElement>(null);
  const chartRef   = useRef<IChartApi | null>(null);
  const seriesRef  = useRef<ISeriesApi<"Baseline"> | null>(null);
  const initRef    = useRef(false);

  const equityCurve = useTradingStore((s) => s.wallet?.equity_curve ?? []);
  const totalPnl    = useTradingStore((s) => s.wallet?.total_pnl ?? 0);
  const drawdown    = useTradingStore((s) => s.wallet?.drawdown ?? 0);

  const portfolio = BASELINE + totalPnl;
  // Derive peak from drawdown: peak * (1 - dd/100) = current → peak = current/(1-dd/100)
  const peak = drawdown < 100
    ? portfolio / (1 - drawdown / 100)
    : portfolio;

  const flash = useFlash(totalPnl);

  // ── Chart init (once) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      layout:  { background: { color: "#111211" }, textColor: "#5A5A5A" },
      grid:    { vertLines: { color: "#171917" }, horzLines: { color: "#171917" } },
      crosshair: {
        mode: 1,
        vertLine: { color: "#2e302e", labelBackgroundColor: "#171917" },
        horzLine: { color: "#2e302e", labelBackgroundColor: "#171917" },
      },
      rightPriceScale: { borderColor: "#222322", textColor: "#5A5A5A" },
      timeScale:       { borderColor: "#222322", timeVisible: true },
      handleScroll: false,
      handleScale:  false,
      width:  wrapRef.current.clientWidth,
      height: wrapRef.current.clientHeight,
    });

    // BaselineSeries splits at BASELINE — green above, red below
    const series = chart.addBaselineSeries({
      baseValue:        { type: "price", price: BASELINE },
      topLineColor:     "#00FF41",
      topFillColor1:    "rgba(0,255,65,0.16)",
      topFillColor2:    "rgba(0,255,65,0.01)",
      bottomLineColor:  "#FF2B4A",
      bottomFillColor1: "rgba(255,43,74,0.01)",
      bottomFillColor2: "rgba(255,43,74,0.16)",
      lineWidth:        2,
      crosshairMarkerVisible:         true,
      crosshairMarkerRadius:          3,
      crosshairMarkerBorderColor:     "#00FF41",
      crosshairMarkerBackgroundColor: "#00FF41",
      priceLineVisible: true,
      priceLineColor:   "rgba(0,200,50,0.4)",
      priceLineWidth:   1,
      priceLineStyle:   2,  // dashed
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      chart.applyOptions({
        width:  wrapRef.current.clientWidth,
        height: wrapRef.current.clientHeight,
      });
    });
    ro.observe(wrapRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  // ── Data feed — setData on first load, update() after ─────────────────────
  useEffect(() => {
    if (!seriesRef.current || equityCurve.length === 0) return;

    const data: LineData[] = equityCurve.map((p) => ({
      time:  p.time as UTCTimestamp,
      value: p.value,
    }));

    if (!initRef.current) {
      seriesRef.current.setData(data);
      chartRef.current?.timeScale().scrollToRealTime();
      initRef.current = true;
    } else {
      // update() with the newest point only
      const last = data[data.length - 1];
      seriesRef.current.update(last);
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [equityCurve]);

  const pnlSign  = totalPnl >= 0 ? "+" : "";
  const pnlColor = totalPnl >= 0 ? "text-term-green" : "text-term-red";

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="ph">
        <span>EQUITY CURVE&nbsp;<span className="text-term-muted-2">·</span>&nbsp;ALL-TIME</span>
        <span className={`font-bold tabular-nums text-xs ${pnlColor}`}>
          ${portfolio.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* ── Chart + stats overlay ───────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <div ref={wrapRef} className="w-full h-full" />

        {/* Stats overlay — top-left, leaves price scale unobscured */}
        <div
          className={`absolute top-2 left-2 z-10 pointer-events-none flex flex-col gap-0.5 ${flashClass(flash)}`}
          style={{ background: "rgba(11,13,11,0.78)", padding: "4px 6px", borderRadius: 1 }}
        >
          <div className="text-3xs text-term-muted tracking-widest">PORTFOLIO</div>
          <div className={`text-sm font-bold tabular-nums ${totalPnl >= 0 ? "n-pos-glow" : "n-neg-glow"}`}>
            ${portfolio.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>

          <div className="h-px bg-term-border my-0.5" />

          <div className="flex gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-3xs text-term-muted">ALL-TIME PNL</span>
              <span className={`text-2xs font-semibold tabular-nums ${pnlColor}`}>
                {pnlSign}{totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-3xs text-term-muted">PEAK</span>
              <span className="text-2xs font-semibold tabular-nums text-term-cyan">
                ${peak.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-3xs text-term-muted">DRAWDOWN</span>
              <span className={`text-2xs font-semibold tabular-nums ${drawdown > 10 ? "text-term-red" : drawdown > 5 ? "text-term-yellow" : "text-term-green"}`}>
                {drawdown.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Baseline label */}
        <div
          className="absolute pointer-events-none z-10 text-3xs text-term-muted-2 tabular-nums"
          style={{ bottom: 20, left: 6 }}
        >
          BASE ${BASELINE.toLocaleString()}
        </div>
      </div>
    </>
  );
}
