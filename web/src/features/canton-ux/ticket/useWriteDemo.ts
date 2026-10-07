"use client";

import type { WritePhase } from "@owarine/core/ports";
import { useCallback, useEffect, useRef, useState } from "react";
import { QUOTE_TTL_SEC } from "./copy";

/** The fixture's pacing: a Canton submit takes about 2 s on the sandbox (plan, "No wait without feedback"). */
const SCRIPT: ReadonlyArray<readonly [atMs: number, phase: WritePhase]> = [
  [0, "composing"],
  [700, "submitted"],
  [1_400, "confirming"],
  [2_600, "confirmed"],
];

export interface WriteDemo {
  phase: WritePhase | null;
  /** Seconds the firm quote has left; null before the click. */
  quoteLeftSec: number | null;
  run: (fail?: boolean) => void;
  reset: () => void;
}

/** Plays one placement through the phases with a live 20 s quote, for the `/dev/ticket-canton` directions. */
export function useWriteDemo(): WriteDemo {
  const [phase, setPhase] = useState<WritePhase | null>(null);
  const [startedMs, setStartedMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => clear, []);

  useEffect(() => {
    if (startedMs === null) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedMs]);

  const run = useCallback((fail = false) => {
    clear();
    setStartedMs(Date.now());
    for (const [atMs, p] of SCRIPT) {
      const next: WritePhase = fail && p === "confirmed" ? "reverted" : p;
      timers.current.push(setTimeout(() => setPhase(next), atMs));
    }
  }, []);

  const reset = useCallback(() => {
    clear();
    setPhase(null);
    setStartedMs(null);
  }, []);

  const quoteLeftSec = startedMs === null || nowMs === 0 ? null : Math.max(0, QUOTE_TTL_SEC - (nowMs - startedMs) / 1000);
  return { phase, quoteLeftSec, run, reset };
}
