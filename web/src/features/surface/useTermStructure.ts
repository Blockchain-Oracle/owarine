"use client";

import { termPoints, type TermPoint } from "@owarine/core/surface";
import type { EventMarket } from "@owarine/core/types";
import { useBooks } from "@owarine/markets/react";
import { useMemo } from "react";

/**
 * One point per live Window of the asset, each on its own book. The coordinator holds one watch
 * per market, so the Windows already on screen in the hero or the rail cost nothing extra here.
 */
export function useTermStructure(windows: readonly EventMarket[], nowMs: number): TermPoint[] {
  const targets = useMemo(() => windows.map((m) => ({ marketId: m.marketId, poolAddress: m.poolAddress, decimals: m.decimals })), [windows]);
  const books = useBooks(targets);
  return useMemo(
    () => termPoints(windows.map((market, i) => ({ market, book: books[i] ?? null })), nowMs),
    // `nowMs` ticks every second; the points carry the countdown so the chart's labels stay live.
    [windows, books, nowMs],
  );
}
