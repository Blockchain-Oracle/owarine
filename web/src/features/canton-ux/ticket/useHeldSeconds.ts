"use client";

import { useEffect, useState } from "react";

const TICK_MS = 250;

/**
 * Seconds left on a held price, ticking locally; null when there is none (or before the first client tick). No DOM or
 * stylesheet here, so the phone's native ticket shares it.
 */
export function useHeldSeconds(validUntilMs: number | null): number | null {
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    if (validUntilMs === null) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [validUntilMs]);
  if (validUntilMs === null || nowMs === 0) return null;
  return Math.max(0, (validUntilMs - nowMs) / 1000);
}
