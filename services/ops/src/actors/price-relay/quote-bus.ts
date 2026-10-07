/**
 * Fresh oracle quotes, in-process: a feeder hands the PriceQuotes its post just created (cids and decoded terms) to the
 * resolver, so recording a Window's open print needs no ledger read on the hot path. Kept off the venue event bus,
 * which is also written to an events file.
 */
import type { Active, PriceQuoteC } from "@owarine/markets/ops/canton";

type Listener = (quotes: readonly Active<PriceQuoteC>[]) => void;
const listeners = new Set<Listener>();

export function emitFreshQuotes(quotes: readonly Active<PriceQuoteC>[]): void {
  if (quotes.length === 0) return;
  for (const l of listeners) {
    try {
      l(quotes);
    } catch {
      // a listener's failure never reaches the feeder
    }
  }
}

export function onFreshQuotes(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
