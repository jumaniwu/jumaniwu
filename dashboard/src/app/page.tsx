"use client";

import dynamic from "next/dynamic";
import { WsProvider } from "@/components/WsProvider";

// Dynamic imports with SSR disabled — all components touch browser APIs
const Header         = dynamic(() => import("@/components/Header/Header"),         { ssr: false });
const WalletPnL      = dynamic(() => import("@/components/WalletPnL/WalletPnL"),   { ssr: false });
const LiveChart      = dynamic(() => import("@/components/LiveChart/LiveChart"),    { ssr: false });
const OpenPositions  = dynamic(() => import("@/components/OpenPositions/OpenPositions"), { ssr: false });
const HedgeScanner   = dynamic(() => import("@/components/HedgeScanner/HedgeScanner"),  { ssr: false });
const StrategyTree   = dynamic(() => import("@/components/StrategyTree/StrategyTree"),   { ssr: false });
const EquityCurve    = dynamic(() => import("@/components/EquityCurve/EquityCurve"),     { ssr: false });
const LiveLogs       = dynamic(() => import("@/components/LiveLogs/LiveLogs"),           { ssr: false });
const LiveAnalytics  = dynamic(() => import("@/components/LiveAnalytics/LiveAnalytics"), { ssr: false });

export default function DashboardPage() {
  return (
    <WsProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-term-bg gap-px">

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="flex-none h-8">
          <Header />
        </div>

        {/* ── TOP ROW ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 gap-px" style={{ flex: "0 0 36%" }}>
          <div className="w-52 flex-none panel scanlines">
            <WalletPnL />
          </div>
          <div className="flex-1 min-w-0 panel scanlines">
            <LiveChart />
          </div>
          <div className="w-72 flex-none panel scanlines">
            <OpenPositions />
          </div>
          <div className="w-64 flex-none panel scanlines">
            <HedgeScanner />
          </div>
        </div>

        {/* ── MIDDLE ROW — Strategy Decision Tree ─────────────────────── */}
        <div className="flex-none panel scanlines" style={{ height: "22%" }}>
          <StrategyTree />
        </div>

        {/* ── BOTTOM ROW ──────────────────────────────────────────────── */}
        <div className="flex gap-px" style={{ flex: "1 1 0", minHeight: 0 }}>
          <div className="flex-1 min-w-0 panel scanlines">
            <EquityCurve />
          </div>
          <div className="w-80 flex-none panel scanlines">
            <LiveLogs />
          </div>
          <div className="w-64 flex-none panel scanlines">
            <LiveAnalytics />
          </div>
        </div>

      </div>
    </WsProvider>
  );
}
