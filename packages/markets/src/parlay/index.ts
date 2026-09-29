/** The parlay reserve on Canton (C8). Until it is on the participant: empty reads, a not-live quote, refused writes. */
import type { ParlayDeployment, ParlayIntent } from "@agari/core/parlay";
import type { PhaseListener } from "@agari/core/ports";
import type { MarketsEnv } from "../env";
import { refusedFor } from "../stub/product";
import { PARLAY_NOT_LIVE } from "./reads";
import type { ParlayOpenOutcome, ParlayTxContext } from "./types";

export { getParlay, getParlayReserveState, getParlaySharesOf, listParlaysOf } from "./reads";
export { quoteParlayOnchain } from "./quote";
export { submitParlayOpenWrite, submitParlayTx } from "./writes";
export type { ParlayOpenOutcome, ParlayTxContext } from "./types";

/** No parlay package on the participant yet. */
export function resolveParlayDeployment(_env?: Partial<MarketsEnv>): ParlayDeployment | null {
  return null;
}

/** The open without a session refuses rather than pretend; nothing is journaled or signed. */
export async function submitParlayOpen(_ctx: ParlayTxContext, _intent: Extract<ParlayIntent, { kind: "parlay-open" }>, _onPhase?: PhaseListener): Promise<ParlayOpenOutcome> {
  return refusedFor(PARLAY_NOT_LIVE);
}
