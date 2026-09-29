import type { ParlayIntent } from "@agari/core/parlay";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { refusedFor } from "../stub/product";
import { PARLAY_NOT_LIVE } from "./reads";
import type { ParlayOpenOutcome } from "./types";

/** Every parlay write refuses before anything is journaled or signed until the package lands (C8). */
export async function submitParlayOpenWrite(_ctx: unknown, _intent: Extract<ParlayIntent, { kind: "parlay-open" }>, _onPhase?: PhaseListener): Promise<ParlayOpenOutcome> {
  return refusedFor(PARLAY_NOT_LIVE);
}

export async function submitParlayTx(_ctx: unknown, _intent: ParlayIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(PARLAY_NOT_LIVE);
}
