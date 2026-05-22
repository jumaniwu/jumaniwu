"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, BackgroundVariant,
  useNodesState, useEdgesState,
  type Node, type NodeProps, type NodeTypes, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTradingStore } from "@/store/tradingStore";

// ── Static node metadata ──────────────────────────────────────────────────────

const NODE_META = [
  { id: "tick_feed",       label: "TICK FEED",   icon: "⟳",  sub: "10 Hz WebSocket",   x: 0    },
  { id: "scan_polymarket", label: "SCAN POLY",    icon: "◎",  sub: "Mid-price scan",    x: 198  },
  { id: "mid_mispricing",  label: "MISPRICING",   icon: "Δ",  sub: "Threshold check",   x: 396  },
  { id: "limit_fill",      label: "LIMIT FILL",   icon: "◈",  sub: "GTC order placed",  x: 594  },
  { id: "hold",            label: "HOLD",         icon: "⊡",  sub: "Delta monitor",     x: 792  },
  { id: "resolve",         label: "RESOLVE",      icon: "✦",  sub: "Settlement",        x: 990  },
] as const;

const NODE_SHORT: Record<string, string> = {
  tick_feed:       "TICK",
  scan_polymarket: "SCAN",
  mid_mispricing:  "MISP",
  limit_fill:      "FILL",
  hold:            "HOLD",
  resolve:         "RSLV",
};

const BASE_EDGES: Edge[] = NODE_META.slice(0, -1).map((n, i) => ({
  id:     `e${i}`,
  source: n.id,
  target: NODE_META[i + 1].id,
  type:   "smoothstep",
}));

// ── Custom node data shape ────────────────────────────────────────────────────

type NodeState = "idle" | "active" | "done";

interface TerminalNodeData extends Record<string, unknown> {
  nodeState:  NodeState;
  label:      string;
  icon:       string;
  sub:        string;
  visits:     number;
  dwellSec:   number;
}

type TerminalFlowNode = Node<TerminalNodeData, "terminal">;

// ── Style map ─────────────────────────────────────────────────────────────────

const S: Record<NodeState, {
  border: string; bg: string; shadow: string; animation?: string;
  labelCol: string; iconCol: string; subCol: string; badgeBorder: string; badgeCol: string;
}> = {
  active: {
    border:      "1.5px solid #00FF41",
    bg:          "#071507",
    shadow:      "none",          // handled by border-pulse animation
    animation:   "border-pulse 1.6s ease-in-out infinite",
    labelCol:    "#00FF41",
    iconCol:     "#00FF41",
    subCol:      "#5A5A5A",
    badgeBorder: "rgba(0,255,65,0.5)",
    badgeCol:    "#00FF41",
  },
  done: {
    border:      "1px solid rgba(0,200,50,0.3)",
    bg:          "#060d06",
    shadow:      "none",
    labelCol:    "rgba(0,200,50,0.55)",
    iconCol:     "rgba(0,200,50,0.45)",
    subCol:      "#333",
    badgeBorder: "rgba(0,200,50,0.2)",
    badgeCol:    "rgba(0,200,50,0.5)",
  },
  idle: {
    border:      "1px solid #1e211e",
    bg:          "#0f100f",
    shadow:      "none",
    labelCol:    "#333",
    iconCol:     "#222",
    subCol:      "#1e1e1e",
    badgeBorder: "#1a1a1a",
    badgeCol:    "#272727",
  },
};

