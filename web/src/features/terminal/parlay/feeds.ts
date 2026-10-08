"use client";

import type { Address, MarketId } from "@owarine/core/types";
import { ladderSpotSymbol } from "@owarine/markets/react";
import { ladderSnapshot, liveSpot, subscribeBook, subscribeSpot, type Ladder } from "@owarine/markets/runtime";
import { useEffect, useState } from "react";
import { COMMIT_MS } from "../live";

/** What a leg is priced and marked on right now: its Window's ladder, the spot that Window settles on, and its line. */
export interface LegNow {
  ladder: Ladder | null;
  spot: number | null;
  spotE8: bigint | null;
  /** The Window's opening print, as a price; null until it is recorded. */
  line: number | null;
}

const CREDIT_DECIMALS = 6;

/** The spot symbol a leg's Window settles on: its ladder's lane, else the asset itself. */
const spotSymbolOf = (marketId: string, asset: string): string => {
  const ladder = ladderSnapshot(marketId)?.ladder;
  return (ladder ? ladderSpotSymbol(ladder) : null) ?? asset;
};

export function legNow(marketId: string, asset: string, lineE8: bigint | null = null): LegNow {
  const ladder = ladderSnapshot(marketId)?.ladder ?? null;
  const tick = liveSpot(spotSymbolOf(marketId, asset));
  const open = ladder?.openPriceE8 && ladder.openPriceE8 > 0n ? ladder.openPriceE8 : lineE8;
  return { ladder, spot: tick ? Number(tick.priceE8) / 1e8 : null, spotE8: tick ? tick.priceE8 : null, line: open && open > 0n ? Number(open) / 1e8 : null };
}

/**
 * Keeps the ladder and spot streams open for every leg on screen (the slip's and the open tickets'), and re-renders at
 * most every 200 ms when any of them moves — the screen's own commit rate. Returns a counter that changes on each.
 */
export function useLegFeeds(legs: ReadonlyArray<{ marketId: string; asset: string }>): number {
  const [version, setVersion] = useState(0);
  const key = [...new Set(legs.map((l) => `${l.marketId}|${l.asset}`))].sort().join(",");
  useEffect(() => {
    if (!key) return;
    let last = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      const wait = last + COMMIT_MS - performance.now();
      if (wait <= 0) {
        last = performance.now();
        setVersion((v) => v + 1);
      } else trailing ??= setTimeout(() => ((trailing = null), (last = performance.now()), setVersion((v) => v + 1)), wait);
    };
    const offs: Array<() => void> = [];
    const spots = new Set<string>();
    const watchSpot = (symbol: string) => {
      if (spots.has(symbol)) return;
      spots.add(symbol);
      offs.push(subscribeSpot(symbol, bump));
    };
    for (const pair of key.split(",")) {
      const [marketId, asset] = pair.split("|") as [string, string];
      watchSpot(asset);
      offs.push(
        subscribeBook({ marketId: marketId as MarketId, poolAddress: marketId as Address, decimals: CREDIT_DECIMALS }, () => {
          // A token lane settles on another symbol's spot (TSLAx for TSLA): watch it once the ladder names it.
          watchSpot(spotSymbolOf(marketId, asset));
          bump();
        }),
      );
    }
    return () => {
      offs.forEach((off) => off());
      if (trailing) clearTimeout(trailing);
    };
  }, [key]);
  return version;
}
