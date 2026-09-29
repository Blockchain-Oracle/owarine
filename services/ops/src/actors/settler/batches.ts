/**
 * How the settler cuts one market's legs into `Desk_SettleBatch` calls (review B6): the legs that pay users first, then
 * the users' losing legs, then the venue's own; `size` legs a batch. Pure.
 */
import type { Active, LegC, ResolutionC } from "@agari/markets/ops/canton";

export const DEFAULT_BATCH = 25;

/** 0: a user leg that pays (winner or void refund), 1: a user leg that pays nothing, 2: a venue leg. */
export function settleRank(l: LegC, r: ResolutionC, venue: string): number {
  if (l.owner === venue) return 2;
  if (r.outcome === null || r.outcome === l.outcome) return 0;
  return 1;
}

export function planBatches(legs: readonly Active<LegC>[], r: ResolutionC, venue: string, size = DEFAULT_BATCH): string[][] {
  const ordered = [...legs].sort((a, b) => settleRank(a.data, r, venue) - settleRank(b.data, r, venue) || (a.cid < b.cid ? -1 : 1));
  const out: string[][] = [];
  for (let i = 0; i < ordered.length; i += size) out.push(ordered.slice(i, i + size).map((l) => l.cid));
  return out;
}

/** What a user leg is paid under a resolution (base units), for logs: void refunds backing + fee, a winner the pair. */
export function payoutOf(l: LegC, r: ResolutionC): bigint {
  if (r.outcome === null) return l.backingShare + l.feePaid;
  return r.outcome === l.outcome ? l.lots * 1000n * l.cashUnit : 0n;
}
