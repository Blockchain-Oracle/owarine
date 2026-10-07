/**
 * The pricer (plan "Venue operations": the seed maker's fair-value math, unchanged, becomes the pricer). For every
 * Window with a recorded open print it prices `P(close ≥ open)` from the live spot (`fair.ts`), builds the venue price
 * ladder around it (`ladder.ts`, `quote.ts`'s `quotePair`) within the per-market cap, and puts it on the board the
 * issuer walks and `/ladders/stream` publishes. It writes nothing to the ledger, so it runs the same live or dry.
 *
 * Three bases (C6d):
 *   price   Regular, token and crypto Windows: spot against the open print (`fair.ts`).
 *   gap     a Monday Gap Window: the reference's `gap-fair.ts` unchanged, the xStock weekend spot against Friday's print
 *           on the Gap variance clock, blind 500 ± 150 without a reference; stops 60 s before the Sunday lock; the per-
 *           side cap is `MM_GAP_MAX_CASH`.
 *   event   a committee event (engine 0.4.0 `EventTerms`, no open print): even odds quoted wide (core
 *           `EVENT_FAIR_TICKS ± EVENT_HALF_SPREAD_TICKS`) from its start until it stops taking quotes.
 */
import { CALENDAR_YEAR_SEC, EVENT_FAIR_TICKS, EVENT_HALF_SPREAD_TICKS, parseLaneKey, spotSymbolOf, TICKERS, type TickerSymbol } from "@owarine/core/market";
import type { HaltBoard } from "@owarine/core/types";
import { TEMPLATE_IDS } from "@owarine/daml";
import {
  decodeEventState, decodeEventTerms, decodeLeg, decodeOpenPrint, decodeQuote, learnTerms, pick, readActive, type Active, type EventTermsC, type LegC, type OpenPrintC,
  type QuoteC, type RoleSession, type TermsC,
} from "@owarine/markets/ops/canton";
import { marketIdFromDaml, seriesIdFromDaml } from "@owarine/core/market";
import type { SpotFeed } from "../../../prices/spot";
import type { VolBoard } from "../../../prices/vol-meter";
import { runActor, type PassResult } from "../../../runtime/actor";
import { readSeatMakerEnv, type SeatMakerEnv } from "./env";
import { fairYesTicks, TRADING_YEAR_SEC } from "./fair";
import { GAP_BLIND_HALF_SPREAD_TICKS, GAP_STOP_BEFORE_LOCK_SEC, gapFairTicks, gapPhase } from "./gap-fair";
import { buildLadder, quotingUntilSec } from "./ladder";
import type { LadderBoard } from "./ladder-board";

export interface PricerSettings {
  maker: SeatMakerEnv;
  levels: number;
  stepTicks: number;
  lotsPerLevel: bigint;
  /** Per market and side, base units of venue stake. */
  marketCapBase: bigint;
  /** The most lots one quote may carry. */
  maxQuoteLots: bigint;
  feeRateBps: number;
  /** Firm quote life on a seat (plan §6: 20 s). */
  quoteLifeSec: number;
  /** A quote shorter-lived than this is not issued. */
  minQuoteLifeSec: number;
  everyMs: number;
}

const intEnv = (raw: string | undefined, fallback: number, min = 1) => (raw && Number.isInteger(Number(raw)) && Number(raw) >= min ? Number(raw) : fallback);

export function readPricerSettings(env: NodeJS.ProcessEnv = process.env): PricerSettings {
  return {
    maker: readSeatMakerEnv(env),
    levels: intEnv(env.MM_LADDER_LEVELS, 5),
    stepTicks: intEnv(env.MM_LADDER_STEP_TICKS, 5),
    lotsPerLevel: BigInt(intEnv(env.MM_LEVEL_LOTS, 200)),
    marketCapBase: BigInt(intEnv(env.MM_MARKET_CAP_CREDITS, 5_000)) * 1_000_000n,
    maxQuoteLots: BigInt(intEnv(env.MM_MAX_QUOTE_LOTS, 500)),
    feeRateBps: intEnv(env.MM_FEE_RATE_BPS, 100, 0),
    quoteLifeSec: intEnv(env.MM_QUOTE_LIFE_SEC, 20),
    minQuoteLifeSec: intEnv(env.MM_MIN_QUOTE_LIFE_SEC, 5),
    everyMs: intEnv(env.MM_PRICER_MS, 1_000, 250),
  };
}

