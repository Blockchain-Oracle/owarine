/**
 * What the market looks like for one candidate, right now (core `market.ts`), on Canton (C8f):
 *
 *   the name's prices   spot, half-hour mean and mark from the in-process PreStocks feed (the signals, the evidence
 *                       and the grade compare these; the lane feeders attest the same reads)
 *   live leg (K-090)    the venue's published ladder for the name's current hourly Window: a preview of what the
 *                       stake buys (Up lots, as raw "tokens") or what the lots sell for, the Window's fair Up price as
 *                       the reference (the operator posts it as the attestors' marks right before acting), and the
 *                       premium of the ask over that fair price, which the mandate's ceiling bounds
 *   practice (K-091)    a paper fill at the feed's token print, multiplier 1; PreStocks' 1 % fee is taken off the
 *                       received leg by the paper ledger and counted in the cost here
 */
import { costBpsFor, gapOf, PAPER_FEE_BPS, rawFor, valueE6, type DeskCandidate, type DeskMarketRead } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import { DESK_LOT_MULTIPLIER_E12, DESK_MINTS, lotPriceE8, quoteSwap, quotingWindow, USDC_MAINNET, type JupiterQuote } from "@agari/markets/desk/server";
import { errorText } from "../../runtime/env";
import type { DeskStanding, RunnerContext } from "./types";
import { priceView } from "./value";

/** Practice units carry no mint multiplier: one unit is one token at the printed price (K-091). */
export const PRACTICE_MULTIPLIER_E12 = 1_000_000_000_000n;
/** The route label a paper fill carries; unknown to `paperFeeBpsFor`, so the paper ledger takes the full fee. */
export const PAPER_ROUTE_LABEL = "Agari paper";
/**
 * Kept for the record's shape: a live desk's reference is posted fresh (as marks) right before each action, so it is
 * never older than this when the ledger measures against it.
 */
export const REFERENCE_REFRESH_SEC = 300;
/** The slippage every preview carries as its own floor; the ledger's 92 % floor on a sale is the outer one. */
export const SLIPPAGE_BPS = 200;

/**
 * A live trade's cost against its own price (C8i): the fill against the Window's best ask (a buy) or best bid (a sell),
 * so the venue's 1% fee and any walk down the ladder count. The ask's distance from the Window's fair price is the
 * premium, which the owner's premium ceiling bounds on the ledger; measuring cost against fair too counted the venue's
 * half-spread twice, and a 30-tick spread (6% at 0.50) put every live buy over the 2.5% cost limit.
 */
export function liveCostBps(side: "buy" | "sell", amountIn: bigint, quoteOut: bigint, bestTicks: number | null, fairTicks: number | null, cashUnit: bigint): number | null {
  const priceTicks = bestTicks ?? fairTicks;
  if (!priceTicks || quoteOut <= 0n) return null;
  return costBpsFor(side, amountIn, quoteOut, lotPriceE8(priceTicks, cashUnit), DESK_LOT_MULTIPLIER_E12);
}

export interface MarketRead {
  market: DeskMarketRead;
  quote: JupiterQuote | null;
  /** The reference the ledger measures against: the Window's fair price for a live desk, the feed's for practice. */
  reference: { tokenPriceE8: bigint; markPriceE8: bigint; multiplierE12: bigint; fetchedAtSec: number } | null;
}

function paperQuote(side: "buy" | "sell", symbol: PreIpoSymbol, amountIn: bigint, spotE8: bigint): JupiterQuote {
  const out = side === "buy" ? rawFor(amountIn, PRACTICE_MULTIPLIER_E12, spotE8) : valueE6(amountIn, PRACTICE_MULTIPLIER_E12, spotE8);
  const mint = DESK_MINTS[symbol];
  return {
    inputMint: side === "buy" ? USDC_MAINNET : mint, outputMint: side === "buy" ? mint : USDC_MAINNET, inAmount: amountIn, outAmount: out,
    otherAmountThreshold: out, slippageBps: 0, priceImpactBps: 0, routeLabels: [PAPER_ROUTE_LABEL], contextSlot: null, raw: { paper: true, spotE8: spotE8.toString() },
  };
}

