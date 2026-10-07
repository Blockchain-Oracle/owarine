/**
 * The resting call's rules on the venue's side (C7c, K-235), pure and integer.
 *
 * The fill rule is the reference's `MM_ORDER_TYPE=limit` (D-090): "a limit pair stays where fair says: it takes any
 * resting order on its side, at that order's price". The venue's ladder is fair ± half-spread on each side, best first
 * and in the bought outcome's own terms, so a call on a side crosses the venue when its own-side price reaches the best
 * level on that side, and the venue takes it AT THE CALL'S PRICE (never at its own, better one): a call at 55¢ against an
 * ask of 53¢ fills at 55¢, exactly what its owner named. What the ladder shows at those levels, up to the call's price, is
 * how deep the venue will go; a call bigger than that fills in part and the rest keeps resting.
 */
import type { BookLevel } from "@owarine/core/market";

/** The most a resting call may be filled for in one command (the issuer's own per-quote cap). */
export const DEFAULT_FILL_CAP_LOTS = 500n;

export type FillDecision = { lots: bigint; why: string };

/**
 * How many lots of a call the venue takes right now: the depth of its ladder on the call's side at or below the
 * call's own-side price, bounded by the call's lots and `capLots`. Zero (with the reason) when the ladder does not reach it.
 */
export function fillableLots(call: { priceTicks: number; lots: bigint }, levels: readonly BookLevel[], capLots: bigint = DEFAULT_FILL_CAP_LOTS): FillDecision {
  if (levels.length === 0) return { lots: 0n, why: "the venue has no depth on this side" };
  const best = levels[0]![0];
  if (call.priceTicks < best) return { lots: 0n, why: `the venue's best is ${best}, under the call's ${call.priceTicks}` };
  let depth = 0n;
  for (const [ticks, lots] of levels) {
    if (ticks > call.priceTicks) break;
    depth += lots;
  }
  let take = depth < call.lots ? depth : call.lots;
  if (take > capLots) take = capLots;
  return take > 0n ? { lots: take, why: `${take} of ${call.lots} lots cross at ${call.priceTicks}` } : { lots: 0n, why: "no depth at the call's price" };
}

/** `Rest_Expire` passes at the ledger's `expiresAt`; a second's margin covers ledger time trailing the wall clock. */
export const REST_EXPIRE_MARGIN_SEC = 1;

/** `RestOffer_Expire` needs `validUntil` plus the quotes' 5 s slack; the same margin on top. */
export const OFFER_EXPIRE_AFTER_SEC = 5 + 1;

/** An offer lives this long, at most, and never past the bell (the ledger caps it there too). */
export const OFFER_LIFE_SEC = 30;

/** An offer needs at least this long before the bell to be worth placing. */
export const MIN_OFFER_LIFE_SEC = 8;

/** Whether a call is due for the sweeper: its expiry has passed. */
export const callExpired = (expiresAtSec: number, nowSec: number): boolean => nowSec >= expiresAtSec + REST_EXPIRE_MARGIN_SEC;

/** Whether an unplaced offer is due for the sweeper. */
export const offerLapsed = (validUntilSec: number, nowSec: number): boolean => nowSec >= validUntilSec + OFFER_EXPIRE_AFTER_SEC;