interface PricerState {
  venue: RoleSession;
  spot: SpotFeed | null;
  /** C6: the crypto lanes' measured realised σ; a crypto Window without one (and without an override) is not priced. */
  vol: VolBoard | null;
  board: LadderBoard;
  settings: PricerSettings;
  terms: Map<string, TermsC>;
  /** The halt board (Gap: the ticker and its xStock); absent reads as nothing halted. */
  halts: () => HaltBoard;
  /** The last ledger read, for re-pricing on a spot tick; null until the first pass. */
  inputs?: PricerInputs | null;
}

/** One Window's price for this pass, or why it is not quoted. */
export interface Priced {
  fairTicks: number;
  halfSpreadTicks: number;
  /** The last second the Window takes quotes. */
  untilSec: number;
  /** Per side, base units of venue stake (bounded again by `MM_MARKET_CAP_CREDITS`). */
  capBase: bigint;
  spotE8: bigint;
  basis: "price" | "gap" | "event";
  why: string;
}
export type WindowPrice = Priced | { skip: string };

/**
 * A Gap Window's price (the reference's `gapQuote`, on Canton shapes): pulled before the Friday print and when the
 * ticker is halted, stopped 60 s before the Sunday lock, else `gapFairTicks` against the xStock spot (blind and wide
 * when the name has none, or it is stale or halted).
 */
export function gapPrice(i: { t: TermsC; ticker: TickerSymbol; openE8: bigint; nowSec: number; spot: SpotFeed | null; halts: HaltBoard; maker: SeatMakerEnv }): WindowPrice {
  const { t, ticker, maker } = i;
  const halted = Boolean(i.halts[ticker]);
  const phase = gapPhase({ nowSec: i.nowSec, tradingStartSec: t.tradingStartSec, lockAtSec: t.lockAtSec, halted });
  if (phase !== "quote") return { skip: halted ? `halted (${i.halts[ticker]!.reason})` : phase === "stop" ? "60 s before the Sunday lock" : "Gap not trading yet" };
  const xstock = TICKERS[ticker].xstock?.symbol ?? null;
  const referenceE8 = xstock && !i.halts[xstock] ? (i.spot?.latest(xstock, maker.spotMaxAgeSec)?.priceE8 ?? null) : null;
  const fair = gapFairTicks({
    nowSec: i.nowSec, tradingStartSec: t.tradingStartSec, lockAtSec: t.lockAtSec, expirySec: t.expirySec, openE8: i.openE8, referenceE8,
    sigmaBps: maker.sigmaBps(ticker), minTick: maker.minTick,
  });
  if (fair === null) return { skip: "waiting for the Friday print" };
  const why = referenceE8 !== null ? `${xstock} reference` : xstock ? `${xstock} spot unavailable: blind` : "no weekend reference: blind";
  return {
    fairTicks: fair, halfSpreadTicks: referenceE8 === null ? Math.max(GAP_BLIND_HALF_SPREAD_TICKS, maker.halfSpreadTicks) : maker.halfSpreadTicks,
    untilSec: t.lockAtSec - GAP_STOP_BEFORE_LOCK_SEC, capBase: maker.gapMaxCash, spotE8: referenceE8 ?? i.openE8, basis: "gap", why,
  };
}

/** A committee event's price: even odds, wide, while it trades (it has no open print and no spot). */
export function eventPrice(t: TermsC, capBase: bigint): Priced {
  return { fairTicks: EVENT_FAIR_TICKS, halfSpreadTicks: EVENT_HALF_SPREAD_TICKS, untilSec: quotingUntilSec(t), capBase, spotE8: 0n, basis: "event", why: "committee event: even odds, wide" };
}

/** Venue stake already held against each side of one Window: its legs opposite the users' and its live quotes on that side. */
function usedStake(termsCid: string, venueLegs: readonly Active<LegC>[], quotes: readonly Active<QuoteC>[]): { usedUpBase: bigint; usedDownBase: bigint } {
  let usedUpBase = 0n;
  let usedDownBase = 0n;
  for (const l of venueLegs) if (l.data.termsCid === termsCid) l.data.outcome === "SideDown" ? (usedUpBase += l.data.backingShare) : (usedDownBase += l.data.backingShare);
  for (const q of quotes) {
    if (q.data.termsCid !== termsCid) continue;
    const stake = q.data.lots * BigInt(1000 - q.data.priceTicks) * q.data.cashUnit;
    if (q.data.side === "SideUp") usedUpBase += stake;
    else usedDownBase += stake;
  }
  return { usedUpBase, usedDownBase };
}

const isTicker = (s: string): s is TickerSymbol => s in TICKERS;

/**
 * σ and its clock for one Window. The lane key names the registry ticker (a token lane's print symbol is its xStock).
 * Crypto (C6): the vol meter's measured σ on the 365-day clock, or an `MM_SIGMA_BPS` override; never the placeholder.
 */
