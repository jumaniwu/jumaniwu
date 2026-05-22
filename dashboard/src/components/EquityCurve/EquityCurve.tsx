"use client";

import { useEffect, useRef } from "react";
import {
  createChart, IChartApi, ISeriesApi,
  UTCTimestamp, LineData,
} from "lightweight-charts";
import { useTradingStore } from "@/store/tradingStore";

export default function EquityCurve() {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const chartRef  = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const equityCurve = useTradingStore((s) => s.wallet?.equity_curve ?? []);
  const totalPnl    = useTradingStore((s) => s.wallet?.total_pnl ?? 0);
  const portfolio   = 10000 + totalPnl;

  useEffect(() => {
    if (!wrapRef.current) return;
    const chart = createChart(wrapRef.current, {
      layout:    { background: { color: "#111211" }, textColor: "#5A5A5A" },
      grid:      { vertLines: { color: "#191A19" }, horzLines: { color: "#191A19" } },
      rightPriceScale: { borderColor: "#222322", textColor: "#5A5A5A" },
      timeScale:       { borderColor: "#222322", timeVisible: true },
      handleScroll: false, handleScale: false,
      width:  wrapRef.current.clientWidth,
      height: wrapRef.current.clientHeight,
    });

    const series = chart.addAreaSeries({
      lineColor:    "#00FF41",
      topColor:     "rgba(0,255,65,0.12)",
      bottomColor:  "rgba(0,255,65,0.0)",
      lineWidth:    2,
      crosshairMarkerVisible:         true,
      crosshairMarkerRadius:          3,
      crosshairMarkerBorderColor:     "#00FF41",
      crosshairMarkerBackgroundColor: "#00FF41",
      priceLineVisible:               true,
      priceLineColor:                 "#00C83260",
      priceLineWidth:                 1,
      priceLineStyle:                 2,
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      chart.applyOptions({ width: wrapRef.current.clientWidth, height: wrapRef.current.clientHeight });
    });
    ro.observe(wrapRef.current);
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
    <>
      <div className="ph">
        <span>EQUITY CURVE&nbsp;<span className="text-term-muted-2">·</span>&nbsp;ALL-TIME</span>
        <span className={`font-bold tabular-nums text-sm ${totalPnl >= 0 ? "n-pos-glow" : "n-neg-glow"}`}>
          ${portfolio.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div ref={wrapRef} className="lc-wrap" />
    </>
  );
}
