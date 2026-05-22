"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTradingStore } from "@/store/tradingStore";

// ── Node definitions ──────────────────────────────────────────────────────────

interface NodeMeta {
  id: string;
  label: string;
  sub: string;
  x: number;
}

const NODE_DEFS: NodeMeta[] = [
  { id: "tick_feed",       label: "TICK FEED",       sub: "10 Hz WS stream",  x: 0   },
  { id: "scan_polymarket", label: "SCAN POLY",        sub: "Mid-price check",  x: 200 },
  { id: "mid_mispricing",  label: "MISPRICING",       sub: "Δ threshold",      x: 400 },
  { id: "limit_fill",      label: "LIMIT FILL",       sub: "GTC order placed", x: 600 },
  { id: "hold",            label: "HOLD",             sub: "Delta monitoring", x: 800 },
  { id: "resolve",         label: "RESOLVE",          sub: "Contract settled", x: 1000 },
];

const EDGES: Edge[] = NODE_DEFS.slice(0, -1).map((n, i) => ({
  id:     `e-${i}`,
  source: n.id,
  target: NODE_DEFS[i + 1].id,
  type:   "smoothstep",
  style:  { stroke: "#2a2a2a", strokeWidth: 1.5 },
  animated: false,
}));

// ── Custom node colours ───────────────────────────────────────────────────────

function nodeStyle(state: "idle" | "active" | "completed"): React.CSSProperties {
  if (state === "active") return {
    background:  "#0a1a0d",
    border:      "1px solid #00FF41",
    boxShadow:   "0 0 12px rgba(0,255,65,0.5), inset 0 0 8px rgba(0,255,65,0.05)",
  };
  if (state === "completed") return {
    background:  "#081208",
    border:      "1px solid #00C832",
  };
  return {
    background: "#111211",
    border:     "1px solid #2a2a2a",
  };
}

function makeNodes(currentNode: string, completedNodes: string[]): Node[] {
  return NODE_DEFS.map((def) => {
    const state =
      def.id === currentNode ? "active" :
      completedNodes.includes(def.id) ? "completed" : "idle";

    return {
      id:       def.id,
      position: { x: def.x, y: 20 },
      data: {
        label: (
          <div className="text-center px-1">
            <div className={`text-xs font-bold tracking-wider ${
              state === "active" ? "text-term-green" :
              state === "completed" ? "text-term-green/60" : "text-term-muted"
            }`}>
              {state === "active" ? "▶ " : state === "completed" ? "✓ " : "  "}
              {def.label}
            </div>
            <div className="text-2xs text-term-muted mt-0.5">{def.sub}</div>
            {state === "active" && (
              <div className="mt-1 w-full h-px bg-term-green/50 animate-pulse" />
            )}
          </div>
        ),
      },
      style:  { ...nodeStyle(state), borderRadius: "2px", padding: "6px 8px", minWidth: "140px" },
      type:   "default",
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StrategyTree() {
  const { current_node, completed_nodes } = useTradingStore((s) => s.stateMachine);

  const initNodes = useMemo(() => makeNodes(current_node, completed_nodes), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(EDGES);

  // Update nodes on state machine changes (without re-creating edges)
  useEffect(() => {
    setNodes(makeNodes(current_node, completed_nodes));
    // Highlight the edge leading into the current node
    const currentIdx = NODE_DEFS.findIndex((n) => n.id === current_node);
    setEdges(EDGES.map((e, i) => ({
      ...e,
      animated: i === currentIdx - 1,
      style: {
        stroke: i < currentIdx ? "#00C832" : i === currentIdx - 1 ? "#00FF41" : "#2a2a2a",
        strokeWidth: i === currentIdx - 1 ? 2 : 1.5,
        filter: i === currentIdx - 1 ? "drop-shadow(0 0 3px rgba(0,255,65,0.6))" : "none",
      },
    })));
  }, [current_node, completed_nodes]);

  return (
    <div className="h-full flex flex-col">
      <div className="panel-header">
        <span>STRATEGY STATE MACHINE</span>
        <span className="text-term-green text-2xs font-bold tracking-widest">
          ◈ {current_node.toUpperCase().replace(/_/g, " ")}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="#1a1a1a"
            gap={20}
            size={1}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
