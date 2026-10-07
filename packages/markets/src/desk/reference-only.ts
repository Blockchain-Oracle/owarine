/**
 * The reference desk's Solana-only operator helpers (refusal probes, Surfpool fork tools, route prewarming), kept for
 * their export names and shapes. The Canton desk has no counterpart for any of them: each refuses with the reason.
 */
import type { Address, Signature } from "@owarine/core/types";
import type { KeyPairSigner } from "../deploy/client";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";
import type { DeskOperatorClient } from "./operator";
import type { Instruction } from "./ops";
import type { DeskRpc } from "./types";
import type { JupiterRoute } from "./venue-quote";

const NO_COUNTERPART = (what: string) => notDeployedError(cantonNotLive(`desk: ${what} has no Canton counterpart`));

export interface RefusalStage {
  deskCode: number | null;
  customCode: number | null;
  error: string;
  logs: string[];
}

export interface Refusal {
  simulation: RefusalStage;
  landed: (RefusalStage & { signature: Signature; slot: bigint }) | null;
}

export interface RefusalOptions {
  lookupTables?: readonly Address[];
  send?: boolean;
  feePayer?: KeyPairSigner;
  confirmMs?: number;
}

export class NotRefusedError extends Error {
  constructor(readonly unitsConsumed: number) {
    super(`expected a refusal, but the simulation passed (${unitsConsumed} CU)`);
    this.name = "NotRefusedError";
  }
}

export async function sendForRefusal(_client: DeskOperatorClient, _instructions: readonly Instruction[], _options: RefusalOptions = {}): Promise<Refusal> {
  throw NO_COUNTERPART("the fork's refusal probe (the Daml money gate is pm-tests' Test.Agents.Desk)");
}

// The reference's Surfpool fork helpers: the local sandbox replaces the fork.
export interface Prewarmed {
  accounts: number;
  tables: number;
  entries: number;
  missing: number;
}
export async function forkAirdrop(_rpc: DeskRpc, _address: Address, _lamports: bigint): Promise<Signature> {
  throw NO_COUNTERPART("a fork airdrop");
}
export async function forkSetTokenAccount(_rpcUrl: string, _i: { owner: Address; mint: Address; amount: bigint; tokenProgram: Address }): Promise<void> {
  throw NO_COUNTERPART("a fork token account");
}
export async function forkTimeTravel(_rpcUrl: string, _toSec: number): Promise<{ absoluteSlot: number; epoch: number }> {
  throw NO_COUNTERPART("fork time travel");
}
export async function prewarmRoute(_rpc: DeskRpc, _route: JupiterRoute, _mayBeMissing: readonly Address[] = []): Promise<Prewarmed> {
  throw NO_COUNTERPART("a route prewarm");
}
export async function refreshRoute(_rpc: DeskRpc, _rpcUrl: string, _route: JupiterRoute, _keep: readonly Address[] = []): Promise<number> {
  throw NO_COUNTERPART("a route refresh");
}
/** A desk's "token balance": its budget (the desk address) — Canton has no token accounts. */
