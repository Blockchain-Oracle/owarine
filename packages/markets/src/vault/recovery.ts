/**
 * Read-only recovery of a grant-scoped vault order. With no trading-balance package on the participant (C7a) nothing
 * on the ledger can confirm an order, so the answer is `unknown`: absence never authorizes a replay (AD-3).
 */
import type { Address, MarketId, Side, Signature } from "@agari/core/types";

export type RecoveredVaultExecution =
  | { status: "unknown" }
  | { status: "reverted"; txHash: Signature }
  | { status: "confirmed"; txHash: Signature; cashDelta: bigint; tokenDelta: bigint; atSec: number; side: Side };

/** What an actor captured before sending a grant-scoped vault order, to find it again after a lost reply. */
export interface VaultExecutionEvidence {
  owner: Address;
  actor: Address;
  marketId: MarketId;
  grantId: bigint;
  side: Side;
  /** Where the send started from (a ledger offset on Canton). */
  fromSlot: bigint;
  txHash: Signature | null;
}

export async function recoverVaultExecution(_input: VaultExecutionEvidence, _reader?: unknown): Promise<RecoveredVaultExecution> {
  return { status: "unknown" };
}
