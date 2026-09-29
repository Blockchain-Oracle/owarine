import { notDeployedError, cantonNotLive } from "../stub/not-deployed";
import type { ProofStore } from "./store";

/** How long a posted proof account was kept before its rent was reclaimed on Solana. */
export const PROOF_KEEP_SEC = 86_400;

export interface CloseReport {
  closed: Array<{ boundarySec: number; feeds: string[]; addresses: string[]; signatures: string[] }>;
  orphans: { addresses: string[]; signatures: string[] };
  skippedOrphans: string | null;
  errors: string[];
}

/** Nothing is posted on Canton, so there is no account to close: rejects with the not-live reason (C1). */
export async function closeProofAccounts(_deps: { store: ProofStore; rpcUrl: string; payerSecret: Uint8Array; nowMs?: () => number }, _olderThanSec = PROOF_KEEP_SEC): Promise<CloseReport> {
  throw notDeployedError(cantonNotLive("proof"));
}
