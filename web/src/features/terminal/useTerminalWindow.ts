"use client";

import { formatCadence } from "@owarine/core/copy";
import { noEntryCutoffSec } from "@owarine/core/lifecycle";
import type { EventMarket, LaneSet } from "@owarine/core/types";
import { ladderSpotSymbol, useLanes } from "@owarine/markets/react";
import { ladderSnapshot, liveSpot } from "@owarine/markets/runtime";
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

/**
 * The Window to trade; price Windows only (events open in /markets). A staggered lane has two Windows trading at once
 * (`BTC-2m` and `BTC-2m_1`): the one the venue is quoting with the most time left wins, so the screen moves to the
 * newer Window as soon as it is priced and before the older one's cut-off. With none quoting, the trading Window that
 * closes first (it is the one about to be priced or settled); else the soonest still to start.
 */
export function pickWindow(markets: readonly EventMarket[], nowSec: number, isQuoting: (marketId: string) => boolean = () => false, hasSpot: (marketId: string) => boolean = () => true): EventMarket | null {
  const live = markets.filter((m) => m.kind !== "event" && !m.voided && m.expirySec > nowSec);
  const trading = live.filter((m) => m.tradingStartSec <= nowSec && nowSec < noEntryCutoffSec(m)).sort((a, b) => a.expirySec - b.expirySec);
  // A Window the screen can't draw (no live spot for what it settles on, e.g. an xStock while its price source is down)
  // only wins when nothing else is quoted: TSLA's stock Window beats its TSLAx token Window then.
  const quoting = trading.filter((m) => isQuoting(m.marketId)).sort((a, b) => Number(hasSpot(a.marketId)) - Number(hasSpot(b.marketId)) || a.expirySec - b.expirySec);
  if (quoting.length) return quoting.at(-1)!;
  if (trading[0]) return trading[0];
  // Keep the just-closed entry period visible until this round expires. Otherwise the terminal jumps to a future
  // round and says "opening soon" even though the round the user was watching is still counting down.
  const closing = live.filter((m) => m.tradingStartSec <= nowSec).sort((a, b) => a.expirySec - b.expirySec);
  if (closing[0]) return closing[0];
  return live.filter((m) => m.tradingStartSec > nowSec).sort((a, b) => a.tradingStartSec - b.tradingStartSec)[0] ?? null;
}

/** The lanes carrying `asset` with a Window still to trade, shortest first, deduplicated by length (a retired lane goes). */
export function lanesFor(set: LaneSet | null, asset: string, nowSec = Math.floor(Date.now() / 1000)): TerminalLane[] {
  const seen = new Map<number, TerminalLane>();
  for (const lane of set?.lanes ?? []) {
    if (!lane.markets.some((m) => m.asset === asset && m.kind !== "event" && !m.voided && m.expirySec > nowSec)) continue;
    if (!seen.has(lane.intervalSec)) seen.set(lane.intervalSec, { intervalSec: lane.intervalSec, label: formatCadence(lane.intervalSec) });
  }
  return [...seen.values()].sort((a, b) => a.intervalSec - b.intervalSec);
}

/** On first visit, use the shortest cadence that can take a call now; a longer quoted crypto round bridges a new short round's opening print. */
export function defaultInterval(markets: readonly EventMarket[], lanes: readonly TerminalLane[], nowSec: number, isQuoting: (marketId: string) => boolean): number | null {
  for (const lane of lanes) {
    const selected = pickWindow(markets.filter((m) => m.intervalSec === lane.intervalSec), nowSec, isQuoting);
    if (selected && isQuoting(selected.marketId)) return lane.intervalSec;
  }
  return lanes[0]?.intervalSec ?? null;
}

export function useTerminalWindow(asset: string, wantIntervalSec: number | null, nowSec: number): TerminalWindow {
  const venue = useVenue();
  const reading = useLanes(venue.venueId);
  const set = reading && reading.ok ? reading.value : null;
  return useMemo(() => {
    const lanes = lanesFor(set, asset, nowSec);
    const assetMarkets = (set?.lanes ?? []).flatMap((l) => l.markets.filter((m) => m.asset === asset));
    const isQuoting = (id: string) => {
      const ladder = ladderSnapshot(id)?.ladder;
      return ladder !== undefined && ladder.state === "quoting" && nowSec <= ladder.quotingUntilSec;
    };
    const intervalSec = lanes.some((l) => l.intervalSec === wantIntervalSec) ? wantIntervalSec : defaultInterval(assetMarkets, lanes, nowSec, isQuoting);
    const markets = assetMarkets.filter((m) => m.intervalSec === intervalSec);
    return {
      set,
      lanes,
      intervalSec,
      market: intervalSec === null ? null : pickWindow(
        markets,
        nowSec,
        isQuoting,
        (id) => {
          const l = ladderSnapshot(id)?.ladder;
          const sym = l ? ladderSpotSymbol(l) : null;
          return sym !== null && liveSpot(sym) !== null;
        },
      ),
      loading: reading === null || (reading.ok === false && set === null && !venue.venueFailure && venue.venueId === null),
      failure: venue.venueFailure ? venue.venueFailure.technical : reading && !reading.ok ? reading.error.technical : null,
    };
    // `nowSec` ticks every second; the pick is cheap.
  }, [set, asset, wantIntervalSec, nowSec, reading, venue.venueFailure, venue.venueId]);
}
