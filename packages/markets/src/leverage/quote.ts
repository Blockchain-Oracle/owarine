import type { LeverageQuote, LeverageRefusal } from "@agari/core/leverage";
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type Diagnosis, type MarketId, type Side } from "@agari/core/types";
import { asReading, boostCall } from "../tickets/client";

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

/**
 * A boost sized stake-first by ops (C8c): the budget the stake and multiple set walks the Window's venue ladder at one
 * price, and the cost sets the front and premium (core's leverage sizing), exactly as the firm quote will.
 */
export async function sizeLeverageForStake(marketId: MarketId, side: Side, stakeBase: bigint, leverageBps: number, _maintenanceBps?: number): Promise<Reading<LeverageQuote>> {
  return asReading(await boostCall({ op: "preview", marketId, side, stakeBase, leverageBps }), (r) => (r.kind === "preview" ? r.quote : null));
}

/**
 * By size: the stake a size needs is priced by the same stake-first walk, scaled from a one-credit probe. The boost
 * opens stake-first only, so this is for display and never sent.
 */
export async function previewLeverageOpen(marketId: MarketId, side: Side, quantityRaw: bigint, leverageBps: number, maintenanceBps?: number): Promise<Reading<LeverageQuote>> {
  const probe = await sizeLeverageForStake(marketId, side, 1_000_000n, leverageBps, maintenanceBps);
  if (!probe.ok || probe.value.quantityRaw === 0n) return probe;
  return sizeLeverageForStake(marketId, side, (quantityRaw * probe.value.stakeBase) / probe.value.quantityRaw + 1n, leverageBps, maintenanceBps);
}
