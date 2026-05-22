"use client";

import { useRef, useEffect } from "react";
import { useTradingStore } from "@/store/tradingStore";
import type { LogEntry } from "@/types";

const LOG_COLOR_CLASS: Record<LogEntry["color"], string> = {
  green:   "log-green   text-term-green",
  red:     "log-red     text-term-red",
  yellow:  "log-yellow  text-term-yellow",
  cyan:    "log-cyan    text-term-cyan",
  magenta: "log-magenta text-term-magenta",
  orange:  "log-orange  text-term-orange",
};

// Fixed-width tag column keeps the line visually stable
function LogLine({ entry }: { entry: LogEntry }) {
  const cls = LOG_COLOR_CLASS[entry.color] ?? "log-green text-term-green";
  return (
    <div className={`log-line ${cls}`}>
      <span className="text-term-muted flex-none w-[52px]">{entry.timestamp}</span>
      <span className="flex-none w-[44px] font-semibold tracking-tighter">{entry.tag}</span>
      <span className="text-term-muted-2 flex-none mr-0.5">{entry.label}</span>
      <span className="text-term-white/80">{entry.message}</span>
    </div>
  );
}

export default function LiveLogs() {
  const logs      = useTradingStore((s) => s.logs);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top (newest entries prepended to logs array)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [logs.length]);

  return (
    <>
      <div className="ph">
        <span>EXECUTION LOG</span>
        <span className="text-term-green animate-blink font-bold">▌</span>
      </div>

      <div ref={scrollRef} className="pb px-0 py-0">
        {logs.map((entry, i) => (
          <LogLine key={`${entry.timestamp}-${i}`} entry={entry} />
        ))}
      </div>

      <div className="pf">
        <span className="text-term-muted">STREAM&nbsp;·&nbsp;LIVE</span>
        <span className="text-term-cyan tabular-nums">{logs.length}&nbsp;ENTRIES</span>
      </div>
    </>
  );
}
