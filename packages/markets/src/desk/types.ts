/**
 * The desk's shapes and reference constants (C1 stub). The reference's `agari-desk` bought PreStocks through Jupiter
 * on Solana mainnet; on Canton the desk becomes a `DeskMandate` over an `AgentGrant` whose live leg trades the venue's
 * own markets and is gated on C7b, while practice desks stay paper ledgers. The shapes the web, the app and the
 * desk runner read are kept (addresses as core `Address`, ids as core `Signature`); nothing in C1 produces a live one.
 */
import type { DeskMode } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS, TICKERS, type PreIpoSymbol } from "@agari/core/market";
import type { Address, Hash32, Signature } from "@agari/core/types";

/** Reference-only Solana mainnet addresses the reference desk traded against; no Canton code sends to them. */
export const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" as Address;
export const JUPITER_V6 = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4" as Address;
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" as Address;

/** The eight PreStocks mints by catalogue symbol, from the registry (plain data). */
export const DESK_MINTS: Readonly<Record<PreIpoSymbol, Address>> = Object.fromEntries(
  PRE_IPO_SYMBOLS.map((symbol) => [symbol, TICKERS[symbol].preIpo?.mint as Address]),
) as Record<PreIpoSymbol, Address>;

const SYMBOL_OF_MINT = new Map<string, PreIpoSymbol>(PRE_IPO_SYMBOLS.map((symbol) => [DESK_MINTS[symbol] as string, symbol]));
export const deskSymbolOfMint = (mint: string): PreIpoSymbol | null => SYMBOL_OF_MINT.get(mint) ?? null;
export const tokenProgramOf = (mint: Address, usdcMint: Address = USDC_MAINNET): Address => (mint === usdcMint ? TOKEN_PROGRAM : TOKEN_2022_PROGRAM);

/** The desk's ledger read surface. Opaque in C1 (the Canton desk reads through the ledger adapter, C8). */
export interface DeskRpc {
  readonly endpoint: string;
}

export interface DeskTokenAccountState {
  address: Address;
  exists: boolean;
  raw: bigint;
  frozen: boolean;
}

export interface DeskAllowedToken extends DeskTokenAccountState {
  mint: Address;
  symbol: PreIpoSymbol | null;
  enabled: boolean;
}

export interface DeskRefState {
  mint: Address;
  tokenPriceE8: bigint;
  markPriceE8: bigint;
  multiplierE12: bigint;
  fetchedAtSec: number;
  postedBy: Address;
  pythFeedId: Hash32 | null;
}

export interface DeskMintState {
  mint: Address;
  decimals: number;
  multiplierE12: bigint | null;
  paused: boolean | null;
}

export interface DeskState {
  address: Address;
  owner: Address;
  operator: Address | null;
  seq: bigint;
  head: Hash32;
  perActionCapE6: bigint;
  dailyCapE6: bigint;
  spentInWindowE6: bigint;
  windowStartSec: number;
  remainingDailyCapE6: bigint;
  maxPremiumBps: number;
  mode: DeskMode;
  paused: boolean;
  requirePythIndex: boolean;
  usdc: DeskTokenAccountState;
  tokens: DeskAllowedToken[];
  refs: Record<string, DeskRefState>;
  mints: Record<string, DeskMintState>;
  slot: bigint;
}

export interface OwnerNameBalance {
  symbol: PreIpoSymbol;
  mint: Address;
  ownerToken: Address;
  raw: bigint;
  multiplierE12: bigint | null;
  paused: boolean | null;
}

export interface OwnerDeskBalances {
  lamports: bigint;
  usdc: { ownerToken: Address; raw: bigint };
  names: OwnerNameBalance[];
  slot: bigint;
}

