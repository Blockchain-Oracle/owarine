import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import type { PrivateIntent } from "@agari/core/private";
import { refusedFor } from "../stub/product";
import { PRIVATE_NOT_LIVE } from "./reads";

/** The owner's private-balance writes refuse before anything is journaled or signed until C8. */
export async function submitPrivateTx(_ctx: unknown, _intent: PrivateIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(PRIVATE_NOT_LIVE);
}
