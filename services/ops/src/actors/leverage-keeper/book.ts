/**
 * The Boost book against the oracle quorum (C-OPS-09), pure: for each live position, the newest boundary of its life
 * where the Window's own oracles reached quorum, that print's median, and how far it sits from the barrier. The ticket
 * desk's keeper posts `Boost_KnockOut` from the same rule (`countedAt`, `quorumPrint`, `beyondBarrier`), so what this
 * reports is exactly what the ledger would accept.
 */
import type { PriceQuoteC, TermsC } from "@owarine/markets/ops/canton";
import type { BoostPositionC } from "@owarine/markets/ops/tickets";
import { beyondBarrier, countedAt, quorumPrint } from "../ticket-desk/keeper";

interface Row<T> {
  cid: string;
  data: T;
}

export interface BoostMark {
  cid: string;
  marketId: string;
  side: "SideUp" | "SideDown";
  barrierE8: bigint;
  /** The newest quorum print in the position's life, or null before one exists. */
  boundarySec: number | null;
  medianE8: bigint | null;
  /** Signed distance to the barrier in bps of the median: positive is safe, at or below zero is knockable. */
  distanceBps: number | null;
  knockable: boolean;
  /** A 1x boost fronts nothing and has no barrier. */
  barrierless: boolean;
}

export function markBoost(p: Row<BoostPositionC>, terms: TermsC | undefined, quotes: readonly Row<PriceQuoteC>[]): BoostMark {
  const base = { cid: p.cid, marketId: p.data.marketId, side: p.data.side as BoostMark["side"], barrierE8: p.data.barrierE8, barrierless: p.data.fronted === 0n };
  const none = { ...base, boundarySec: null, medianE8: null, distanceBps: null, knockable: false };
  if (!terms || base.barrierless) return none;
  const boundaries = [...new Set(quotes.filter((q) => q.data.symbol === terms.symbol).map((q) => q.data.boundarySec))]
    .filter((b) => b >= p.data.barrierFromSec && b < p.data.expirySec)
    .sort((a, b) => b - a);
  for (const b of boundaries) {
    const counted = countedAt(terms, b, quotes as never);
    if (counted.length < terms.quorum) continue;
    const { median, disagrees } = quorumPrint(counted, terms.maxDeviationBps);
    if (disagrees) continue;
    const gap = p.data.side === "SideUp" ? median - p.data.barrierE8 : p.data.barrierE8 - median;
    return { ...base, boundarySec: b, medianE8: median, distanceBps: Number((gap * 10_000n) / median), knockable: beyondBarrier(p.data, median) };
  }
  return none;
}

/** One line for the heartbeat: how many live boosts, the closest to its barrier, and any the quorum has already crossed. */
export function describeBook(marks: readonly BoostMark[]): string {
  const live = marks.filter((m) => !m.barrierless);
  const priced = live.filter((m) => m.distanceBps !== null).sort((a, b) => a.distanceBps! - b.distanceBps!);
  const knockable = priced.filter((m) => m.knockable);
  const closest = priced[0];
  const parts = [`${marks.length} live boost(s), ${live.length} with a barrier`];
  if (closest) parts.push(`closest ${closest.marketId} ${closest.side === "SideUp" ? "Up" : "Down"} ${closest.distanceBps} bps from its barrier`);
  if (knockable.length) parts.push(`${knockable.length} past its barrier at a quorum print: the venue's keeper knocks it out`);
  return parts.join(" · ");
}
