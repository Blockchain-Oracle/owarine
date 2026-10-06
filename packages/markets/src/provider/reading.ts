import { err, ok, stale, type Reading, type ReadingOk, type StaleReason } from "@agari/core/schemas";
import { diagnose } from "../errors/error-map";
import { ReadingError } from "../errors/reading-error";
import { nowMs } from "./clock";

const lastGood = new Map<string, ReadingOk<unknown>>();

/** Unwraps an inner reading inside a composed read: an error arm aborts the outer read with the inner diagnosis. */
export type Unwrap = <U>(reading: Reading<U>) => U;

/** Standalone unwrap for code outside `withReading` (e.g. Submitter steps): throws a `ReadingError` on the error arm. */
export function unwrap<U>(reading: Reading<U>): U {
  if (!reading.ok) throw new ReadingError(reading.error);
  return reading.value;
}

/**
 * A refusal of who is asking, not an outage: the seat this read belonged to is gone (its holder reset it, its lease
 * ended) or was never this client's. Its last value is someone else's money now, so it is never shown again (C4f).
 */
const NOT_YOURS: ReadonlySet<string> = new Set(["signer-required"]);

/**
 * The one place staleness is decided (AD-6): a first-ever failure is the error arm; a failed refresh
 * keeps the last-good value at full value and flips `stale`; a read composed from a stale inner
 * reading is itself stale. A refresh refused as `signer-required` is the error arm and forgets the
 * last-good value: a seat that is gone never shows its money.
 */
export async function withReading<T>(key: string, read: (inner: Unwrap) => Promise<T>): Promise<Reading<T>> {
  let innerStale: StaleReason | null = null;
  const inner: Unwrap = (reading) => {
    if (!reading.ok) throw new ReadingError(reading.error);
    if (reading.stale) innerStale ??= reading.staleReason ?? "aged";
    return reading.value;
  };
  try {
    const fresh = ok(await read(inner), nowMs());
    lastGood.set(key, fresh);
    return innerStale ? stale(fresh, innerStale) : fresh;
  } catch (error) {
    const diagnosis = diagnose(error);
    if (NOT_YOURS.has(diagnosis.kind)) {
      lastGood.delete(key);
      return err(diagnosis);
    }
    const previous = lastGood.get(key) as ReadingOk<T> | undefined;
    return previous ? stale(previous, "refresh-failed") : err(diagnosis);
  }
}

export function forgetReading(key: string): void {
  lastGood.delete(key);
}
