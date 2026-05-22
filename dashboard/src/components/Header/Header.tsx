"use client";

import { useEffect, useState } from "react";
import { useTradingStore } from "@/store/tradingStore";

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

const SEP = <span className="text-term-muted-2 mx-3 select-none">║</span>;

export default function Header() {
  const connected = useTradingStore((s) => s.connected);
  const btc       = useTradingStore((s) => s.btc);
  const eth       = useTradingStore((s) => s.eth);
  const pingMs    = useTradingStore((s) => s.pingMs);
  const clock     = useClock();

  const btcFmt = btc?.price?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "---";
  const ethFmt = eth?.price?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "---";

  // Build items duplicated so the second half seamlessly loops
  const raw = [
    { label: "BTC/USDT", value: btcFmt,                         color: "text-term-white" },
    { label: "ETH/USDT", value: ethFmt,                         color: "text-term-white" },
    { label: "PING",     value: `${pingMs}ms`,                  color: "text-term-cyan"  },
    { label: "ENGINE",   value: "BYBIT × POLYMARKET",           color: "text-term-muted" },
    { label: "MODE",     value: "HFT-ARB · DELTA-NEUTRAL",      color: "text-term-muted" },
    { label: "STRATEGY", value: "MID-PRICE MISPRICING",         color: "text-term-muted" },
    { label: "STATUS",   value: connected ? "● LIVE" : "● OFFLINE", color: connected ? "text-term-green" : "text-term-red" },
    { label: "LATENCY",  value: "SUB-MS",                       color: "text-term-muted" },
  ];
  const items = [...raw, ...raw]; // duplicate for seamless loop

  return (
    <div className="h-full flex items-center gap-0 overflow-hidden">

      {/* ── Logo pill ──────────────────────────────────────────────────── */}
      <div className="flex-none flex items-center gap-2 px-3 h-full border-r border-term-border bg-term-green/5">
        <span className="text-term-green text-xs font-bold tracking-[0.2em]">◈ HFT-ARB</span>
      </div>

      {/* ── Scrolling ticker ───────────────────────────────────────────── */}
      <div className="ticker-wrap flex-1 h-full flex items-center">
        <div className="ticker-inner">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center">
              <span className="inline-flex items-center gap-1.5 mx-4">
                <span className="text-term-muted-2 text-3xs">▸</span>
                <span className="text-term-muted text-2xs tracking-widest">{item.label}</span>
                <span className={`text-2xs font-semibold tabular-nums ${item.color}`}>{item.value}</span>
              </span>
              {i % raw.length !== raw.length - 1 && SEP}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right: clock + status ───────────────────────────────────────── */}
      <div className="flex-none flex items-center gap-3 px-3 h-full border-l border-term-border text-2xs">
        <span className="text-term-cyan tabular-nums font-semibold tracking-widest">{clock}</span>
        <span className="border-l border-term-border pl-3 flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-term-green animate-pulse" : "bg-term-red"}`}
            style={connected ? { boxShadow: "0 0 5px rgba(0,255,65,0.7)" } : undefined}
          />
          <span className={connected ? "text-term-green font-bold" : "text-term-red"}>
            {connected ? "CONNECTED" : "RECONNECTING"}
          </span>
        </span>
      </div>

    </div>
  );
}