function formatDwell(sec: number): string {
  if (sec < 60)  return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60}s`;
}

// ── TerminalNode — defined at module scope so React Flow never recreates it ──

function TerminalNode({ data }: NodeProps<TerminalFlowNode>) {
  const { nodeState, label, icon, sub, visits, dwellSec } = data;
  const st = S[nodeState];
  const isActive = nodeState === "active";
  const isDone   = nodeState === "done";

  return (
    <div
      style={{
        background:   st.bg,
        border:       st.border,
        borderRadius: 2,
        padding:      "6px 9px 6px",
        minWidth:     150,
        maxWidth:     160,
        fontFamily:   "var(--font-fira), 'Fira Code', monospace",
        userSelect:   "none",
        position:     "relative",
        overflow:     "hidden",
        animation:    st.animation,
      }}
    >
      {/* Horizontal glow sweep — active only */}
      {isActive && (
        <div style={{
          position:   "absolute",
          top:        0, left: 0, right: 0,
          height:     "1px",
          background: "linear-gradient(90deg, transparent 0%, #00FF41 50%, transparent 100%)",
          animation:  "glow-sweep 2.4s linear infinite",
        }} />
      )}

      {/* ── Top row: icon + label + visit badge ─────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>

        {/* Icon + label */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            color:      st.iconCol,
            fontSize:   "0.7rem",
            lineHeight: 1,
            ...(isActive ? { animation: "blink 1.1s step-end infinite" } : {}),
          }}>
            {isDone ? "✓" : icon}
          </span>
          <span style={{
            color:          st.labelCol,
            fontSize:       "0.55rem",
            fontWeight:     700,
            letterSpacing:  "0.13em",
            lineHeight:     1,
            textShadow:     isActive ? "0 0 9px rgba(0,255,65,0.55)" : "none",
          }}>
            {label}
          </span>
        </div>

        {/* Visit count badge */}
        <span style={{
          color:        st.badgeCol,
          fontSize:     "0.45rem",
          border:       `1px solid ${st.badgeBorder}`,
          padding:      "1px 3px",
          borderRadius: 1,
          lineHeight:   "11px",
          minWidth:     18,
          textAlign:    "center",
          fontVariantNumeric: "tabular-nums",
        }}>
          {visits}
        </span>
      </div>

      {/* ── Sub-description ──────────────────────────────────────────── */}
      <div style={{
        color:        st.subCol,
        fontSize:     "0.44rem",
        letterSpacing:"0.04em",
        marginTop:    3,
        lineHeight:   1.3,
      }}>
        {sub}
      </div>

      {/* ── Active footer: status + dwell + sweep bar ────────────────── */}
      {isActive && (
        <div style={{ marginTop: 5, borderTop: "1px solid rgba(0,255,65,0.18)", paddingTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{
              color:       "#00FF41",
              fontSize:    "0.44rem",
              letterSpacing:"0.12em",
              animation:   "pulse 1.6s ease-in-out infinite",
            }}>
              ▶ ACTIVE
            </span>
            <span style={{ color: "rgba(0,255,65,0.65)", fontSize: "0.44rem", letterSpacing: "0.06em" }}>
              {formatDwell(dwellSec)}
            </span>
          </div>
          {/* Animated sweep bar */}
          <div style={{ marginTop: 3, height: 1, background: "rgba(0,255,65,0.12)", position: "relative", overflow: "hidden" }}>
            <div style={{
              position:   "absolute",
              top:        0, height: "100%",
              width:      "35%",
              background: "linear-gradient(90deg, transparent, #00FF41, transparent)",
              animation:  "node-sweep 1.3s linear infinite",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// nodeTypes defined at module scope — React Flow requirement
const nodeTypes: NodeTypes = { terminal: TerminalNode };

// ── Builders ──────────────────────────────────────────────────────────────────

function buildNodes(
  cur:       string,
  done:      string[],
  visits:    Record<string, number>,
  dwellSec:  number,
): Node[] {
  return NODE_META.map((meta) => {
    const nodeState: NodeState =
      meta.id === cur ? "active" : done.includes(meta.id) ? "done" : "idle";

    return {
      id:       meta.id,
      type:     "terminal",
      position: { x: meta.x, y: 8 },
      data:     {
        nodeState,
        label:    meta.label,
        icon:     meta.icon,
        sub:      meta.sub,
        visits:   visits[meta.id] ?? 0,
        dwellSec: nodeState === "active" ? dwellSec : 0,
      } satisfies TerminalNodeData,
      // React Flow default node wrapper must be transparent so our custom style shows
      style: { padding: 0, border: "none", background: "transparent", boxShadow: "none" },
    };
  });
}

function buildEdges(cur: string): Edge[] {
  const curIdx = NODE_META.findIndex((n) => n.id === cur);
  return BASE_EDGES.map((e, i) => ({
    ...e,
    animated:    i === curIdx - 1,
    style: {
      stroke:      i < curIdx       ? "rgba(0,200,50,0.35)" :
                   i === curIdx - 1 ? "#00FF41"              : "#1e211e",
      strokeWidth: i === curIdx - 1 ? 2 : 1.5,
      filter:      i === curIdx - 1 ? "drop-shadow(0 0 4px rgba(0,255,65,0.55))" : "none",
    },
  }));
}

// ── Transition log ────────────────────────────────────────────────────────────

interface TransEntry { id: number; from: string; to: string; ts: string; }

// ── Component ─────────────────────────────────────────────────────────────────

export default function StrategyTree() {
  const sm = useTradingStore((s) => s.stateMachine);
  const { current_node, completed_nodes, node_entry_ts, visit_counts } = sm;

  // ── Dwell timer (1 Hz) ─────────────────────────────────────────────────────
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const dwellSec = Math.max(0, nowSec - Math.floor(node_entry_ts ?? Date.now() / 1000));

  // ── Transition log ─────────────────────────────────────────────────────────
  const prevNodeRef = useRef(current_node);
  const [transitions, setTransitions] = useState<TransEntry[]>([]);
  useEffect(() => {
    if (prevNodeRef.current === current_node) return;
    const entry: TransEntry = {
      id:   Date.now(),
      from: prevNodeRef.current,
      to:   current_node,
      ts:   new Date().toTimeString().slice(0, 8),
    };
    prevNodeRef.current = current_node;
    setTransitions((prev) => [entry, ...prev].slice(0, 5));
  }, [current_node]);

  // ── React Flow state ───────────────────────────────────────────────────────
  const initNodes = useMemo(
    () => buildNodes(current_node, completed_nodes, visit_counts ?? {}, 0),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const initEdges = useMemo(() => buildEdges(current_node), []); // eslint-disable-line

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    setNodes(buildNodes(current_node, completed_nodes, visit_counts ?? {}, dwellSec));
    setEdges(buildEdges(current_node));
  }, [current_node, completed_nodes, visit_counts, dwellSec]);

  // Total completed cycles
  const cycles = visit_counts?.["resolve"] ?? 0;

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="ph">
        <div className="flex items-center gap-2">
          <span>STRATEGY STATE MACHINE</span>
          <span className="text-term-border">·</span>
          <span className="text-term-muted">BYBIT × POLYMARKET ARB</span>
        </div>
        <div className="flex items-center gap-3">
          {cycles > 0 && (
            <span className="text-term-muted">
              <span className="text-term-cyan tabular-nums">{cycles}</span>
              &nbsp;cycles
            </span>
          )}
          <span
            className="text-term-green font-bold"
            style={{ textShadow: "0 0 6px rgba(0,255,65,0.5)", animation: "pulse 1.6s ease-in-out infinite" }}
          >
            ◈&nbsp;{current_node.replace(/_/g, " ").toUpperCase()}&nbsp;·&nbsp;{dwellSec}s
          </span>
        </div>
      </div>

      {/* ── React Flow canvas ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView fitViewOptions={{ padding: 0.28 }}
          nodesDraggable={false} nodesConnectable={false}
          elementsSelectable={false} panOnDrag={false}
          zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="#171917" gap={16} size={0.8} />
        </ReactFlow>

        {/* ── Transition log overlay (bottom of canvas) ─────────────────── */}
        {transitions.length > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 z-10 border-t border-term-border"
            style={{ background: "rgba(7,10,7,0.92)" }}
          >
            <div className="flex items-center gap-3 px-2 py-1 border-b border-term-border/50">
              <span className="text-3xs text-term-muted tracking-widest uppercase">Transition Log</span>
              <span className="text-3xs text-term-cyan tabular-nums">{transitions.length}</span>
            </div>
            {transitions.slice(0, 3).map((t, i) => (
              <div
                key={t.id}
                className={`flex items-center gap-2 px-2 py-[2px] text-3xs ${i === 0 ? "animate-slide-in-top" : ""}`}
                style={{ opacity: 1 - i * 0.28 }}
              >
                <span className="text-term-muted w-[52px] flex-none tabular-nums">{t.ts}</span>
                <span className="text-term-muted-2 w-[30px]">{NODE_SHORT[t.from] ?? t.from}</span>
                <span className="text-term-green">→</span>
                <span className="text-term-green font-semibold w-[30px]">{NODE_SHORT[t.to] ?? t.to}</span>
                <span className="text-term-muted ml-2">state transition</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
