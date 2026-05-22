"use client";

import { useEffect, useRef } from "react";
import { useTradingStore } from "@/store/tradingStore";
import type { LogEntry } from "@/types";

const COLOR_MAP: Record<LogEntry["color"], string> = {
  green:   "text-term-green",
  red:     "text-term-red",
  yellow:  "text-term-yellow",
  cyan:    "text-term-cyan",
  magenta: "text-term-magenta",
  orange:  "text-term-orange",
};

function LogLine({ entry }: { entry: LogEntry }) {
  const col = COLOR_MAP[entry.color] ?? "text-term-white";
  return (
    <div className={`flex gap-1.5 text-2xs leading-5 font-mono animate-fade-in-row ${col}`}>
      <span className="text-term-muted flex-none">{entry.timestamp}</span>
      <span className="flex-none font-bold">{entry.tag}</span>
      <span className="text-term-muted flex-none">{entry.label}</span>
      <span>{entry.message}</span>
    </div>
  );
}

export default function LiveLogs() {
  const logs    = useTradingStore((s) => s.logs);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top (newest entry is first)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [logs.length]);

  return (
    <div className="h-full flex flex-col">
      <div className="panel-header">
        <span>EXECUTION LOG</span>
        <span className="text-term-green text-2xs animate-blink">▌</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col-reverse">
        <div ref={bottomRef} />
        {logs.map((entry, i) => (
          <LogLine key={`${entry.timestamp}-${i}`} entry={entry} />
        ))}
      </div>
      <div className="panel-header border-t border-b-0">
        <span className="text-term-muted">STREAM</span>
        <span className="text-term-cyan text-2xs">{logs.length} ENTRIES</span>
      </div>
    </div>
  );
}
