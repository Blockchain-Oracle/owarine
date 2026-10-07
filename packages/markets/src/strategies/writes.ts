import type { PhaseListener, TxOutcome } from "@owarine/core/ports";
import { encodeSpec, encodeStrategyMetadata, type StrategyIntent, type StrategyMetadata, type StrategySpec } from "@owarine/core/strategies";
import { diagnosis } from "@owarine/core/types";
import { ReadingError } from "../errors/reading-error";
import { refusedFor } from "../stub/product";
import { agentsStrategyLane } from "../submitter/agents-lane";
import type { SeatLaneDeps } from "../submitter/seat-lane";
import { STRATEGIES_NOT_LIVE } from "./reads";

/** The metadata a strategy holds (the reference program's `MAX_METADATA_LEN`; the Canton route keeps the cap, C8f). */
export const STRATEGY_METADATA_MAX_BYTES = 2_048;
/**
 * How much of the metadata rides in each transaction. A publish carries the runner, two hashes, the envelope and six
 * account keys beside it, which leaves about 770 bytes of a 1,232-byte transaction; a later write carries far less
 * and has room for about 960. Both sit a little under, so a seal can share the last transaction.
 */
const FIRST_CHUNK_BYTES = 700;
const NEXT_CHUNK_BYTES = 900;

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
}

interface RevisionPlan {
  revision: { specHash: Uint8Array; metadataHash: Uint8Array; metadataLen: number; firstChunk: Uint8Array; subscriptionFeeBase: bigint };
  /** The pieces that follow the first, with where each goes. */
  rest: { offset: number; chunk: Uint8Array }[];
}

/** The creator's words as the program takes them: hashed whole, declared by length, and cut to fit transactions. */
export async function planRevision(spec: StrategySpec, metadata: StrategyMetadata, feeBase: bigint): Promise<RevisionPlan> {
  const text = new TextEncoder().encode(encodeStrategyMetadata(metadata));
  if (text.length === 0 || text.length > STRATEGY_METADATA_MAX_BYTES) {
    throw new ReadingError(diagnosis("contract-revert", `the strategy's name, description and spec come to ${text.length} bytes; a strategy holds ${STRATEGY_METADATA_MAX_BYTES}`));
  }
  const rest: RevisionPlan["rest"] = [];
  for (let offset = FIRST_CHUNK_BYTES; offset < text.length; offset += NEXT_CHUNK_BYTES) rest.push({ offset, chunk: text.slice(offset, offset + NEXT_CHUNK_BYTES) });
  return {
    revision: {
      specHash: await sha256(new TextEncoder().encode(encodeSpec(spec))),
      metadataHash: await sha256(text),
      metadataLen: text.length,
      firstChunk: text.slice(0, FIRST_CHUNK_BYTES),
      subscriptionFeeBase: feeBase,
    },
    rest,
  };
}

const isLane = (ctx: unknown): ctx is SeatLaneDeps =>
  typeof ctx === "object" && ctx !== null && "journal" in ctx && "wallet" in ctx && "nowMs" in ctx && "stopGate" in ctx;

/**
 * A registry write through the seat's journaled agents lane (C8f): the whole published text is one create on Canton,
 * sealed by its SHA-256 (`planRevision`'s chunks were Solana's transaction size, and are kept only as a pure helper).
 * Without the seat's lane the write refuses before anything is journaled.
 */
export async function submitStrategyLane(ctx: unknown, intent: StrategyIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  if (!isLane(ctx)) return refusedFor(STRATEGIES_NOT_LIVE);
  return agentsStrategyLane(ctx, intent, onPhase);
}