export function sigmaFor(maker: SeatMakerEnv, vol: VolBoard | null, ticker: TickerSymbol): { sigmaBps: number; yearSec?: number } | { missing: string } {
  if (TICKERS[ticker].kind !== "crypto") return { sigmaBps: maker.sigmaBps(ticker) };
  const sigmaBps = maker.sigmaOverride(ticker) ?? vol?.sigmaBps(ticker) ?? null;
  return sigmaBps === null ? { missing: `${ticker} realised vol not measured yet` } : { sigmaBps, yearSec: CALENDAR_YEAR_SEC };
}

/** What one ledger read gives the pricer; re-pricing on a spot tick reuses it until the next read. */
export interface PricerInputs {
  opens: Active<OpenPrintC>[];
  events: Active<EventTermsC>[];
  quotes: Active<QuoteC>[];
  venueLegs: Active<LegC>[];
}

async function readInputs(state: PricerState): Promise<PricerInputs> {
  const acs = await readActive(state.venue, [TEMPLATE_IDS.OpenPrint, TEMPLATE_IDS.Quote, TEMPLATE_IDS.Leg, TEMPLATE_IDS.EventTerms, TEMPLATE_IDS.EventState]);
  const opens = pick(acs, TEMPLATE_IDS.OpenPrint, decodeOpenPrint);
  // An event is live while its single-use EventState is: once resolved or voided it stops quoting.
  const liveEvents = new Set(pick(acs, TEMPLATE_IDS.EventState, decodeEventState).map((e) => e.data.termsCid));
  const events = pick(acs, TEMPLATE_IDS.EventTerms, decodeEventTerms).filter((e) => liveEvents.has(e.data.termsCid));
  // Each new Window's terms by id (C4g): paging MarketTerms returns every Window the venue ever ran.
  await learnTerms(state.venue, state.terms, [...opens.map((o) => o.data.termsCid), ...events.map((e) => e.data.termsCid)]);
  const quotes = pick(acs, TEMPLATE_IDS.Quote, decodeQuote);
  const venueLegs = pick(acs, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.owner === state.venue.party);
  return { opens, events, quotes, venueLegs };
}

/**
 * Prices every Window from one ledger read and the spot feed as it is now, and puts each ladder on the board (which
 * publishes only real changes). Pure apart from the board and the clock, so a spot tick can run it between reads.
 */