export type DeskEventName =
  | "ConfigInitialized" | "AttestorsSet" | "ReferenceInitialized" | "ReferenceFeedSet" | "ReferencePosted" | "DeskOpened" | "TokenAllowed" | "TokenDisallowed" | "Deposited" | "Withdrawn" | "LimitsSet" | "ModeSet"
  | "OperatorSet" | "OperatorRevoked" | "Paused" | "Unpaused" | "Bought" | "Sold" | "Checkpoint";

/** A sealed desk decision as its event recorded it; other events carry their fields in `data`. */
export type DeskEvent =
  | { name: "Bought" | "Sold" | "Checkpoint"; data: { seq: bigint; head: Uint8Array; decisionHash: Uint8Array } }
  | { name: Exclude<DeskEventName, "Bought" | "Sold" | "Checkpoint">; data: Record<string, unknown> };

export interface SealedAction {
  kind: "Bought" | "Sold" | "Checkpoint";
  seq: bigint;
  head: Hash32;
  decisionHash: Hash32;
}

export interface DeskHistoryEntry {
  signature: Signature;
  slot: bigint;
  blockTimeSec: number | null;
  failed: boolean;
  events: DeskEvent[];
}

/** How a desk write ended. */
export type Landing =
  | { kind: "landed"; slot: bigint }
  | { kind: "landed-failed"; slot: bigint; failure: unknown }
  | { kind: "unknown"; reason: "expired" | "cap" };

export interface DeskWriteResult {
  signature: Signature;
  landing: Landing;
}

export interface DeskMainnetSession {
  readonly owner: Address;
  readState(nowSec: number): Promise<DeskState | null>;
  openDesk(input: { operator: Address; perActionCapE6: bigint; dailyCapE6: bigint; maxPremiumBps: number; mode: DeskMode }): Promise<DeskWriteResult>;
  allowTokens(mints: readonly Address[]): Promise<DeskWriteResult>;
  disallowToken(mint: Address): Promise<DeskWriteResult>;
  deposit(input: { mint: Address; ownerToken: Address; amount: bigint }): Promise<DeskWriteResult>;
  withdraw(input: { mint: Address; amount?: bigint }): Promise<DeskWriteResult>;
  setLimits(input: { perActionCapE6: bigint; dailyCapE6: bigint; maxPremiumBps: number; requirePythIndex: boolean }): Promise<DeskWriteResult>;
  setMode(mode: DeskMode): Promise<DeskWriteResult>;
  setOperator(operator: Address): Promise<DeskWriteResult>;
  revokeOperator(): Promise<DeskWriteResult>;
  pause(): Promise<DeskWriteResult>;
  unpause(): Promise<DeskWriteResult>;
}

/** The owner's signer for desk writes: the seat's opaque signer in C1 (no Solana wallet). */
export interface DeskMainnetSessionConfig {
  signer: { readonly address: Address };
  rpcUrl: string;
  usdcMint?: Address;
}

export interface DeskInitRecord {
  programId: string;
  config: string;
  usdcMint: string;
  swapProgram: string;
  clusterTag: number;
  attestors: string[];
  references: Record<string, { mint: string; address: string; initSignature?: string }>;
  configInitSignature?: string;
}

export interface DeskInitWant {
  clusterTag: number;
  usdcMint: Address;
  swapProgram: Address;
  attestors: readonly Address[];
}

export interface DeskInitPlan {
  programId: Address;
  programDeployed: boolean;
  upgradeAuthority: Address | null;
  config: { address: Address; exists: boolean; rentLamports: bigint };
  references: { symbol: PreIpoSymbol; mint: Address; address: Address; exists: boolean }[];
  referenceRentLamports: bigint;
  missingRentLamports: bigint;
}

export interface DiscoveredDesk {
  address: Address;
  owner: Address;
  operator: Address | null;
  mode: DeskMode;
  paused: boolean;
  seq: bigint;
  head: Hash32;
}

export type SignatureOutcome = { kind: "confirmed"; slot: bigint } | { kind: "failed"; slot: bigint } | { kind: "pending" } | { kind: "none" };
