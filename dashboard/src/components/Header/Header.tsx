"use client";

import { useTradingStore } from "@/store/tradingStore";

const STATUS_DOT = ({ on }: { on: boolean }) => (
  <span
    className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
      on ? "bg-term-green shadow-term-green animate-pulse" : "bg-term-red"
    }`}
  />
);

export default function Header() {
  const connected = useTradingStore((s) => s.connected);
  const btc       = useTradingStore((s) => s.btc);
  const eth       = useTradingStore((s) => s.eth);
  const pingMs    = useTradingStore((s) => s.pingMs);

  const btcPrice = btc?.price?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "---";
  const ethPrice = eth?.price?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "---";

  const tickerItems = [
    `BTC/USDT  ${btcPrice}`,
    `ETH/USDT  ${ethPrice}`,
    `PING  ${pingMs}ms`,
    `STATUS  ${connected ? "LIVE" : "DISCONNECTED"}`,
    `ENGINE  BYBIT × POLYMARKET`,
    `MODE  HFT-ARB`,
    `LATENCY  SUB-MS`,
    `BTC/USDT  ${btcPrice}`,
    `ETH/USDT  ${ethPrice}`,
    `PING  ${pingMs}ms`,
    `STATUS  ${connected ? "LIVE" : "DISCONNECTED"}`,
    `ENGINE  BYBIT × POLYMARKET`,
    `MODE  HFT-ARB`,
    `LATENCY  SUB-MS`,
  ];

  return (
    <div className="h-full bg-term-panel border-b border-term-border flex items-center gap-3 px-2 overflow-hidden">

      {/* Logo */}
      <span className="flex-none text-xs font-bold text-term-green tracking-widest whitespace-nowrap border-r border-term-border pr-3">
        ◈ HFT-ARB
      </span>

      {/* Scrolling ticker tape */}
      <div className="ticker-wrap flex-1 h-full flex items-center">
        <div className="ticker-inner">
          {tickerItems.map((item, i) => (
            <span key={i} className="inline-block mx-6 text-2xs tracking-wider">
              <span className="text-term-muted mr-1">▸</span>
              <span className={item.includes("LIVE") ? "text-term-green" : item.includes("DISCONNECTED") ? "text-term-red" : "text-term-white"}>
                {item}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Status pill */}
      <div className="flex-none flex items-center gap-2 text-2xs border-l border-term-border pl-3">
        <STATUS_DOT on={connected} />
        <span className={connected ? "text-term-green" : "text-term-red"}>
          {connected ? "CONNECTED" : "RECONNECTING"}
        </span>
        <span className="text-term-muted ml-2">
          PING <span className="text-term-cyan">{pingMs}ms</span>
        </span>
      </div>
    </div>
  );
}