export function priceWindows(state: PricerState, inputs: PricerInputs, nowSec = Math.floor(Date.now() / 1000)): PassResult {
  const { opens, events, quotes, venueLegs } = inputs;
  const s = state.settings;
  const live = new Set<string>();
  const notes: string[] = [];
  const halts = state.halts();

  const post = (termsCid: string, t: TermsC, price: Priced, openPriceE8: bigint, model: { sigmaBps: number; yearSec: number } | null) => {
    if (nowSec < t.tradingStartSec || nowSec > price.untilSec - s.minQuoteLifeSec) return;
    const cap = price.capBase < s.marketCapBase ? price.capBase : s.marketCapBase;
    const ladder = buildLadder({
      fairTicks: price.fairTicks, halfSpreadTicks: price.halfSpreadTicks, minTick: s.maker.minTick, levels: s.levels, stepTicks: s.stepTicks,
      lotsPerLevel: s.lotsPerLevel, cashUnit: t.cashUnit, capBase: cap, ...usedStake(termsCid, venueLegs, quotes),
    });
    const marketId = marketIdFromDaml(t.marketId);
    live.add(marketId);
    state.board.put({
      marketId, damlMarketId: t.marketId, seriesId: seriesIdFromDaml(t.seriesKey), termsCid, seriesKey: t.seriesKey, symbol: t.symbol, index: t.index,
      tradingStartSec: t.tradingStartSec, lockAtSec: t.lockAtSec, expirySec: t.expirySec, quotingUntilSec: price.untilSec,
      cashUnit: t.cashUnit, feeRateBps: s.feeRateBps, fairTicks: price.fairTicks,
      sigmaBps: model?.sigmaBps ?? null, yearSec: model?.yearSec ?? null, minTick: s.maker.minTick, halfSpreadTicks: price.halfSpreadTicks,
      openPriceE8, spotE8: price.spotE8, up: ladder.up, down: ladder.down, asOfMs: Date.now(), state: "quoting",
    });
    notes.push(`${t.marketId} ${price.basis === "price" ? "" : `${price.basis} `}fair ${price.fairTicks} up ${ladder.up[0]?.[0] ?? "-"} down ${ladder.down[0]?.[0] ?? "-"}`);
  };

  for (const op of opens) {
    const t = state.terms.get(op.data.termsCid);
    const lane = t ? parseLaneKey(t.seriesKey) : null;
    const ticker = lane?.symbol ?? (t && isTicker(t.symbol) ? t.symbol : null);
    if (!t || !ticker) continue;
    if (lane?.basis === "gap") {
      const price = gapPrice({ t, ticker, openE8: op.data.openPriceE8, nowSec, spot: state.spot, halts, maker: s.maker });
      if ("skip" in price) notes.push(`${t.marketId} ${price.skip}`);
      else post(op.data.termsCid, t, price, op.data.openPriceE8, null);
      continue;
    }
    const untilSec = quotingUntilSec(t);
    if (nowSec < t.tradingStartSec || nowSec > untilSec - s.minQuoteLifeSec) continue;
    // A token lane's spot is its xStock (the asset its prints price), every other lane's its ticker.
    const spot = state.spot?.latest(lane ? spotSymbolOf(lane.symbol, lane.basis) : ticker, s.maker.spotMaxAgeSec) ?? null;
    if (!spot) {
      notes.push(`${t.marketId} no fresh spot`);
      continue;
    }
    const sigma = sigmaFor(s.maker, state.vol, ticker);
    if ("missing" in sigma) {
      notes.push(`${t.marketId} ${sigma.missing}`);
      continue;
    }
    const fair = fairYesTicks({ spotE8: spot.priceE8, openE8: op.data.openPriceE8, secondsLeft: t.expirySec - nowSec, ...sigma, minTick: s.maker.minTick });
    post(op.data.termsCid, t, { fairTicks: fair, halfSpreadTicks: s.maker.halfSpreadTicks, untilSec, capBase: s.marketCapBase, spotE8: spot.priceE8, basis: "price", why: "spot" }, op.data.openPriceE8, {
      sigmaBps: sigma.sigmaBps, yearSec: sigma.yearSec ?? TRADING_YEAR_SEC,
    });
  }

  for (const ev of events) {
    const t = state.terms.get(ev.data.termsCid);
    if (t) post(ev.data.termsCid, t, eventPrice(t, s.marketCapBase), 0n, null);
  }

  for (const e of state.board.all()) if (!live.has(e.marketId)) state.board.close(e.marketId);
  return { why: notes.length ? notes.join("; ") : "no Window quoting", detail: { quoting: live.size } };
}

export async function pricerPass(state: PricerState): Promise<PassResult> {
  state.inputs = await readInputs(state);
  return priceWindows(state, state.inputs);
}

/** A spot tick re-prices from the last ledger read at most this often (revamp step 2: the ladder follows spot, not a 1 s loop). */
export const SPOT_REPRICE_MIN_MS = 250;

export function startPricer(input: {
  venue: RoleSession;
  spot: SpotFeed | null;
  board: LadderBoard;
  log: (why: string) => void;
  settings?: PricerSettings;
  vol?: VolBoard | null;
  halts?: () => HaltBoard;
}): { stop: () => void } {
  const settings = input.settings ?? readPricerSettings();
  const state: PricerState = { venue: input.venue, spot: input.spot, vol: input.vol ?? null, board: input.board, settings, terms: new Map(), halts: input.halts ?? (() => ({})), inputs: null };
  input.log(`pricer: ${settings.levels} levels × ${settings.lotsPerLevel} lots every ${settings.stepTicks} ticks, half-spread ${settings.maker.halfSpreadTicks}, cap ${settings.marketCapBase} base/side, fee ${settings.feeRateBps} bps${input.spot ? "" : " · NO SPOT FEED"}`);
  const actor = runActor({ name: "pricer", log: input.log, dryRun: false, everyMs: settings.everyMs, pass: () => pricerPass(state) });
  // Between ledger reads, a spot tick re-prices the Windows from the cached read, throttled to SPOT_REPRICE_MIN_MS.
  let lastRepriceMs = 0;
  let pendingReprice: ReturnType<typeof setTimeout> | null = null;
  const reprice = () => {
    pendingReprice = null;
    if (!state.inputs) return;
    lastRepriceMs = Date.now();
    try {
      priceWindows(state, state.inputs);
    } catch (error) {
      input.log(`pricer: spot re-price failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const offSpot = input.spot?.subscribe(() => {
    if (pendingReprice) return;
    const waitMs = lastRepriceMs + SPOT_REPRICE_MIN_MS - Date.now();
    if (waitMs <= 0) reprice();
    else pendingReprice = setTimeout(reprice, waitMs);
  });
  return {
    stop: () => {
      offSpot?.();
      if (pendingReprice) clearTimeout(pendingReprice);
      actor.stop();
    },
  };
}
