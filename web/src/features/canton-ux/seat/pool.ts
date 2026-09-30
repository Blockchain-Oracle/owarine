import type { SeatLeaseView } from "@agari/markets";

/** The span the pool ring is drawn against: the idle lease a seat frees on (`AGARI_SEAT_IDLE_TTL_SEC`'s default). */
export const POOL_SPAN_SEC = 900;

/**
 * What the lease answered to an explicit "Take a seat", for whichever surface asked (web's picker, the phone's sheet):
 * `seated` (a party is leased: the seat is held), `waiting` (the pool is full; the page keeps the reader's place and
 * asks again by itself), or `unseated` (no party yet and no place in line: the network is not taking seats). A refusal
 * never reaches here: the take throws with the reason.
 */
export type TakeOutcome = "seated" | "waiting" | "unseated";

export function takeOutcomeOf(view: SeatLeaseView | null): TakeOutcome {
  if (view?.kind === "leased") return "seated";
  if (view?.kind === "pool-full") return "waiting";
  return "unseated";
}

/** The pool-full plate's three facts: when the next seat frees (epoch seconds), the ring's span, and who is ahead (at least one). */
export function poolFullOf(view: Extract<SeatLeaseView, { kind: "pool-full" }>): { atSec: number | null; spanSec: number; ahead: number } {
  return { atSec: view.nextFreeAtMs === null ? null : Math.ceil(view.nextFreeAtMs / 1000), spanSec: POOL_SPAN_SEC, ahead: Math.max(1, view.position) };
}
