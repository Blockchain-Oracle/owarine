/**
 * Which oracle quotes the resolver offers for one slot of one Window: the ledger's own `counts` rule (`PM/Oracle.daml`),
 * mirrored so the resolver only submits when the ledger will find a quorum, and offers exactly the quotes it will
 * count (one per oracle, the earliest fetch, then the lowest price). Pure.
 */
import type { Active, PriceQuoteC, TermsC } from "@agari/markets/ops/canton";

export type Slot = "open" | "close";

export interface SlotRule {
  symbol: string;
  boundarySec: number;
  oracles: readonly string[];
  barLenSec: number;
  policyVersion: number;
  earliestSec: number;
  /** Inclusive admission deadline. */
  deadlineSec: number;
}

export function slotRule(t: TermsC, slot: Slot): SlotRule {
  const boundarySec = slot === "open" ? t.tradingStartSec : t.expirySec;
  return {
    symbol: t.symbol, boundarySec, oracles: t.oracles, barLenSec: t.barLenSec, policyVersion: t.policyVersion,
    earliestSec: boundarySec + t.minDelaySec, deadlineSec: slot === "open" ? t.openDeadlineSec : t.closeDeadlineSec,
  };
}

export const counts = (r: SlotRule, q: PriceQuoteC): boolean =>
  q.symbol === r.symbol && q.boundarySec === r.boundarySec && r.oracles.includes(q.oracle) && q.barLenSec === r.barLenSec
  && q.policyVersion === r.policyVersion && q.fetchedAtSec >= r.earliestSec && q.fetchedAtSec <= r.deadlineSec;

/** The counted quotes, one per oracle (earliest fetch, then lowest price), in oracle order. */
export function evidenceFor(r: SlotRule, quotes: readonly Active<PriceQuoteC>[]): Active<PriceQuoteC>[] {
  const best = new Map<string, Active<PriceQuoteC>>();
  for (const q of quotes) {
    if (!counts(r, q.data)) continue;
    const have = best.get(q.data.oracle);
    if (!have || q.data.fetchedAtSec < have.data.fetchedAtSec || (q.data.fetchedAtSec === have.data.fetchedAtSec && q.data.priceE8 < have.data.priceE8)) best.set(q.data.oracle, q);
  }
  return [...best.values()].sort((a, b) => (a.data.oracle < b.data.oracle ? -1 : a.data.oracle > b.data.oracle ? 1 : 0));
}

/** Lower median of the counted prices (the ledger's `medianOf`), for logs; the ledger computes its own. */
export function lowerMedian(prices: readonly bigint[]): bigint | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}
