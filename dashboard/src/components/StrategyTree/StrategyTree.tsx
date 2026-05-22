"use client";

import { useEffect, useMemo } from "react";
import {
  ReactFlow, Background, BackgroundVariant,
  useNodesState, useEdgesState,
  type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTradingStore } from "@/store/tradingStore";

interface NodeDef { id: string; label: string; sub: string; x: number; }

const NODE_DEFS: NodeDef[] = [
  { id: "tick_feed",       label: "TICK FEED",    sub: "10 Hz WS",        x: 0    },
  { id: "scan_polymarket", label: "SCAN POLY",     sub: "Mid-price",       x: 195  },
  { id: "mid_mispricing",  label: "MISPRICING",    sub: "Δ threshold",     x: 390  },
  { id: "limit_fill",      label: "LIMIT FILL",    sub: "GTC order",       x: 585  },
  { id: "hold",            label: "HOLD",          sub: "Delta monitor",   x: 780  },
  { id: "resolve",         label: "RESOLVE",       sub: "Settlement",      x: 975  },
];

const BASE_EDGES: Edge[] = NODE_DEFS.slice(0, -1).map((n, i) => ({
  id: `e${i}`, source: n.id, target: NODE_DEFS[i + 1].id,
  type: "smoothstep",
}));

type NodeState = "idle" | "active" | "done";

function buildNodes(cur: string, done: string[]): Node[] {
  return NODE_DEFS.map((def) => {
    const state: NodeState =
      def.id === cur ? "active" : done.includes(def.id) ? "done" : "idle";

    const border =
      state === "active" ? "1.5px solid #00FF41" :
      state === "done"   ? "1px solid #00C83260"  : "1px solid #222322";

    const bg =
      state === "active" ? "#071507" :
      state === "done"   ? "#060d06" : "#111211";

    const shadow =
      state === "active" ? "0 0 14px rgba(0,255,65,0.6), inset 0 0 10px rgba(0,255,65,0.06)"
                         : "none";

    return {
      id: def.id,
      position: { x: def.x, y: 14 },
      style: { background: bg, border, borderRadius: 1, boxShadow: shadow, padding: 0 },
      data: {
        label: (
          <div className="px-3 py-1.5 text-center" style={{ minWidth: 130 }}>
            <div className="flex items-center justify-center gap-1 mb-0.5">
              {state === "active" && (
                <span className="text-3xs text-term-green animate-pulse">▶</span>
              )}
              {state === "done" && (
                <span className="text-3xs" style={{ color: "#00C832" }}>✓</span>
              )}
              <span
                className="text-2xs font-bold tracking-widest"
                style={{
                  color: state === "active" ? "#00FF41" : state === "done" ? "#00C83299" : "#5A5A5A",
                  textShadow: state === "active" ? "0 0 8px rgba(0,255,65,0.55)" : "none",
                }}
              >
                {def.label}
              </span>
            </div>
            <div className="text-3xs text-term-muted">{def.sub}</div>
            {state === "active" && (
              <div className="mt-1 h-px bg-term-green/40 animate-pulse" style={{ width: "100%" }} />
            )}
          </div>
        ),
      },
      type: "default",
    };
  });
}

function buildEdges(cur: string): Edge[] {
  const curIdx = NODE_DEFS.findIndex((n) => n.id === cur);
  return BASE_EDGES.map((e, i) => ({
    ...e,
    animated: i === curIdx - 1,
    style: {
      stroke:      i < curIdx ? "#00C83250" : i === curIdx - 1 ? "#00FF41" : "#222322",
      strokeWidth: i === curIdx - 1 ? 2 : 1.5,
    },
  }));
}

export default function StrategyTree() {
  const { current_node, completed_nodes } = useTradingStore((s) => s.stateMachine);

  const initNodes = useMemo(() => buildNodes(current_node, completed_nodes), []);
  const initEdges = useMemo(() => buildEdges(current_node), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    setNodes(buildNodes(current_node, completed_nodes));
    setEdges(buildEdges(current_node));
  }, [current_node, completed_nodes]);

  return (
    <>
      <div className="ph">
        <span>STRATEGY STATE MACHINE&nbsp;<span className="text-term-muted-2">·</span>&nbsp;BYBIT × POLYMARKET ARB</span>
        <span className="text-term-green font-bold animate-pulse" style={{ textShadow: "0 0 6px rgba(0,255,65,0.5)" }}>
          ◈&nbsp;{current_node.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          fitView fitViewOptions={{ padding: 0.25 }}
          nodesDraggable={false} nodesConnectable={false}
          elementsSelectable={false} panOnDrag={false}
          zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="#191A19" gap={18} size={1} />
        </ReactFlow>
      </div>
    </>
  );
}
