import type { LeverageIntent } from "@agari/core/leverage";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { refusedFor } from "../stub/product";
import { LEVERAGE_NOT_LIVE } from "./deployment";
import type { LeverageOpenOutcome } from "./types";

/** Every Boost write refuses before anything is journaled or signed until the leverage package lands (C8). */
export async function submitLeverageOpenWrite(_ctx: unknown, _intent: Extract<LeverageIntent, { kind: "leverage-open" }>, _onPhase?: PhaseListener): Promise<LeverageOpenOutcome> {
  return refusedFor(LEVERAGE_NOT_LIVE);
}

export async function submitLeverageTx(_ctx: unknown, _intent: LeverageIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(LEVERAGE_NOT_LIVE);
}
