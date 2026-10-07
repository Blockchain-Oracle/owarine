"use client";

import { formatCadence } from "@owarine/core/copy";
import type { EventMarket, LaneSet } from "@owarine/core/types";
import { useLanes } from "@owarine/markets/react";
import { useMemo } from "react";
import { useVenue } from "@/features/markets/useVenue";

/** One Window length the symbol trades on (Owarine's lane: which Window you trade, separate from a candle interval). */
export interface TerminalLane {
  intervalSec: number;
  label: string;
}

export interface TerminalWindow {
  /** Every lane the venue lists (the market picker reads it). */
  set: LaneSet | null;
  lanes: TerminalLane[];
  intervalSec: number | null;
  /** The Window trading now on that lane, else the next one listed; null when the symbol has none. */
  market: EventMarket | null;
  /** The lanes are still loading (nothing to say yet). */
  loading: boolean;
  /** Why the lanes could not be read, when they could not. */
  failure: string | null;
}

/** The Window to trade: trading now, else the soonest still to start; price Windows only (events open in /markets). */
export function pickWindow(markets: readonly EventMarket[], nowSec: number): EventMarket | null {
  const live = markets.filter((m) => m.kind !== "event" && !m.voided && m.expirySec > nowSec);
  const trading = live.filter((m) => m.tradingStartSec <= nowSec && nowSec < m.lockAtSec).sort((a, b) => a.expirySec - b.expirySec);
  if (trading[0]) return trading[0];
  return live.filter((m) => m.tradingStartSec > nowSec).sort((a, b) => a.tradingStartSec - b.tradingStartSec)[0] ?? null;
}

/** The lanes carrying `asset`, shortest first, deduplicated by length. */
export function lanesFor(set: LaneSet | null, asset: string): TerminalLane[] {
  const seen = new Map<number, TerminalLane>();
  for (const lane of set?.lanes ?? []) {
    if (!lane.markets.some((m) => m.asset === asset)) continue;
    if (!seen.has(lane.intervalSec)) seen.set(lane.intervalSec, { intervalSec: lane.intervalSec, label: formatCadence(lane.intervalSec) });
  }
  return [...seen.values()].sort((a, b) => a.intervalSec - b.intervalSec);
}

export function useTerminalWindow(asset: string, wantIntervalSec: number | null, nowSec: number): TerminalWindow {
  const venue = useVenue();
  const reading = useLanes(venue.venueId);
  const set = reading && reading.ok ? reading.value : null;
  return useMemo(() => {
    const lanes = lanesFor(set, asset);
    const intervalSec = lanes.some((l) => l.intervalSec === wantIntervalSec) ? wantIntervalSec : (lanes[0]?.intervalSec ?? null);
    const markets = (set?.lanes ?? []).filter((l) => l.intervalSec === intervalSec).flatMap((l) => l.markets.filter((m) => m.asset === asset));
    return {
      set,
      lanes,
      intervalSec,
      market: intervalSec === null ? null : pickWindow(markets, nowSec),
      loading: reading === null || (reading.ok === false && set === null && !venue.venueFailure && venue.venueId === null),
      failure: venue.venueFailure ? venue.venueFailure.technical : reading && !reading.ok ? reading.error.technical : null,
    };
    // `nowSec` ticks every second; the pick is cheap.
  }, [set, asset, wantIntervalSec, nowSec, reading, venue.venueFailure, venue.venueId]);
}
