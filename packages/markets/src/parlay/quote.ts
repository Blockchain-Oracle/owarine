import type { ParlayLegInput, ParlayMode, ParlayParams, ParlayQuote } from "@agari/core/parlay";
import type { Reading } from "@agari/core/schemas";
import { asReading, parlayCall } from "../tickets/client";

/** The ticket the reserve would sell (C8c): ops prices every leg off its Window's venue ladder with core's `quoteParlay`. */
export async function quoteParlayOnchain(legs: readonly ParlayLegInput[], mode: ParlayMode, _params: ParlayParams): Promise<Reading<ParlayQuote>> {
  return asReading(await parlayCall({ op: "preview", legs: legs.map((l) => ({ marketId: l.marketId, side: l.side })), mode }), (r) => (r.kind === "preview" ? r.quote : null));
}