/** The read for `candidate` at `amountIn` (its own size unless a part was chosen). */
export async function readMarket(ctx: RunnerContext, standing: DeskStanding, candidate: DeskCandidate, amountIn: bigint, nowSec: number): Promise<MarketRead> {
  const symbol = candidate.symbol;
  const view = priceView(ctx.feed, symbol, nowSec);
  const spotE8 = view?.spotE8 ?? 0n;
  const meanE8 = view?.meanE8 ?? spotE8;
  const gap = gapOf(spotE8, meanE8);
  const base = { atSec: nowSec, symbol, spotE8, meanE8, markE8: view?.markE8 ?? null, indexE8: null, indexPremiumBps: null, routeAccounts: null, mintPaused: false, ...gap };

  if (standing.kind === "practice") {
    const quote = view ? paperQuote(candidate.side, symbol, amountIn, spotE8) : null;
    const reference = view ? { tokenPriceE8: view.spotE8, markPriceE8: view.markE8, multiplierE12: PRACTICE_MULTIPLIER_E12, fetchedAtSec: view.fetchedAtSec } : null;
    const market: DeskMarketRead = {
      ...base,
      multiplierE12: PRACTICE_MULTIPLIER_E12,
      referenceAgeSec: reference ? Math.max(0, nowSec - reference.fetchedAtSec) : null,
      premiumBps: view && view.markE8 > 0n ? Number(((spotE8 - view.markE8) * 10_000n) / view.markE8) : null,
      quoteOut: quote?.outAmount ?? null,
      costBps: quote ? PAPER_FEE_BPS : null,
      accountFrozen: false,
    };
    return { market, quote, reference };
  }

  // The live leg: the name's current Window on the venue's ladder.
  let ladders: Awaited<ReturnType<RunnerContext["ladders"]>> = [];
  try {
    ladders = await ctx.ladders();
  } catch (error) {
    ctx.log(`ladders unreadable: ${errorText(error)}`);
  }
  const window = quotingWindow(ladders, symbol);
  const fair = window?.fairTicks ?? null;
  const fairE8 = window && fair ? lotPriceE8(fair, window.cashUnit) : null;
  let quote: JupiterQuote | null = null;
  if (window) {
    try {
      const mint = DESK_MINTS[symbol];
      quote = await quoteSwap({ inputMint: candidate.side === "buy" ? USDC_MAINNET : mint, outputMint: candidate.side === "buy" ? mint : USDC_MAINNET, amount: amountIn, slippageBps: SLIPPAGE_BPS, ladders });
    } catch (error) {
      ctx.log(`preview ${candidate.side} ${symbol} failed: ${errorText(error)}`);
    }
  }
  const best = (quote?.raw as { bestTicks?: number } | undefined)?.bestTicks ?? null;
  const reference = fairE8 ? { tokenPriceE8: fairE8, markPriceE8: fairE8, multiplierE12: DESK_LOT_MULTIPLIER_E12, fetchedAtSec: nowSec } : null;
  const market: DeskMarketRead = {
    ...base,
    multiplierE12: DESK_LOT_MULTIPLIER_E12,
    referenceAgeSec: reference ? 0 : null,
    // The ask over the Window's fair price: what the mandate's premium ceiling bounds on a buy.
    premiumBps: fair && best ? Math.round(((best - fair) * 10_000) / fair) : null,
    quoteOut: quote?.outAmount ?? null,
    costBps: quote && window ? liveCostBps(candidate.side, amountIn, quote.outAmount, best, fair, window.cashUnit) : null,
    accountFrozen: standing.frozen[symbol] ?? false,
  };
  return { market, quote, reference };
}
