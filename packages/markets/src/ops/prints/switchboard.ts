/**
 * Switchboard token-lane prints (C1 stub). The reference recorded a Switchboard Surge quote through the ed25519
 * precompile on Solana. On Canton the 24/7 lanes settle on the oracle parties' attested candles (C3/C6); Switchboard is
 * no longer a source. Names are kept for `services/ops`; every call refuses as not live.
 */
import type { OpsClient } from "../client";
import { opsNotLive, type Instruction } from "../shapes";
import { notLiveOutcome, type SlotOutcome } from "./record";
import type { PrintSlot } from "./slots";

export const SWITCHBOARD_REQUEST_SIGNATURES = 5;
export const SWITCHBOARD_MAX_SIGNATURES = 4;
export const SWITCHBOARD_DEVNET_QUEUE = "";

/** Refusal names the relay branches on; stable local numbers (no Canton rejection maps to them). */
export const SWITCHBOARD_ERROR = {
  feedMismatch: 6101,
  queueMismatch: 6102,
  duplicateOracle: 6103,
  tooFewOracles: 6104,
  quoteSlotStale: 6105,
  notAttestor: 6106,
  printNotAdjacent: 6107,
  printsMissing: 6108,
} as const;

export interface QuoteFeed {
  feedHashHex: string;
  /** × 10⁻¹⁸. */
  value: bigint;
  minOracleSamples: number;
}

export interface SwitchboardQuote {
  data: Uint8Array;
  programId: string;
  slot: bigint;
  oracleIdxs: number[];
  signers: string[];
  feeds: QuoteFeed[];
}

export type SwitchboardVenue = { queue: string | null; minOracles: number };

export class QuoteShortError extends Error {
  constructor(readonly distinct: number, readonly required: number) {
    super(`quote signed by ${distinct} distinct oracle(s), ${required} required`);
  }
}

const notLive = () => opsNotLive("ops/prints");

export async function readSwitchboardVenue(_client: OpsClient): Promise<SwitchboardVenue> {
  throw notLive();
}

export async function fetchTokenQuote(_input: { rpcUrl: string; surgeSymbols: readonly string[]; minOracles: number; queue: string }): Promise<SwitchboardQuote> {
  throw notLive();
}

/** The token lane's unsigned display spot from a Surge simulation; not a source on Canton. */
export async function simulateSurgeE8(_symbol: string, _crossbarUrl?: string): Promise<bigint> {
  throw notLive();
}

export const quoteHasFeed = (quote: SwitchboardQuote, feedIdHex: string) => quote.feeds.some((f) => f.feedHashHex === feedIdHex);

export const quoteInstruction = (_quote: SwitchboardQuote): Instruction => {
  throw notLive();
};

export async function recordSwitchboardSlot(_client: OpsClient, slot: PrintSlot, _quote: SwitchboardQuote, _queue: string): Promise<SlotOutcome> {
  return notLiveOutcome(slot);
}

export async function copyOpenSlot(_client: OpsClient, slot: PrintSlot): Promise<SlotOutcome> {
  return notLiveOutcome(slot);
}

/** No price-update accounts exist on Canton, so there is nothing to find or close. */
export async function findPriceUpdates(_client: OpsClient, _writeAuthority: string): Promise<string[]> {
  throw notLive();
}

export async function closeLeftoverPriceUpdates(_input: { client: OpsClient; rpcUrl: string; payerSecret: Uint8Array }): Promise<{ found: string[]; signatures: string[] }> {
  throw notLive();
}
