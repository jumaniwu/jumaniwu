"use client";

import { useEffect, useRef, useState } from "react";

type FlashDir = "green" | "red" | "";

/**
 * Returns "green" or "red" CSS class name for one tick (duration ms) whenever
 * `value` crosses a threshold change, then resets to "".
 */
export function useFlash(value: number, duration = 420): FlashDir {
  const prevRef = useRef<number>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flash, setFlash] = useState<FlashDir>("");

  useEffect(() => {
    if (prevRef.current === value) return;
    const dir: FlashDir = value > prevRef.current ? "green" : "red";
    prevRef.current = value;

    if (timerRef.current) clearTimeout(timerRef.current);
    setFlash(dir);
    timerRef.current = setTimeout(() => setFlash(""), duration);
  }, [value, duration]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return flash;
}

/** Maps flash direction to a CSS animation class name. */
export function flashClass(dir: FlashDir): string {
  if (dir === "green") return "flash-bg-green";
  if (dir === "red")   return "flash-bg-red";
  return "";
}
