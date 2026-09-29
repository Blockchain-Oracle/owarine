/**
 * The seed maker, re-meant for Canton (plan "Venue operations": the fair-value math, unchanged, becomes the pricer; its
 * `quote.ts` becomes the issuer). There are no resting orders: the maker publishes the venue price ladder per Window
 * (`pricer.ts`) and the quote issuer (`../../quote-issuer`) turns one walk of it into a firm `Quote` on request.
 * Gap and token lanes keep `lane-quote.ts` for C6; the crypto lanes price on spot against the recorded open print.
 */
import type { VenueDeps } from "../../../runtime";
import { createVenueContext, type VenueContext } from "../../venue/context";
import { createLadderBoard, type LadderBoard } from "./ladder-board";
import { readPricerSettings, startPricer } from "./pricer";

export { createLadderBoard, toWireLadder, type LadderBoard, type LadderEntry, type WireLadder } from "./ladder-board";
export { readPricerSettings, type PricerSettings } from "./pricer";

export async function startSeedMaker(deps: VenueDeps, board: LadderBoard = createLadderBoard(), venue: VenueContext = createVenueContext()): Promise<{ stop: () => void; board: LadderBoard }> {
  const session = venue.session("venue");
  if (!session) {
    deps.log("VENUE_PARTY and the parties file are missing: the pricer has no venue to read");
    return { stop: () => {}, board };
  }
  const { stop } = startPricer({ venue: session, spot: deps.spot, board, log: deps.log, settings: readPricerSettings(), halts: () => deps.halts.board() });
  return { stop, board };
}
