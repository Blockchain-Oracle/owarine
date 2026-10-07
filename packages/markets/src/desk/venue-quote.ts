/**
 * The desk's quotes on Canton (C8f, K-090): a preview of the venue's price for a name, walked over the venue's
 * published ladder of that name's current Window, in the reference's Jupiter quote shape (a "token" is one lot:
 * raw = lots × 10^9). Indicative only: the firm price comes from the issuer when the operator acts.
 */
import type { Address } from "@owarine/core/types";
import type { PreIpoSymbol } from "@owarine/core/market";
import { PRE_IPO_SYMBOLS } from "@owarine/core/market";
import type { Ladder } from "../runtime/ladder";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";
import { lotsToRaw, rawToLots, seriesOfSymbol } from "./canton";
import { DeskSendError } from "./errors";
import type { Instruction } from "./ops";
import { DESK_MINTS, USDC_MAINNET } from "./types";

const NO_COUNTERPART = (what: string) => notDeployedError(cantonNotLive(`desk: ${what} has no Canton counterpart`));

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
  /** Canton: the venue's ladders to preview against (required). */
  ladders?: readonly Ladder[];
}

/** What a venue preview carries in `JupiterQuote.raw`: the Window it priced, for the firm quote and the marks. */
export interface VenuePreview {
  marketId: string;
  damlMarketId: string;
  termsCid: string;
  cashUnit: bigint;
  fairTicks: number | null;
  lots: bigint;
  /** Up terms: the best ask for a buy, the best bid for a sell. */
  bestTicks: number;
  expirySec: number;
}

export const VENUE_ROUTE_LABEL = "Owarine venue";

export const symbolOfMint = (mint: Address): PreIpoSymbol | null => PRE_IPO_SYMBOLS.find((s) => DESK_MINTS[s] === mint) ?? null;

/** The name's Window the venue is quoting now, if any. */
export function quotingWindow(ladders: readonly Ladder[], symbol: PreIpoSymbol): Ladder | null {
  const series = seriesOfSymbol(symbol);
  return ladders.filter((l) => l.seriesKey === series && l.state === "quoting").sort((a, b) => a.expirySec - b.expirySec)[0] ?? null;
}

/**
 * A preview of the venue's price for a buy (USDC in, lots out) or a sell (lots in, USDC out), walked over the ladder's
 * levels. Indicative: the firm price comes from the issuer when the operator acts.
 */
export async function quoteSwap(i: QuoteInput): Promise<JupiterQuote> {
  const buy = i.inputMint === USDC_MAINNET;
  const symbol = symbolOfMint(buy ? i.outputMint : i.inputMint);
  if (!symbol) throw new DeskSendError("simulation", new Error("only the eight pre-IPO companies are quoted"), null);
  const ladder = quotingWindow(i.ladders ?? [], symbol);
  if (!ladder) throw new DeskSendError("simulation", new Error(`the venue is not quoting a ${symbol} Window right now`), null);
  const cashUnit = ladder.cashUnit;
  const feeNum = 10_000n + BigInt(Math.max(0, Math.round(ladder.feeRateBps)));
  let lots = 0n;
  let out = 0n;
  let best = 0;
  if (buy) {
    let left = i.amount;
    for (const [ticks, available] of ladder.up) {
      if (!best) best = ticks;
      const perLot = (BigInt(ticks) * cashUnit * feeNum) / 10_000n;
      if (perLot <= 0n) continue;
      const take = [left / perLot, available].reduce((a, b) => (a < b ? a : b));
      lots += take;
      left -= take * perLot;
      if (take < available) break;
    }
    out = lotsToRaw(lots);
  } else {
    let left = rawToLots(i.amount);
    for (const [downTicks, available] of ladder.down) {
      const ticks = 1000 - downTicks;
      if (!best) best = ticks;
      const take = left < available ? left : available;
      out += (take * BigInt(ticks) * cashUnit * 10_000n) / feeNum;
      lots += take;
      left -= take;
      if (left === 0n) break;
    }
  }
  const slippageBps = i.slippageBps ?? 0;
  const fair = ladder.fairTicks ?? null;
  const impact = fair && best ? Math.abs(best - fair) * 10_000 / fair : null;
  const raw: VenuePreview = { marketId: ladder.marketId, damlMarketId: ladder.damlMarketId, termsCid: ladder.termsCid, cashUnit, fairTicks: fair, lots, bestTicks: best, expirySec: ladder.expirySec };
  return {
    inputMint: i.inputMint,
    outputMint: i.outputMint,
    inAmount: i.amount,
    outAmount: out,
    otherAmountThreshold: (out * BigInt(10_000 - slippageBps)) / 10_000n,
    slippageBps,
    priceImpactBps: impact === null ? null : Math.round(impact),
    routeLabels: [VENUE_ROUTE_LABEL],
    contextSlot: null,
    raw,
  };
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

/** A Jupiter swap instruction: the Canton desk trades the venue directly, there is no route to build. */
export async function swapInstructions(_i: SwapInstructionsInput): Promise<JupiterRoute> {
  throw NO_COUNTERPART("a DEX route");
}

