import { parseLaneKey, spotSymbolOf } from "@owarine/core/market";
import type { Address, ExitQuote, MarketId, OpenPosition } from "@owarine/core/types";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { ladderSnapshot, subscribeBook } from "../runtime/coordinator";
import { bidLevels, walkExit } from "../ops/canton/quote-walk";
import { livePnl, lotsOf, repriceLadder, type LivePnl } from "../runtime/live-exit";
import { liveSpot, subscribeSpot } from "../runtime/spot-stream";

/** Time decay moves the fair even when spot is still: re-evaluate at least this often. */
const DECAY_TICK_MS = 1_000;

export interface LivePnlView extends LivePnl {
  /** False while the ladder stream is down: the number stands on the last ladder seen. */
  live: boolean;
  /** The spot it was computed on (null: no live spot, ladder walked as published). */
  spotE8: bigint | null;
}

type PnlTarget = Pick<OpenPosition, "marketId" | "balanceUpRaw" | "balanceDownRaw" | "costBasisBase" | "decimals">;

/** The symbol whose spot prices a Window (a token lane's is its xStock), from its ladder. */
export function ladderSpotSymbol(ladder: { seriesKey: string; symbol?: string | null }): string | null {
  const lane = parseLaneKey(ladder.seriesKey);
  return lane ? spotSymbolOf(lane.symbol, lane.basis) : (ladder.symbol ?? null);
}

/** One position's live PnL, computed outside React and read by selector; for headers and lists that sum many. */
export function computeLivePnl(p: PnlTarget, nowMs = Date.now()): LivePnlView | null {
  const snap = ladderSnapshot(p.marketId);
  if (!snap) return null;
  const symbol = ladderSpotSymbol(snap.ladder);
  const spotE8 = symbol ? (liveSpot(symbol)?.priceE8 ?? null) : null;
  const out = livePnl({ ladder: snap.ladder, spotE8, nowSec: Math.floor(nowMs / 1000), upContractsRaw: p.balanceUpRaw, downContractsRaw: p.balanceDownRaw, costBasisBase: p.costBasisBase });
  return { ...out, live: snap.live, spotE8 };
}

/** The default Close tolerance: a firm price up to 2% under the live one is taken without asking (revamp plan §9). */
export const DEFAULT_SLIPPAGE_BPS = 200;

/**
 * The exit Close shows and sends, from the ladder already in memory (no read at tap time): the exit issuer's walk on the
 * re-priced ladder for `contractsRaw` of `side`, with the floor `slippageBps` under it. The venue firm-quotes its own
 * walk and answers a requote only below that floor, so any firm price inside the tolerance is taken in one tap. Null
 * when there is no ladder, the Window is not quoting, or nothing fills.
 */
export function liveExitQuote(marketId: string, side: "up" | "down", contractsRaw: bigint, decimals: number, slippageBps = DEFAULT_SLIPPAGE_BPS, nowMs = Date.now()): ExitQuote | null {
  const snap = ladderSnapshot(marketId);
  if (!snap) return null;
  const { ladder } = snap;
  const nowSec = Math.floor(nowMs / 1000);
  if (ladder.state !== "quoting" || nowSec > ladder.quotingUntilSec) return null;
  const symbol = ladderSpotSymbol(ladder);
  const levels = repriceLadder(ladder, symbol ? (liveSpot(symbol)?.priceE8 ?? null) : null, nowSec);
  const walked = walkExit(bidLevels(levels, side), lotsOf(contractsRaw, ladder.cashUnit), ladder.cashUnit);
  if (!walked) return null;
  const yesTicks = side === "up" ? walked.priceTicks : 1000 - walked.priceTicks;
  const slip = BigInt(Math.min(10_000, Math.max(0, Math.round(slippageBps))));
  return {
    contractsRaw: walked.lots * 1000n * ladder.cashUnit,
    limitPriceRaw: (BigInt(yesTicks) * 10n ** BigInt(decimals)) / 1000n,
    expectedProceedsBase: walked.proceedsBase,
    minProceedsBase: (walked.proceedsBase * (10_000n - slip)) / 10_000n,
    avgPriceBps: walked.priceTicks * 10,
  };
}

const same = (a: LivePnlView | null, b: LivePnlView | null) =>
  a === b || (a !== null && b !== null && a.exitBase === b.exitBase && a.pnlBase === b.pnlBase && a.locked === b.locked && a.live === b.live && a.fairTicks === b.fairTicks && a.fillableLots === b.fillableLots);

/**
 * Tradash's breathing PnL for one open position: what Close pays now minus the cost basis, on the venue's own ladder
 * re-priced with the live spot (runtime `live-exit.ts`). Re-evaluates on every ladder event, every spot tick of the
 * Window's symbol, and once a second; the component re-renders only when the number changed.
 */
export function useLivePnl(position: PnlTarget | null, spotSymbol?: string | null): LivePnlView | null {
  const cache = useRef<LivePnlView | null>(null);
  const key = position ? `${position.marketId}:${position.balanceUpRaw}:${position.balanceDownRaw}:${position.costBasisBase}` : null;
  const target = useRef(position);
  target.current = position;

  const subscribe = useCallback(
    (onChange: () => void) => {
      const p = target.current;
      if (!p) return () => undefined;
      let offSpot: (() => void) | null = null;
      const recompute = () => {
        // The Window's spot symbol is known once its first ladder lands; join that stream then.
        const ladder = ladderSnapshot(p.marketId)?.ladder;
        const symbol = spotSymbol ?? (ladder ? ladderSpotSymbol(ladder) : null);
        if (!offSpot && symbol) offSpot = subscribeSpot(symbol, recompute);
        const next = target.current ? computeLivePnl(target.current) : null;
        if (same(cache.current, next)) return;
        cache.current = next;
        onChange();
      };
      const offBook = subscribeBook({ marketId: p.marketId as MarketId, poolAddress: p.marketId as unknown as Address, decimals: p.decimals }, recompute);
      const timer = setInterval(recompute, DECAY_TICK_MS);
      recompute();
      return () => {
        offBook();
        offSpot?.();
        clearInterval(timer);
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the position's identity is its key
    [key, spotSymbol],
  );
  return useSyncExternalStore(
    subscribe,
    () => cache.current,
    () => null,
  );
}
