"use client";

import dynamic from "next/dynamic";
import { WsProvider } from "@/components/WsProvider";

// SSR disabled — all components use browser APIs (WebSocket, canvas, ResizeObserver)
const Header        = dynamic(() => import("@/components/Header/Header"),                    { ssr: false });
const WalletPnL     = dynamic(() => import("@/components/WalletPnL/WalletPnL"),             { ssr: false });
const LiveChart     = dynamic(() => import("@/components/LiveChart/LiveChart"),              { ssr: false });
const OpenPositions = dynamic(() => import("@/components/OpenPositions/OpenPositions"),      { ssr: false });
const HedgeScanner  = dynamic(() => import("@/components/HedgeScanner/HedgeScanner"),       { ssr: false });
const StrategyTree  = dynamic(() => import("@/components/StrategyTree/StrategyTree"),        { ssr: false });
const EquityCurve   = dynamic(() => import("@/components/EquityCurve/EquityCurve"),         { ssr: false });
const LiveLogs      = dynamic(() => import("@/components/LiveLogs/LiveLogs"),               { ssr: false });
const LiveAnalytics = dynamic(() => import("@/components/LiveAnalytics/LiveAnalytics"),     { ssr: false });

export default function DashboardPage() {
  return (
    <WsProvider>
      {/*
        CSS Grid rows:  32px header | 38vh top | 17vh strategy tree | 1fr bottom
        Background #0D0D0D + 1px gap = near-black separator lines between panels
      */}
      <div className="dashboard">

        {/* ── ROW 1: HEADER ─────────────────────────────────────────────── */}
        <div className="panel">
          <Header />
        </div>

        {/* ── ROW 2: TOP PANELS ─────────────────────────────────────────── */}
        <div className="dashboard-top-row">
          <div className="panel"><WalletPnL /></div>
          <div className="panel"><LiveChart /></div>
          <div className="panel"><OpenPositions /></div>
          <div className="panel"><HedgeScanner /></div>
        </div>

        {/* ── ROW 3: STRATEGY DECISION TREE ─────────────────────────────── */}
        <div className="panel">
          <StrategyTree />
        </div>

        {/* ── ROW 4: BOTTOM PANELS ──────────────────────────────────────── */}
        <div className="dashboard-bottom-row">
          <div className="panel"><EquityCurve /></div>
          <div className="panel"><LiveLogs /></div>
          <div className="panel"><LiveAnalytics /></div>
        </div>

      </div>
    </WsProvider>
  );
}
