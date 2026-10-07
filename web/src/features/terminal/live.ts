"use client";

import type { Address, MarketId } from "@owarine/core/types";
import { computeLivePnl, ladderSpotSymbol, type LivePnlView } from "@owarine/markets/react";
import { ladderSnapshot, liveSpot, livePnl, subscribeBook, subscribeSpot } from "@owarine/markets/runtime";
import { useEffect, useRef, useState } from "react";

/** Tradash commits prices to its store at most every 200 ms per symbol (leading edge); PnL and reactions run on that. */
export const COMMIT_MS = 200;

/** The symbol's spot as a number, committed at most every 200 ms (leading edge, plus the last tick after a quiet gap). */
export function useCommittedSpot(symbol: string | null): number | null {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    if (!symbol) return setPrice(null);
    let last = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      const tick = liveSpot(symbol);
      return tick ? Number(tick.priceE8) / 1e8 : null;
    };
    const commit = () => {
      last = performance.now();
      setPrice(read());
    };
    const off = subscribeSpot(symbol, () => {
      const wait = last + COMMIT_MS - performance.now();
      if (wait <= 0) commit();
      else trailing ??= setTimeout(() => ((trailing = null), commit()), wait);
    });
    commit();
    return () => {
      off();
      if (trailing) clearTimeout(trailing);
    };
  }, [symbol]);
  return price;
}

/** What the live book values: the ledger shape `computeLivePnl` takes, keyed by an id. */
export interface ValuedPosition {
  id: string;
  marketId: string;
  balanceUpRaw: bigint;
  balanceDownRaw: bigint;
  costBasisBase: bigint;
  decimals: number;
}

/**
 * Every open position's live value at 5 Hz (Tradash's commit rate), keeping each one's ladder and spot stream open. The
 * map is replaced only when a number changed, so a quiet book does not re-render.
 */
export function useLiveBook(positions: readonly ValuedPosition[]): ReadonlyMap<string, LivePnlView> {
  const [book, setBook] = useState<ReadonlyMap<string, LivePnlView>>(() => new Map());
  const list = useRef(positions);
  list.current = positions;
  const key = positions.map((p) => `${p.id}:${p.marketId}:${p.balanceUpRaw}:${p.balanceDownRaw}:${p.costBasisBase}`).join("|");

  useEffect(() => {
    const offs: Array<() => void> = [];
    const spotSubs = new Set<string>();
    for (const p of list.current) offs.push(subscribeBook({ marketId: p.marketId as MarketId, poolAddress: p.marketId as unknown as Address, decimals: p.decimals }, () => undefined));
    const tick = () => {
      const next = new Map<string, LivePnlView>();
      let changed = false;
      for (const p of list.current) {
        const snap = ladderSnapshot(p.marketId);
        const symbol = snap ? ladderSpotSymbol(snap.ladder) : null;
        if (symbol && !spotSubs.has(symbol)) {
          spotSubs.add(symbol);
          offs.push(subscribeSpot(symbol, () => undefined));
        }
        const view = computeLivePnl({ ...p, marketId: p.marketId as MarketId });
        if (view) next.set(p.id, view);
      }
      setBook((prev) => {
        if (prev.size !== next.size) changed = true;
        else for (const [id, v] of next) {
          const o = prev.get(id);
          if (!o || o.exitBase !== v.exitBase || o.pnlBase !== v.pnlBase || o.locked !== v.locked || o.live !== v.live) {
            changed = true;
            break;
          }
        }
        return changed ? next : prev;
      });
    };
    tick();
    const id = setInterval(tick, COMMIT_MS);
    return () => {
      clearInterval(id);
      offs.forEach((off) => off());
    };
  }, [key]);
  return book;
}

/**
 * The spot at which Close would pay the position's cost back (its break-even), by bisection on the venue's re-priced
 * ladder: PnL rises with spot for Up and falls for Down. Null when the ladder carries no price model, Close cannot fill,
 * or no spot within ±10 % breaks even.
 */
export function breakEvenSpot(p: ValuedPosition, side: "up" | "down", spot: number, nowSec: number): number | null {
  const snap = ladderSnapshot(p.marketId);
  if (!snap || typeof snap.ladder.sigmaBps !== "number" || !(spot > 0)) return null;
  const pnlAt = (s: number) =>
    livePnl({ ladder: snap.ladder, spotE8: BigInt(Math.round(s * 1e8)), nowSec, upContractsRaw: p.balanceUpRaw, downContractsRaw: p.balanceDownRaw, costBasisBase: p.costBasisBase });
  let lo = spot * 0.9;
  let hi = spot * 1.1;
  const sign = side === "up" ? 1 : -1;
  const f = (s: number) => {
    const r = pnlAt(s);
    return r.fillableLots === 0n ? null : Number(r.pnlBase) * sign;
  };
  const fLo = f(lo);
  const fHi = f(hi);
  if (fLo === null || fHi === null || fLo > 0 || fHi < 0) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (v === null) return null;
    if (v < 0) lo = mid;
    else hi = mid;
  }
  return hi;
}
