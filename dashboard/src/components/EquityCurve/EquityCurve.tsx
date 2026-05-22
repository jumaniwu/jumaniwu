"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, LineData } from "lightweight-charts";
import { useTradingStore } from "@/store/tradingStore";

export default function EquityCurve() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Area"> | null>(null);

  const equityCurve = useTradingStore((s) => s.wallet?.equity_curve ?? []);
  const totalPnl    = useTradingStore((s) => s.wallet?.total_pnl ?? 0);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout:    { background: { color: "#111211" }, textColor: "#6B6B6B" },
      grid:      { vertLines: { color: "#1a1a1a" }, horzLines: { color: "#1a1a1a" } },
      rightPriceScale: { borderColor: "#2a2a2a" },
      timeScale:       { borderColor: "#2a2a2a", timeVisible: true },
      handleScroll: false,
      handleScale:  false,
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addAreaSeries({
      lineColor:       "#00FF41",
      topColor:        "rgba(0,255,65,0.15)",
      bottomColor:     "rgba(0,255,65,0.0)",
      lineWidth:       2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius:  3,
      crosshairMarkerBorderColor: "#00FF41",
      crosshairMarkerBackgroundColor: "#00FF41",
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || equityCurve.length === 0) return;
    const data: LineData[] = equityCurve.map((p) => ({
      time:  p.time as UTCTimestamp,
      value: p.value,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [equityCurve]);

  return (
    <div className="h-full flex flex-col">
      <div className="panel-header">
        <span>EQUITY CURVE</span>
        <span className={`tabular-nums text-2xs font-bold ${totalPnl >= 0 ? "text-term-green" : "text-term-red"}`}>
          ${(10000 + totalPnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 lc-container" />
    </div>
  );
}
