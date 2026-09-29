/**
 * The ledger clock (first-call.md §2.2). On Canton the venue's clock source is the server's clock measured against
 * ledger time (a route handler that reads both), which lands with the adapter. Until then the clock fact is the honest
 * not-deployed answer and `nowMs()` stays device time with no offset (the reference's D-015 rule).
 */
import type { Reading } from "@agari/core/schemas";
import type { ClockSync } from "@agari/core/types";
import { cantonNotLive, notDeployedReading } from "../stub/not-deployed";

export async function syncClock(): Promise<Reading<ClockSync>> {
  return notDeployedReading(cantonNotLive("ledger clock"));
}

/**
 * Where a send's recovery search starts: the ledger offset before an actor sends, so a lost reply is found by its
 * completion rather than resent (AD-3). The field keeps the reference's name; on Canton it carries the offset.
 */
export async function readRecoveryCursor(): Promise<Reading<{ fromSlot: bigint }>> {
  return notDeployedReading(cantonNotLive("ledger offset"));
}
