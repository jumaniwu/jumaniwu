"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useTradingStore } from "@/store/tradingStore";
import type { LogEntry } from "@/types";

// ── Color map ─────────────────────────────────────────────────────────────────

const LOG_CLS: Record<LogEntry["color"], string> = {
  green:   "log-green   text-term-green",
  red:     "log-red     text-term-red",
  yellow:  "log-yellow  text-term-yellow",
  cyan:    "log-cyan    text-term-cyan",
  magenta: "log-magenta text-term-magenta",
  orange:  "log-orange  text-term-orange",
};

// ── Filter definitions ────────────────────────────────────────────────────────

const FILTERS = ["ALL", "BUY", "SELL", "WARN", "SCAN"] as const;
type LogFilter = typeof FILTERS[number];

function matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
  if (filter === "ALL")  return true;
  if (filter === "BUY")  return entry.tag.includes("BUY");
  if (filter === "SELL") return entry.tag.includes("SELL");
  if (filter === "WARN") return entry.color === "orange" || entry.color === "yellow";
  if (filter === "SCAN") return entry.tag.includes("SCAN") || entry.tag.includes("HEDGE");
  return true;
}

// ── Log line ──────────────────────────────────────────────────────────────────

const LogLine = ({
  entry,
  isNewest,
}: {
  entry:    LogEntry;
  isNewest: boolean;
}) => {
  const cls = LOG_CLS[entry.color] ?? "log-green text-term-green";
  return (
    <div className={`log-line ${cls} ${isNewest ? "animate-slide-in-top" : ""}`}>
      <span className="text-term-muted flex-none w-[52px] shrink-0">{entry.timestamp}</span>
      <span className="flex-none w-[44px] shrink-0 font-semibold tracking-tighter">{entry.tag}</span>
      <span className="text-term-muted-2 flex-none mr-1 shrink-0">{entry.label}</span>
      <span className="text-term-white/75 min-w-0 truncate">{entry.message}</span>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveLogs() {
  const logs      = useTradingStore((s) => s.logs);
  const [filter, setFilter] = useState<LogFilter>("ALL");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => logs.filter((e) => matchesFilter(e, filter)),
    [logs, filter],
  );

  // Scroll to top on new entry (logs prepended → index 0 is newest)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filtered.length]);

  // Counts per filter for badges
  const counts = useMemo(() => ({
    BUY:  logs.filter((e) => e.tag.includes("BUY")).length,
    SELL: logs.filter((e) => e.tag.includes("SELL")).length,
    WARN: logs.filter((e) => e.color === "orange" || e.color === "yellow").length,
    SCAN: logs.filter((e) => e.tag.includes("SCAN") || e.tag.includes("HEDGE")).length,
  }), [logs]);

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="ph">
        <span>EXECUTION LOG</span>
        <span className="text-term-green animate-blink font-bold">▌</span>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-px border-b border-term-border flex-none" style={{ height: 20 }}>
        {FILTERS.map((f) => {
          const active = filter === f;
          const count  = f !== "ALL" ? counts[f as keyof typeof counts] : logs.length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 h-full text-3xs tracking-wider flex items-center justify-center gap-1 transition-colors ${
                active
                  ? "bg-term-green-dark text-term-green border-b border-term-green"
                  : "text-term-muted hover:text-term-white"
              }`}
            >
              {f}
              {count > 0 && (
                <span className={`text-3xs tabular-nums ${active ? "text-term-green" : "text-term-muted-2"}`}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Log stream ──────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="pb">
        {filtered.map((entry, i) => (
          <LogLine
            key={`${entry.timestamp}-${entry.tag}-${i}`}
            entry={entry}
            isNewest={i === 0}
          />
        ))}

        {filtered.length === 0 && (
          <div className="text-3xs text-term-muted text-center py-4">
            NO {filter} ENTRIES
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="pf">
        <span className="text-term-muted">
          {filter === "ALL" ? "ALL CHANNELS" : filter}&nbsp;·&nbsp;LIVE
        </span>
        <span className="text-term-cyan tabular-nums">{filtered.length}&nbsp;/&nbsp;{logs.length}</span>
      </div>
    </>
  );
}
