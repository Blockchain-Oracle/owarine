"use client";

import type { EventMarket, Side } from "@owarine/core/types";
import { useLanes } from "@owarine/markets/react";
import { ladderSnapshot, liveSpot, livePnl, repriceLadder, walkStake } from "@owarine/markets/runtime";
import { useEffect, useRef, useState } from "react";
import { useVenue } from "@/features/markets/useVenue";
import type { ChartOverlay } from "@/features/terminal/chart/LiveChart";
import { livePnlText } from "@/features/terminal/format";
import { pickWindow } from "@/features/terminal/useTerminalWindow";

/** The markets the hero may run, most familiar first; the first with a quoted Window and a fresh price wins. */
const CANDIDATES = ["BTC", "ETH", "CC"] as const;
const FRESH_SEC = 20;
const PAIR = 1000n;
/** A paper stake of 10 credits: big enough to read, small enough to fill on any ladder. */
const STAKE_BASE = 10_000_000n;
const DECIMALS = 6;
/** The loop: look at the market, tap, ride it, bank it, rest. */
const LOOK_MS = 2_600;
const RIDE_MS = 9_000;
const BANK_MS = 2_800;

const quoting = (marketId: string, nowSec: number) => {
  const l = ladderSnapshot(marketId)?.ladder;
  return l !== undefined && l.state === "quoting" && nowSec <= l.quotingUntilSec;
};
const fresh = (symbol: string, nowSec: number) => {
  const t = liveSpot(symbol);
  return t !== null && nowSec - t.publishTimeSec <= FRESH_SEC;
};

/** The hero's market: the first candidate whose Window is quoted and whose spot is live; it stays put while it still is. */
export function useHeroMarket(nowSec: number): { symbol: string; market: EventMarket | null } {
  const { venueId } = useVenue();
  const reading = useLanes(venueId);
  const sticky = useRef<string>(CANDIDATES[0]);
  const set = reading && reading.ok ? reading.value : null;
  const windowOf = (symbol: string): EventMarket | null => {
    const lanes = (set?.lanes ?? []).filter((l) => l.markets.some((m) => m.asset === symbol && m.kind !== "event")).sort((a, b) => a.intervalSec - b.intervalSec);
    const shortest = lanes[0];
    if (!shortest) return null;
    const markets = lanes.filter((l) => l.intervalSec === shortest.intervalSec).flatMap((l) => l.markets.filter((m) => m.asset === symbol));
    return pickWindow(markets, nowSec, (id) => quoting(id, nowSec));
  };
  const good = (symbol: string) => {
    const m = windowOf(symbol);
    return m !== null && quoting(m.marketId, nowSec) && fresh(symbol, nowSec);
  };
  if (!good(sticky.current)) sticky.current = CANDIDATES.find(good) ?? sticky.current;
  return { symbol: sticky.current, market: windowOf(sticky.current) };
}

export type GhostPhase = "look" | "ride" | "bank" | "idle";

export interface Ghost {
  phase: GhostPhase;
  side: Side;
  /** The PnL of the ride (credits): live while riding, banked after. */
  pnl: number;
  pnlText: string;
  /** What a right call pays at the price the ride opened at. */
  multiple: number | null;
}

/**
 * A paper trade the hero runs on its own, on the venue's live ladder and the live spot: the demo's own math (a stake
 * walked over the ladder re-priced at the spot; PnL is what closing would pay). The side follows the last ten seconds'
 * move. Nothing is placed anywhere; it is the trading screen's demo mode, playing itself.
 */
export function useGhostTrade(market: EventMarket | null, spotSymbol: string, overlay: React.RefObject<ChartOverlay | null>): Ghost {
  const [ghost, setGhost] = useState<Ghost>({ phase: "idle", side: "up", pnl: 0, pnlText: "+0.0000", multiple: null });
  const trail = useRef<Array<[number, number]>>([]);
  const marketId = market?.marketId ?? null;

  useEffect(() => {
    if (!marketId) {
      overlay.current = null;
      setGhost((g) => ({ ...g, phase: "idle" }));
      return;
    }
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ticker: ReturnType<typeof setInterval> | null = null;
    const spotNow = () => {
      const t = liveSpot(spotSymbol);
      return t ? Number(t.priceE8) / 1e8 : null;
    };
    const sample = setInterval(() => {
      const s = spotNow();
      if (s === null) return;
      trail.current.push([Date.now(), s]);
      while (trail.current.length && trail.current[0]![0] < Date.now() - 12_000) trail.current.shift();
    }, 500);

    const look = () => {
      if (stop) return;
      overlay.current = null;
      const first = trail.current[0]?.[1];
      const last = trail.current.at(-1)?.[1];
      const side: Side = first !== undefined && last !== undefined && last < first ? "down" : "up";
      setGhost({ phase: "look", side, pnl: 0, pnlText: "+0.0000", multiple: null });
      timer = setTimeout(() => ride(side), LOOK_MS);
    };

    const ride = (side: Side) => {
      if (stop) return;
      const snap = ladderSnapshot(marketId);
      const nowSec = Math.floor(Date.now() / 1000);
      const spot = spotNow();
      if (!snap || !quoting(marketId, nowSec) || spot === null) {
        setGhost((g) => ({ ...g, phase: "idle" }));
        timer = setTimeout(look, LOOK_MS);
        return;
      }
      const spotE8 = BigInt(Math.round(spot * 1e8));
      const levels = repriceLadder(snap.ladder, spotE8, nowSec);
      const walked = walkStake(side === "up" ? levels.up : levels.down, STAKE_BASE, snap.ladder.cashUnit, 0, { minLots: 1n });
      if (!walked) {
        timer = setTimeout(look, LOOK_MS);
        return;
      }
      const contracts = walked.lots * PAIR * snap.ladder.cashUnit;
      const entry = spot;
      const multiple = walked.priceTicks > 0 ? 1000 / walked.priceTicks : null;
      const tick = () => {
        const s = ladderSnapshot(marketId);
        const sp = spotNow();
        if (!s || sp === null) return;
        const p = livePnl({
          ladder: s.ladder, spotE8: BigInt(Math.round(sp * 1e8)), nowSec: Math.floor(Date.now() / 1000),
          upContractsRaw: side === "up" ? contracts : 0n, downContractsRaw: side === "down" ? contracts : 0n, costBasisBase: walked.costBase,
        });
        const pnl = Number(p.pnlBase) / 10 ** DECIMALS;
        const pnlText = livePnlText(p.pnlBase, DECIMALS);
        overlay.current = { pnl, pnlText, entry, levels: [{ kind: "entry", price: entry, label: "Entry" }] };
        setGhost({ phase: "ride", side, pnl, pnlText, multiple });
      };
      tick();
      ticker = setInterval(tick, 200);
      timer = setTimeout(() => {
        if (ticker) clearInterval(ticker);
        ticker = null;
        overlay.current = null;
        setGhost((g) => ({ ...g, phase: "bank" }));
        timer = setTimeout(look, BANK_MS);
      }, RIDE_MS);
    };

    look();
    return () => {
      stop = true;
      clearInterval(sample);
      if (timer) clearTimeout(timer);
      if (ticker) clearInterval(ticker);
      overlay.current = null;
    };
  }, [marketId, spotSymbol, overlay]);

  return ghost;
}
