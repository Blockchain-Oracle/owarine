/**
 * The desk operator's client, actions, route and proof helpers (C1 stub). The reference's operator signed Jupiter swaps
 * through agari-desk on Solana mainnet. On Canton the operator exercises `DeskMandate` choices against the venue's own
 * markets (C8, live leg gated on C7b). Every call here refuses as not live; the error classes and shapes are kept for
 * the desk runner.
 */
import type { Address, Hash32, Signature } from "@agari/core/types";
import type { KeyPairSigner } from "../deploy/client";
import type { ReadingError } from "../errors/reading-error";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";
import type { Instruction } from "./ops";
import type { DeskEvent, DeskRpc, SealedAction } from "./types";

const deskNotLive = (): ReadingError => notDeployedError(cantonNotLive("desk"));

export interface DeskOperatorClientConfig {
  secretKey: Uint8Array;
  rpcUrl: string;
  clusterTag: number;
}

export interface DeskSendOptions {
  lookupTables?: readonly Address[];
  abortSignal?: AbortSignal;
}

export interface DeskSendResult {
  signature: Signature;
  slot: bigint;
  computeUnitLimit: number;
  unitsConsumed: number;
  bytes: number;
  events: DeskEvent[];
}

/** A refused or failed desk command; `deskCode` is the desk's own refusal code when it has one. */
export class DeskSendError extends Error {
  constructor(readonly stage: "simulation" | "landed", readonly failure: unknown, readonly signature: Signature | null, readonly deskCode: number | null = null) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = "DeskSendError";
  }
}

export class DeskSendUnknownError extends Error {
  constructor(readonly signature: Signature, readonly reason: "expired" | "cap") {
    super(`send ${signature} unconfirmed (${reason}); reconcile by id before sending again`);
    this.name = "DeskSendUnknownError";
  }
}

export interface DeskOperatorClient {
  readonly address: Address;
  readonly signer: KeyPairSigner;
  readonly clusterTag: number;
  simulate(instructions: readonly Instruction[], options?: DeskSendOptions): Promise<{ unitsConsumed: number; bytes: number }>;
  send(step: string, instructions: readonly Instruction[], options?: DeskSendOptions): Promise<DeskSendResult>;
}

export async function createDeskOperatorClient(_config: DeskOperatorClientConfig): Promise<DeskOperatorClient> {
  throw deskNotLive();
}

export interface JupiterQuote {
  inputMint: Address;
  outputMint: Address;
  inAmount: bigint;
  outAmount: bigint;
  otherAmountThreshold: bigint;
  slippageBps: number;
  priceImpactBps: number | null;
  routeLabels: string[];
  contextSlot: number | null;
  raw: unknown;
}

export interface QuoteInput {
  inputMint: Address;
  outputMint: Address;
  amount: bigint;
  slippageBps?: number;
  maxAccounts?: number;
  onlyDirectRoutes?: boolean;
  dexes?: readonly string[];
  apiKey?: string;
  signal?: AbortSignal;
}

export interface JupiterRoute {
  swapData: Uint8Array;
  route: { address: Address; role: number }[];
  accountCount: number;
  lookupTables: Address[];
  setupInstructions: Instruction[];
  computeBudgetInstructions: Instruction[];
}

export interface SwapInstructionsInput {
  quote: JupiterQuote;
  desk: Address;
  destinationTokenAccount: Address;
  payer?: Address;
  apiKey?: string;
  signal?: AbortSignal;
}

/** The desk's live leg trades the venue's own markets on Canton, not a Solana DEX: not live. */
export async function quoteSwap(_i: QuoteInput): Promise<JupiterQuote> {
  throw deskNotLive();
}
export async function swapInstructions(_i: SwapInstructionsInput): Promise<JupiterRoute> {
  throw deskNotLive();
}

export interface PostReferenceAction {
  attestor: KeyPairSigner;
  mint: Address;
  tokenPriceE8: bigint;
  markPriceE8: bigint;
  multiplierE12: bigint;
  fetchedAtSec: number;
}

export interface SwapAction {
  owner: Address;
  mint: Address;
  amountIn: bigint;
  minOut: bigint;
  deadlineSec: number;
  decisionHash: Hash32;
  route: JupiterRoute;
  priceUpdate?: Address;
  usdcMint?: Address;
  swapProgram?: Address;
}

export interface SwapResult extends DeskSendResult {
  sealed: SealedAction;
}

export interface CheckpointAction {
  owner: Address;
  deadlineSec: number;
  decisionHash: Hash32;
}

export async function postReference(_client: DeskOperatorClient, _a: PostReferenceAction): Promise<DeskSendResult> {
  throw deskNotLive();
}
export async function buy(_client: DeskOperatorClient, _a: SwapAction): Promise<SwapResult> {
  throw deskNotLive();
}
export async function sell(_client: DeskOperatorClient, _a: SwapAction): Promise<SwapResult> {
  throw deskNotLive();
}
export async function checkpoint(_client: DeskOperatorClient, _a: CheckpointAction): Promise<SwapResult> {
  throw deskNotLive();
}

export interface PostReferenceInput {
  attestor: KeyPairSigner;
  payer: { readonly address: Address };
  mint: Address;
  clusterTag: number;
  tokenPriceE8: bigint;
  markPriceE8: bigint;
  multiplierE12: bigint;
  fetchedAtSec: number;
  programId?: Address;
}

export async function postReferenceInstructions(_i: PostReferenceInput): Promise<[Instruction, Instruction]> {
  throw deskNotLive();
}
export async function buyIx(..._args: unknown[]): Promise<Instruction> {
  throw deskNotLive();
}
export async function pauseIx(..._args: unknown[]): Promise<Instruction> {
  throw deskNotLive();
}
export async function withdrawAsStrangerIx(_signer: KeyPairSigner, _deskOwner: Address, _mint: Address, _amount: bigint): Promise<Instruction> {
  throw deskNotLive();
}

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
  throw deskNotLive();
}

// The reference's Surfpool fork helpers: no fork exists on Canton (the sandbox replaces it).
export interface Prewarmed {
  accounts: number;
  tables: number;
  entries: number;
  missing: number;
}
export async function forkAirdrop(_rpc: DeskRpc, _address: Address, _lamports: bigint): Promise<Signature> {
  throw deskNotLive();
}
export async function forkSetTokenAccount(_rpcUrl: string, _i: { owner: Address; mint: Address; amount: bigint; tokenProgram: Address }): Promise<void> {
  throw deskNotLive();
}
export async function forkTimeTravel(_rpcUrl: string, _toSec: number): Promise<{ absoluteSlot: number; epoch: number }> {
  throw deskNotLive();
}
export async function prewarmRoute(_rpc: DeskRpc, _route: JupiterRoute, _mayBeMissing: readonly Address[] = []): Promise<Prewarmed> {
  throw deskNotLive();
}
export async function refreshRoute(_rpc: DeskRpc, _rpcUrl: string, _route: JupiterRoute, _keep: readonly Address[] = []): Promise<number> {
  throw deskNotLive();
}
export async function tokenBalance(_rpc: DeskRpc, _tokenAccount: Address): Promise<bigint | null> {
  throw deskNotLive();
}
