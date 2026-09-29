import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import type { RangeIntent } from "@agari/core/range";
import { refusedFor } from "../stub/product";
import { RANGE_NOT_LIVE, type RangeOpenOutcome } from "./read";

/** Every range write refuses before anything is journaled or signed until the reserve lands (C8). */
export async function submitRangeOpenWrite(_ctx: unknown, _intent: Extract<RangeIntent, { kind: "range-open" }>, _onPhase?: PhaseListener): Promise<RangeOpenOutcome> {
  return refusedFor(RANGE_NOT_LIVE);
}

export async function submitRangeTx(_ctx: unknown, _intent: RangeIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(RANGE_NOT_LIVE);
}
