/**
 * The desk's operations (C1 stub). Reads, the owner's session, the operator client and its actions, the Jupiter route,
 * the fork helpers and the init plan all belonged to the Solana mainnet desk. On Canton the live leg is a `DeskMandate`
 * gated on C7b; practice desks stay paper ledgers and never call this module. Every read and write here refuses as not
 * live. `sealedActionsOf` is pure and kept.
 */
import type { PreIpoSymbol } from "@agari/core/market";
import type { Address, Hash32, Signature } from "@agari/core/types";
import type { ReadingError } from "../errors/reading-error";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";
import type {
  DeskEvent,
  DeskHistoryEntry,
  DeskInitPlan,
  DeskInitRecord,
  DeskInitWant,
  DeskMainnetSession,
  DeskMainnetSessionConfig,
  DeskMintState,
  DeskRpc,
  DeskState,
  DiscoveredDesk,
  OwnerDeskBalances,
  SealedAction,
  SignatureOutcome,
} from "./types";

const deskNotLive = (): ReadingError => notDeployedError(cantonNotLive("desk"));
const refuse = async (): Promise<never> => {
  throw deskNotLive();
};

/** A desk ledger command the Canton adapter will build (C8); opaque in C1. */
export type Instruction = { readonly kind: string };

// Reads.
export function createDeskRpc(rpcUrl: string): DeskRpc {
  return { endpoint: rpcUrl };
}
export function createBrowserDeskRpc(url: string): DeskRpc {
  return { endpoint: url };
}
export async function readDeskState(_rpc: DeskRpc, _owner: Address, _nowSec: number, _usdcMint?: Address): Promise<DeskState | null> {
  throw deskNotLive();
}
export async function readDeskMints(_rpc: DeskRpc, _mints: readonly Address[], _nowSec: number): Promise<Record<string, DeskMintState>> {
  throw deskNotLive();
}
export async function readOwnerDeskBalances(_rpc: DeskRpc, _owner: Address, _symbols: readonly PreIpoSymbol[], _nowSec: number): Promise<OwnerDeskBalances> {
  throw deskNotLive();
}
export async function readSealsOf(_rpc: DeskRpc, _signature: Signature): Promise<SealedAction[]> {
  throw deskNotLive();
}
export async function readDeskEventsOf(_rpc: DeskRpc, _signature: Signature): Promise<DeskEvent[]> {
  throw deskNotLive();
}
export async function readDeskHistory(_rpc: DeskRpc, _desk: Address, _options: { limit?: number; before?: Signature } = {}): Promise<DeskHistoryEntry[]> {
  throw deskNotLive();
}
export async function listDesksByOperator(_rpc: DeskRpc, _operator: Address): Promise<DiscoveredDesk[]> {
  throw deskNotLive();
}
export async function signatureOutcome(_rpc: DeskRpc, _signature: string): Promise<SignatureOutcome> {
  throw deskNotLive();
}
export async function chainNowSec(_rpc: DeskRpc): Promise<number> {
  throw deskNotLive();
}
export async function readDeskInitPlan(_rpc: DeskRpc): Promise<DeskInitPlan> {
  throw deskNotLive();
}
export async function initDesk(_ctx: unknown, _want: DeskInitWant, _record: DeskInitRecord, _save: () => void): Promise<DeskInitRecord> {
  throw deskNotLive();
}

const hex = (bytes: ArrayLike<number>): Hash32 => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

/** The sealed decisions (buy, sell, checkpoint) among a transaction's desk events. Pure. */
export function sealedActionsOf(events: readonly DeskEvent[]): SealedAction[] {
  const out: SealedAction[] = [];
  for (const e of events) {
    if (e.name === "Bought" || e.name === "Sold" || e.name === "Checkpoint") out.push({ kind: e.name, seq: e.data.seq, head: hex(e.data.head), decisionHash: hex(e.data.decisionHash) });
  }
  return out;
}

// Addresses.
export async function deskAddress(_owner: Address): Promise<Address> {
  throw deskNotLive();
}
export async function associatedTokenAddress(_owner: Address, _mint: Address, _tokenProgram: Address): Promise<Address> {
  throw deskNotLive();
}
export async function deskTokenAccounts(_desk: Address, _mint: Address, _usdcMint?: Address): Promise<{ deskUsdc: Address; deskToken: Address }> {
  throw deskNotLive();
}
export async function swapAccountsOf(_desk: Address, _mint: Address, _usdcMint?: Address): Promise<{ deskUsdc: Address; deskToken: Address }> {
  throw deskNotLive();
}

// The owner's session: every write refuses; there is no Solana wallet on Canton.
export function createDeskMainnetSession(config: DeskMainnetSessionConfig): DeskMainnetSession {
  return {
    owner: config.signer.address,
    readState: refuse,
    openDesk: refuse,
    allowTokens: refuse,
    disallowToken: refuse,
    deposit: refuse,
    withdraw: refuse,
    setLimits: refuse,
    setMode: refuse,
    setOperator: refuse,
    revokeOperator: refuse,
    pause: refuse,
    unpause: refuse,
  };
}
