import type { LeverageQuote, LeverageRefusal } from "@agari/core/leverage";
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type Diagnosis, type MarketId, type Side } from "@agari/core/types";
import { unavailableFor } from "../stub/product";
import { LEVERAGE_NOT_LIVE } from "./deployment";

/** A refusal in the ticket's words. The reserve's own policy is one kind; the venue's ladder is another. */
export function refusalDiagnosis(refusal: LeverageRefusal): Diagnosis {
  switch (refusal.kind) {
    case "zero":
      return diagnosis("below-min-quantity", "the amount is zero");
    case "below-min":
      return diagnosis("below-min-quantity", `this stake buys ${refusal.quantityRaw}, under the venue's minimum ${refusal.minQuantityRaw}`);
    case "bad-leverage":
      return diagnosis("reserve-cap", `the reserve boosts above 1x and up to ${refusal.maxLeverageBps / 10_000}x`);
    case "too-late":
      return diagnosis("market-not-trading", `${refusal.leftSec}s left; boosts close ${refusal.minSec}s before the Window ends`);
    case "thin-book":
      return diagnosis("thin-book", `${refusal.filledRaw} of the ${refusal.quantityRaw} this stake buys is on offer`);
    case "thin-exit":
      return diagnosis("thin-book", `rested orders would take ${refusal.filledRaw} of ${refusal.quantityRaw} back: the position could not be sold whole`);
    case "unhealthy":
      return diagnosis("thin-book", `the spread is too wide: the position would mark at ${refusal.markBase}, under its knock-out line ${refusal.lineBase}, the moment it opened`);
    case "outside-band":
      return diagnosis("outside-band", `entry ${refusal.priceRaw} is outside the reserve's band ${refusal.minRaw}–${refusal.maxRaw}`);
    case "underpriced":
      return diagnosis("outside-band", "at this price a boost would pay no more than the plain bet");
    case "void-short":
      return diagnosis("outside-band", `at this price the front (${refusal.frontedBase}) is more than a voided Window would pay back (${refusal.voidPayoutBase}); a lower multiple fits`);
    case "liquidity":
      return diagnosis("reserve-cap", `the reserve has ${refusal.haveBase} liquid and this boost needs ${refusal.needBase}`);
    case "position-cap":
      return diagnosis("reserve-cap", `front ${refusal.frontedBase} is over the per-position cap ${refusal.capBase}`);
    case "window-cap":
      return diagnosis("reserve-cap", `this Window would carry ${refusal.frontedBase} fronted, over its cap ${refusal.capBase}`);
    case "exposure":
      return diagnosis("reserve-cap", `${refusal.outstandingBase} fronted of ${refusal.totalBase} is over the reserve's ${refusal.maxBps / 100}% limit`);
    case "too-many-open":
      return diagnosis("reserve-cap", `the reserve already carries its ${refusal.max} open positions`);
  }
}

/** Sizing a boost needs the reserve and the venue ladder (C8); until then the ticket states not-live. */
export function sizeLeverageForStake(_marketId: MarketId, _side: Side, _stakeBase: bigint, _leverageBps: number, _maintenanceBps?: number): Promise<Reading<LeverageQuote>> {
  return unavailableFor(LEVERAGE_NOT_LIVE);
}

export function previewLeverageOpen(_marketId: MarketId, _side: Side, _quantityRaw: bigint, _leverageBps: number, _maintenanceBps?: number): Promise<Reading<LeverageQuote>> {
  return unavailableFor(LEVERAGE_NOT_LIVE);
}
