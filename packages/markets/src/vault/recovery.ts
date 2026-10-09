/**
 * Read-only recovery of an agent's grant-scoped order (C8f). The executor sends `Grant_AcceptQuote` under a
 * deterministic command id (`grantBuyCommandId`, over owner · actor · Window · grant · side · the offset it started
 * from), so a lost reply is answered by the ledger's completion for that id and the transaction it names: the owner's
 * new leg on that Window is the fill. A process with ledger access installs the resolver; without one the answer is
 * `unknown`, and absence never authorizes a replay (AD-3).
 */
import type { MarketId, Side, Signature } from "@owarine/core/types";

export type RecoveredVaultExecution =
  | { status: "unknown" }
  | { status: "reverted"; txHash: Signature }
  | { status: "confirmed"; txHash: Signature; cashDelta: bigint; tokenDelta: bigint; atSec: number; side: Side };

/** What an actor captured before sending a grant-scoped vault order, to find it again after a lost reply. */
export interface VaultExecutionEvidence {
  owner: string;
  actor: string;
  marketId: MarketId;
  grantId: bigint;
  side: Side;
  /** Where the send started from (a ledger offset on Canton). */
  fromSlot: bigint;
  txHash: Signature | null;
}

export type VaultExecutionResolver = (input: VaultExecutionEvidence) => Promise<RecoveredVaultExecution>;

let resolver: VaultExecutionResolver | null = null;
/** Installed by a process that can read the ledger (ops' executor). */
export function installVaultExecutionResolver(next: VaultExecutionResolver | null): void {
  resolver = next;
}

export async function recoverVaultExecution(input: VaultExecutionEvidence, _reader?: unknown): Promise<RecoveredVaultExecution> {
  return resolver ? resolver(input) : { status: "unknown" };
}
