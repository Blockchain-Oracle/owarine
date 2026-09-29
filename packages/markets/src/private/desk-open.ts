import type { PrivateOpenResult } from "@agari/core/private";
import type { Address, MarketId, Side, Signature } from "@agari/core/types";
import type { DeskClient } from "./desk-client";
import { PRIVATE_NOT_LIVE, PRIVATE_NOT_LIVE_WORDS } from "./reads";

export interface DeskOpenInput {
  owner: Address;
  marketId: MarketId;
  side: Side;
  stakeBase: bigint;
  minQuantityRaw: bigint;
  /** The owner's ed25519 signature over `privateOpenMessage` (base58). */
  authSignature: Signature;
  issuedAtMs: number;
  asset: string;
  intervalSec: number;
  expirySec: number;
}

/** The desk's open refuses before anything moves until the private bucket lands (C8): nothing charged, nothing refunded. */
export async function openPrivateBet(_desk: DeskClient, _input: DeskOpenInput): Promise<PrivateOpenResult> {
  return { status: "refused", reason: PRIVATE_NOT_LIVE_WORDS, technical: PRIVATE_NOT_LIVE, refundedBase: "0", txs: {} };
}
