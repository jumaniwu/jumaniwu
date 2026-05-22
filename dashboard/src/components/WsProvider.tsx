"use client";

import { useEffect } from "react";
import { connect, disconnect } from "@/lib/websocket";

/** Mounts once at the root — starts the WS connection lifecycle. */
export function WsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return <>{children}</>;
}
