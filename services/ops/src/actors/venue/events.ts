/**
 * An in-process record of what the venue actors did, for the local drive runner's per-Window table and for `/health`
 * detail. Nothing reads it to decide anything: every actor reconciles from the ledger.
 */
export type VenueEvent =
  | { kind: "opened"; marketId: string; termsCid: string; atMs: number }
  | { kind: "printed"; oracle: string; boundarySec: number; symbols: string[]; atMs: number }
  | { kind: "open-recorded"; marketId: string; openPriceE8: string; signers: number; atMs: number }
  | { kind: "resolved"; marketId: string; outcome: string; openPriceE8: string | null; closePriceE8: string | null; signers: number; atMs: number }
  | { kind: "voided"; marketId: string; reason: string; atMs: number }
  | { kind: "quoted"; marketId: string; quoteCid: string; side: string; lots: string; priceTicks: number; issueMs: number; atMs: number }
  | { kind: "settled"; marketId: string; legs: number; batches: number; ms: number; atMs: number }
  | { kind: "expired"; marketId: string; quoteCid: string; atMs: number };

type Listener = (e: VenueEvent) => void;
const listeners = new Set<Listener>();

export function emitVenueEvent(e: VenueEvent): void {
  for (const l of listeners) {
    try {
      l(e);
    } catch {
      // a listener's failure never reaches an actor
    }
  }
}

export function onVenueEvent(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
