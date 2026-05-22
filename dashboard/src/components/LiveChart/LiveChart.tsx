"use client";

import { useEffect, useRef } from "react";
import {
  createChart, IChartApi, ISeriesApi,
  CandlestickData, UTCTimestamp,
} from "lightweight-charts";
import { useTradingStore } from "@/store/tradingStore";
import { useFlash } from "@/lib/useFlash";

const CHART_OPT = {
  layout:  { background: { color: "#111211" }, textColor: "#5A5A5A" },
  grid:    { vertLines: { color: "#191A19" }, horzLines: { color: "#191A19" } },
  crosshair: {
    mode: 1,
    vertLine: { color: "#383838", labelBackgroundColor: "#1a1a1a" },
    horzLine: { color: "#383838", labelBackgroundColor: "#1a1a1a" },
  },
  rightPriceScale: { borderColor: "#222322", textColor: "#5A5A5A" },
  timeScale:       { borderColor: "#222322", timeVisible: true, secondsVisible: true, textColor: "#5A5A5A" },
  handleScroll: false,
  handleScale:  false,
} as const;

export default function LiveChart() {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const chartRef  = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const btcCandles = useTradingStore((s) => s.btcCandles);
  const btcPrice   = useTradingStore((s) => s.btc?.price ?? 0);
  const flash      = useFlash(btcPrice);

  const priceColor = flash === "green" ? "#00FF41" : flash === "red" ? "#FF2B4A" : "#E8E8E0";

  useEffect(() => {
    if (!wrapRef.current) return;
    const chart = createChart(wrapRef.current, {
      ...CHART_OPT,
      width:  wrapRef.current.clientWidth,
      height: wrapRef.current.clientHeight,
    });
    const series = chart.addCandlestickSeries({
      upColor:         "#00FF41", downColor:         "#FF2B4A",
      borderUpColor:   "#00FF41", borderDownColor:   "#FF2B4A",
      wickUpColor:     "#00C832", wickDownColor:     "#CC1F38",
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
    if (!seriesRef.current || btcCandles.length === 0) return;
    seriesRef.current.setData(
      btcCandles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })) as CandlestickData[]
    );
    chartRef.current?.timeScale().scrollToRealTime();
  }, [btcCandles]);

  return (
    <>
      <div className="ph">
        <span>BTC/USDT&nbsp;<span className="text-term-muted-2">·</span>&nbsp;5s CANDLES</span>
        <span
          className="text-sm font-bold tabular-nums transition-colors duration-150"
          style={{ color: priceColor, textShadow: flash ? `0 0 8px ${priceColor}80` : "none" }}
        >
          {btcPrice ? `$${btcPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "---"}
        </span>
      </div>
      <div ref={wrapRef} className="lc-wrap" />
    </>
  );
}
