/**
 * The resolver's committee-event step (C6d, engine 0.4.0 `PM.Event`). Pure: the ledger's own counting rule mirrored, so
 * the resolver only submits when the ledger will find what it expects, and a decision per event.
 *
 *   counts      an attestation names this event's market and venue, comes from a committee member and is dated inside
 *               [closeTime, closeDeadline]; one per member is kept (earliest, then NO before YES), as `collectAttestations`.
 *   resolve     from closeTime to closeDeadline, once a quorum is counted and either every member has answered or
 *               `EVENT_ALL_MEMBERS_WAIT_SEC` has passed (a dissenting member gets that long to be heard: a YES/NO mix
 *               voids as `SourceDisagreement`, which resolving on the first two answers would hide).
 *   void        after closeDeadline (+ the void margin), with whatever was counted: the ledger names the reason.
 */
import type { Active, EventAttestationC, EventTermsC } from "@agari/markets/ops/canton";

/** How long after the close the resolver waits for every member before resolving on the quorum alone. */
export const EVENT_ALL_MEMBERS_WAIT_SEC = 300;

export function attestationCounts(e: EventTermsC, a: EventAttestationC): boolean {
  return a.marketId === e.marketId && a.venue === e.venue && e.attestors.includes(a.attestor) && a.attestedAtSec >= e.closeTimeSec && a.attestedAtSec <= e.closeDeadlineSec;
}

/** The counted attestations, one per member, in member order. */
export function eventEvidence(e: EventTermsC, attestations: readonly Active<EventAttestationC>[]): Active<EventAttestationC>[] {
  const best = new Map<string, Active<EventAttestationC>>();
  for (const a of attestations) {
    if (!attestationCounts(e, a.data)) continue;
    const have = best.get(a.data.attestor);
    const earlier = !have || a.data.attestedAtSec < have.data.attestedAtSec || (a.data.attestedAtSec === have.data.attestedAtSec && !a.data.answer && have.data.answer);
    if (earlier) best.set(a.data.attestor, a);
  }
  return [...best.values()].sort((x, y) => (x.data.attestor < y.data.attestor ? -1 : x.data.attestor > y.data.attestor ? 1 : 0));
}

export type EventAction =
  | { kind: "resolve"; why: string }
  | { kind: "void"; why: string }
  | { kind: "wait"; untilSec: number; why: string };

export function decideEvent(e: EventTermsC, counted: readonly Active<EventAttestationC>[], nowSec: number, voidMarginSec: number): EventAction {
  if (nowSec < e.closeTimeSec) return { kind: "wait", untilSec: e.closeTimeSec, why: "before the close" };
  if (nowSec > e.closeDeadlineSec) {
    const voidAt = e.closeDeadlineSec + voidMarginSec;
    return nowSec >= voidAt ? { kind: "void", why: `past the deadline with ${counted.length}/${e.quorum} counted` } : { kind: "wait", untilSec: voidAt, why: "void margin" };
  }
  if (counted.length < e.quorum) return { kind: "wait", untilSec: Math.min(e.closeDeadlineSec + voidMarginSec, nowSec + 5), why: `${counted.length}/${e.quorum} attestations` };
  const allIn = counted.length >= e.attestors.length;
  const waitUntil = Math.min(e.closeTimeSec + EVENT_ALL_MEMBERS_WAIT_SEC, e.closeDeadlineSec);
  if (allIn || nowSec >= waitUntil) return { kind: "resolve", why: `${counted.length}/${e.attestors.length} members answered` };
  return { kind: "wait", untilSec: waitUntil, why: `quorum in, waiting for every member until ${new Date(waitUntil * 1000).toISOString().slice(11, 19)}Z` };
}
