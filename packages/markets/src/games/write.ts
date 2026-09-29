import type { ArenaIntent } from "@agari/core/games";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import type { Diagnosis, Signature } from "@agari/core/types";
import { refusedFor } from "../stub/product";
import { ARENA_NOT_LIVE } from "./deployment";

/** What one confirmed pick actually did, from the arena's own record of the fill. */
export type ArenaPickOutcome =
  | { status: "confirmed"; txHash: Signature; quantity: bigint; costBase: bigint; refundBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Signature }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Signature };

/** Every arena write refuses before anything is journaled or signed until the games package lands (C9). */
export async function submitArenaTx(_ctx: unknown, _intent: ArenaIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(ARENA_NOT_LIVE);
}

export async function submitArenaPickWrite(_ctx: unknown, _intent: Extract<ArenaIntent, { kind: "arena-pick" | "arena-pick-for" }>, _onPhase?: PhaseListener): Promise<ArenaPickOutcome> {
  return refusedFor(ARENA_NOT_LIVE);
}
