import type { MakerIntent } from "@agari/core/maker";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { refusedFor } from "../stub/product";
import { MAKER_NOT_LIVE } from "./reads";

/** Every Earn write refuses before anything is journaled or signed until the reserve lands (C8). */
export async function submitMakerTx(_ctx: unknown, _intent: MakerIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(MAKER_NOT_LIVE);
}
