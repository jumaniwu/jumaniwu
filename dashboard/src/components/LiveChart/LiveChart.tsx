"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  UTCTimestamp,
} from "lightweight-charts";
import { useTradingStore } from "@/store/tradingStore";
import { useFlash } from "@/lib/useFlash";
import type { Candle } from "@/types";

// ── Data converters ───────────────────────────────────────────────────────────

const toBar = (c: Candle): CandlestickData => ({
  time:  c.time as UTCTimestamp,
  open:  c.open,
  high:  c.high,
  low:   c.low,
  close: c.close,
});

const toVol = (c: Candle): HistogramData => ({
  time:  c.time as UTCTimestamp,
  value: c.volume,
  color: c.close >= c.open ? "rgba(0,255,65,0.30)" : "rgba(255,43,74,0.30)",
});

// ── Lightweight Charts options ────────────────────────────────────────────────

const CHART_BASE = {
  layout:  { background: { color: "#111211" }, textColor: "#5A5A5A" },
  grid:    { vertLines: { color: "#171917" }, horzLines: { color: "#171917" } },
  crosshair: {
    mode: 1,
    vertLine: { color: "#2e302e", labelBackgroundColor: "#171917" },
    horzLine: { color: "#2e302e", labelBackgroundColor: "#171917" },
  },
  rightPriceScale: { borderColor: "#222322", textColor: "#5A5A5A" },
  timeScale:       { borderColor: "#222322", timeVisible: true, secondsVisible: true, textColor: "#5A5A5A" },
  handleScroll: false,
  handleScale:  false,
} as const;

// ── OHLCV info bar ────────────────────────────────────────────────────────────

function OhlcBar({ candle, symbol }: { candle: Candle | null; symbol: string }) {
  if (!candle) return (
    <div className="flex items-center gap-3 px-2 border-b border-term-border flex-none text-3xs text-term-muted" style={{ height: 18 }}>
      <span className="text-term-muted-2">OHLCV&nbsp;—&nbsp;AWAITING DATA</span>
    </div>
  );

  const isUp = candle.close >= candle.open;
  return (
    <div className="flex items-center gap-3 px-2 border-b border-term-border flex-none text-3xs tabular-nums" style={{ height: 18 }}>
      <span className="text-term-muted-2">O</span>
      <span className="text-term-white">{candle.open.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
      <span className="text-term-muted-2">H</span>
      <span className="text-term-green">{candle.high.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
      <span className="text-term-muted-2">L</span>
      <span className="text-term-red">{candle.low.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
      <span className="text-term-muted-2">C</span>
      <span className={isUp ? "text-term-green" : "text-term-red"}>
        {candle.close.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
      <span className="text-term-muted-2 ml-auto">V</span>
      <span className="text-term-cyan">{candle.volume.toFixed(3)}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type Symbol = "BTC" | "ETH";

export default function LiveChart() {
  const wrapRef      = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const candleRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef       = useRef<ISeriesApi<"Histogram"> | null>(null);
  // Track last rendered state so we can use update() instead of setData()
  const initDoneRef  = useRef(false);
  const lastSymRef   = useRef<Symbol>("BTC");

  const [symbol, setSymbol] = useState<Symbol>("BTC");

  const btcCandles = useTradingStore((s) => s.btcCandles);
  const ethCandles = useTradingStore((s) => s.ethCandles);
  const btcPrice   = useTradingStore((s) => s.btc?.price ?? 0);
  const ethPrice   = useTradingStore((s) => s.eth?.price ?? 0);

  const candles   = symbol === "BTC" ? btcCandles : ethCandles;
  const livePrice = symbol === "BTC" ? btcPrice   : ethPrice;
  const lastCandle = candles[candles.length - 1] ?? null;

  const flash      = useFlash(livePrice);
  const priceColor = flash === "green" ? "#00FF41" : flash === "red" ? "#FF2B4A" : "#E8E8E0";

  // ── Chart init (once) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      ...CHART_BASE,
      width:  wrapRef.current.clientWidth,
      height: wrapRef.current.clientHeight,
    });

    // Candlestick series — occupies top 78% of price scale
    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.04, bottom: 0.24 },
    });
    const candles = chart.addCandlestickSeries({
      upColor:         "#00FF41", downColor:         "#FF2B4A",
      borderUpColor:   "#00FF41", borderDownColor:   "#FF2B4A",
      wickUpColor:     "#00C832", wickDownColor:     "#CC1F38",
    });

    // Volume histogram — separate overlay scale at bottom 20%
    const vol = chart.addHistogramSeries({
      priceScaleId: "vol",
      priceFormat:  { type: "volume" },
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current  = chart;
    candleRef.current = candles;
    volRef.current    = vol;

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

  // ── Data feed — efficient update() after initial setData() ─────────────────
  useEffect(() => {
    if (!candleRef.current || !volRef.current || candles.length === 0) return;

    const last = candles[candles.length - 1];
    const symbolChanged = lastSymRef.current !== symbol;

    if (!initDoneRef.current || symbolChanged) {
      // Full historical load: first mount or symbol switch
      candleRef.current.setData(candles.map(toBar));
      volRef.current.setData(candles.map(toVol));
      chartRef.current?.timeScale().scrollToRealTime();
      initDoneRef.current = true;
      lastSymRef.current  = symbol;
    } else {
      // Incremental — LightweightCharts update() handles both "same time" and "new bar"
      candleRef.current.update(toBar(last));
      volRef.current.update(toVol(last));
    }
  }, [candles, symbol]);

  // ── Symbol button style ────────────────────────────────────────────────────
  const symBtn = (s: Symbol) =>
    `text-3xs px-1.5 py-px border cursor-pointer transition-colors ${
      symbol === s
        ? "border-term-green text-term-green bg-term-green-dark"
        : "border-term-border text-term-muted hover:border-term-border-hi hover:text-term-white"
    }`;

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="ph">
        <div className="flex items-center gap-2">
          <span>{symbol}/USDT&nbsp;<span className="text-term-muted-2">·</span>&nbsp;5s</span>
          <button className={symBtn("BTC")} onClick={() => { initDoneRef.current = false; setSymbol("BTC"); }}>BTC</button>
          <button className={symBtn("ETH")} onClick={() => { initDoneRef.current = false; setSymbol("ETH"); }}>ETH</button>
        </div>
        <span
          className="text-sm font-bold tabular-nums transition-colors duration-100"
          style={{ color: priceColor, textShadow: flash ? `0 0 8px ${priceColor}70` : "none" }}
        >
          {livePrice ? `$${livePrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "---"}
        </span>
      </div>

      {/* ── OHLCV bar ───────────────────────────────────────────────────── */}
      <OhlcBar candle={lastCandle} symbol={symbol} />

      {/* ── Chart canvas ────────────────────────────────────────────────── */}
      <div ref={wrapRef} className="lc-wrap" />
    </>
  );
}
