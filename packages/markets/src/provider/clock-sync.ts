/**
 * The ledger clock (first-call.md §2.2). On Canton the venue's clock source is our own route (`/api/venue/clock`),
 * which answers with the server's wall clock and the ledger end it read beside it. The offset is the server's clock
 * against this device's, corrected by half the round trip (the reference's NTP-style estimate); `slot` keeps its name
 * and carries the ledger offset. A route that cannot answer is the honest error reading, and `nowMs()` stays device
 * time until one does.
 */
import { err, ok, type Reading } from "@agari/core/schemas";
import { diagnosis, type ClockSync } from "@agari/core/types";
import { venueClockWire, venueRequest } from "./venue-api";

export async function syncClock(): Promise<Reading<ClockSync>> {
  const sentMs = Date.now();
  const r = await venueRequest("clock", venueClockWire);
  const receivedMs = Date.now();
  if (!r.ok) return err(r.diagnosis);
  const rttMs = Math.max(0, receivedMs - sentMs);
  const offsetMs = Math.round(r.value.serverMs + rttMs / 2 - receivedMs);
  return ok({ offsetMs, rttMs, slot: r.value.offset ?? 0 }, receivedMs);
}

/**
 * Where a send's recovery search starts: the ledger offset before an actor sends, so a lost reply is found by its
 * completion rather than resent (AD-3). The field keeps the reference's name; on Canton it carries the offset.
 */
export async function readRecoveryCursor(): Promise<Reading<{ fromSlot: bigint }>> {
  const r = await venueRequest("clock", venueClockWire);
  if (!r.ok) return err(r.diagnosis);
  if (r.value.offset === null) return err(diagnosis("rpc-down", "the ledger end could not be read"));
  return ok({ fromSlot: BigInt(r.value.offset) }, Date.now());
}
