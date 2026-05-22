"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp } from "lightweight-charts";
import { useTradingStore } from "@/store/tradingStore";

const CHART_OPTIONS = {
  layout: {
    background: { color: "#111211" },
    textColor:  "#6B6B6B",
  },
  grid: {
    vertLines:  { color: "#1a1a1a" },
    horzLines:  { color: "#1a1a1a" },
  },
  crosshair: {
    mode: 1,
    vertLine: { color: "#2a2a2a", labelBackgroundColor: "#1a1a1a" },
    horzLine: { color: "#2a2a2a", labelBackgroundColor: "#1a1a1a" },
  },
  rightPriceScale: { borderColor: "#2a2a2a" },
  timeScale:       { borderColor: "#2a2a2a", timeVisible: true, secondsVisible: true },
  handleScroll: false,
  handleScale:  false,
} as const;

export default function LiveChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const btcCandles = useTradingStore((s) => s.btcCandles);
  const btcPrice   = useTradingStore((s) => s.btc?.price);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addCandlestickSeries({
      upColor:       "#00FF41",
      downColor:     "#FF2B4A",
      borderUpColor:   "#00FF41",
      borderDownColor: "#FF2B4A",
      wickUpColor:   "#00C832",
      wickDownColor: "#CC1F38",
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

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  // Feed candles
  useEffect(() => {
    if (!seriesRef.current || btcCandles.length === 0) return;
    const data = btcCandles.map((c) => ({
      time:  c.time as UTCTimestamp,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    })) as CandlestickData[];
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [btcCandles]);

  return (
    <div className="h-full flex flex-col">
      <div className="panel-header">
        <span>BTC/USDT — 5s CANDLES</span>
        <span className="text-term-white tabular-nums">
          {btcPrice ? `$${btcPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "---"}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 lc-container" />
    </div>
  );
}
