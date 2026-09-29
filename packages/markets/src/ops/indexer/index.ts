/**
 * `@agari/markets/ops/indexer`: the reference indexer's chain access and event decode. On Canton the indexer becomes the
 * projector over `/v2/updates` as the venue (C3); until then every read refuses as not live and nothing is decoded.
 * The wire shapes are kept so `services/ops` and `@agari/db` keep compiling their rows. Server-only.
 */
import type { TickerSymbol } from "@agari/core/market";
import { opsNotLive } from "../shapes";

type Numeric = number | bigint | string;

/** The part of a transaction the reference's decode read. Nothing produces one on Canton (updates replace it, C3). */
export interface RawTransaction {
  slot: Numeric;
  blockTime: Numeric | null;
  meta: {
    err: unknown;
    innerInstructions?: ReadonlyArray<{ index: Numeric; instructions: ReadonlyArray<{ programIdIndex: Numeric; accounts: readonly Numeric[]; data: string }> }> | null;
    loadedAddresses?: { writable: readonly string[]; readonly: readonly string[] } | null;
  } | null;
  transaction: { signatures: readonly string[]; message: { accountKeys: readonly string[] } };
}

export const EVENT_NAMES = [
  "WindowOpened", "PrintRecorded", "OrderExecuted", "OrdersCancelled", "OrderReduced", "CompleteSet", "CreditWithdrawn",
  "WindowResolved", "Redeemed", "BookReleased", "LedgerGrown", "LedgerClosed", "DependentChanged", "MarketClosed",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export type JsonSafe = string | number | boolean | null | JsonSafe[] | { [key: string]: JsonSafe };

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Bigints as decimal strings, bytes as hex: the rows' wire form. Pure. */
export function toJsonSafe(value: unknown): JsonSafe {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return hex(value);
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJsonSafe(v)]));
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

export interface DecodedEvent {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  outerIx: number;
  innerIx: number;
  name: EventName;
  market: string | null;
  seq: string | null;
  data: { [key: string]: JsonSafe };
}

export interface DecodedTransaction {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  failed: boolean;
  events: DecodedEvent[];
}

export interface IndexerRpcConfig {
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  rps?: number;
}

export interface SignatureInfo {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  failed: boolean;
}

export interface SeriesInfo {
  series: string;
  ticker: number;
  symbol: TickerSymbol | null;
  cadenceSec: number;
  basis: number;
  lotBase: string;
  tickBase: string;
  cashUnit: string;
}

/** The indexer's read surface; every call refuses as not live in C1. */
export interface IndexerRpc {
  signaturesPage(of: string, options?: { before?: string; until?: string; limit?: number }): Promise<SignatureInfo[]>;
  transaction(sig: string): Promise<RawTransaction | null>;
  finalizedSlot(): Promise<number>;
  signatureStatuses(sigs: readonly string[]): Promise<Array<{ slot: number; status: string | null } | null>>;
  seriesInfo(addresses: readonly string[]): Promise<Array<SeriesInfo | null>>;
  subscribeMentions(of: string, onSignature: (sig: string, failed: boolean, slot: number) => void, signal: AbortSignal, onReady?: () => void): Promise<void>;
}

/** The reference's program id has no Canton meaning; the venue's package name replaces it in C3. */
export const AGARI_EVENTS_PROGRAM_ID = "";
export const AGARI_VAULT_PROGRAM_ID = "";

const refuse = async (): Promise<never> => {
  throw opsNotLive("ops/indexer");
};

export async function createIndexerRpc(_config: IndexerRpcConfig): Promise<IndexerRpc> {
  return {
    signaturesPage: refuse,
    transaction: refuse,
    finalizedSlot: refuse,
    signatureStatuses: refuse,
    seriesInfo: refuse,
    subscribeMentions: refuse,
  };
}

export async function eventAuthorityOf(_programId = AGARI_EVENTS_PROGRAM_ID): Promise<string> {
  throw opsNotLive("ops/indexer");
}

export function decodeTransactionEvents(_tx: RawTransaction, _programId: string, _eventAuthority: string): DecodedTransaction {
  throw opsNotLive("ops/indexer");
}

export async function walkSignatures(_rpc: IndexerRpc, _of: string, _options: { until?: string; stopBelowSlot?: number } = {}): Promise<SignatureInfo[]> {
  throw opsNotLive("ops/indexer");
}
