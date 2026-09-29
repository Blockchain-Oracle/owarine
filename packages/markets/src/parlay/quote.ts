import type { ParlayLegInput, ParlayMode, ParlayParams, ParlayQuote } from "@agari/core/parlay";
import type { Reading } from "@agari/core/schemas";
import { unavailableFor } from "../stub/product";
import { PARLAY_NOT_LIVE } from "./reads";

/** The ticket the reserve would sell: it needs the reserve and each leg's venue ladder (C8), so it is not-live until then. */
export function quoteParlayOnchain(_legs: readonly ParlayLegInput[], _mode: ParlayMode, _params: ParlayParams): Promise<Reading<ParlayQuote>> {
  return unavailableFor(PARLAY_NOT_LIVE);
}
