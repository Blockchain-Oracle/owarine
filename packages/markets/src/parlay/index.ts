/** The parlay reserve on Canton (C8c): reads, prices and writes through `/api/ledger/tickets/*`. */
import type { ParlayDeployment, ParlayIntent } from "@owarine/core/parlay";
import type { PhaseListener } from "@owarine/core/ports";
import type { MarketsEnv } from "../env";
import { nowMs } from "../provider/clock";
import { allowAllStopGate } from "../submitter/stop-gate";
import { reserveAddressOf } from "../tickets/client";
import type { ParlayOpenOutcome, ParlayTxContext } from "./types";
import { parlayOpenLane } from "./writes";

export { getParlay, getParlayReserveState, getParlaySharesOf, listParlaysOf, PARLAY_NOT_LIVE } from "./reads";
export { quoteParlayOnchain } from "./quote";
export { parlayOpenLane, parlayTxLane, submitParlayOpenWrite, submitParlayTx } from "./writes";
export type { ParlayOpenOutcome, ParlayTxContext } from "./types";

/** The parlay reserve's id on Canton (derived; whether it is live is `getParlayReserveState`). */
export function resolveParlayDeployment(_env?: Partial<MarketsEnv>): ParlayDeployment | null {
  return { chainId: 0, parlayReserve: reserveAddressOf("parlay"), fromBlock: 0n };
}

/** The open outside a session's submitter (scripts): the same ticket lane, journaled in `ctx.journal`, no daily stop. */
export function submitParlayOpen(ctx: ParlayTxContext, intent: Extract<ParlayIntent, { kind: "parlay-open" }>, onPhase?: PhaseListener): Promise<ParlayOpenOutcome> {
  return parlayOpenLane({ wallet: ctx.wallet, journal: ctx.journal, stopGate: allowAllStopGate, nowMs }, intent, onPhase);
}
