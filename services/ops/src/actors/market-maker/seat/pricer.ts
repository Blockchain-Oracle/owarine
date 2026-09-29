/**
 * The pricer (plan "Venue operations": the seed maker's fair-value math, unchanged, becomes the pricer). For every
 * Window with a recorded open print it prices `P(close ≥ open)` from the live spot (`fair.ts`), builds the venue price
 * ladder around it (`ladder.ts`, `quote.ts`'s `quotePair`) within the per-market cap, and puts it on the board the
 * issuer walks and `/ladders/stream` publishes. It writes nothing to the ledger, so it runs the same live or dry.
 */
import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { TEMPLATE_IDS } from "@agari/daml";
import { decodeLeg, decodeOpenPrint, decodeQuote, decodeTerms, pick, readActive, type RoleSession, type TermsC } from "@agari/markets/ops/canton";
import type { SpotFeed } from "../../../prices/spot";
import { runActor, type PassResult } from "../../../runtime/actor";
import { readSeatMakerEnv, type SeatMakerEnv } from "./env";
import { fairYesTicks } from "./fair";
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
  board: LadderBoard;
  settings: PricerSettings;
  terms: Map<string, TermsC>;
}

const isTicker = (s: string): s is TickerSymbol => s in TICKERS;

export async function pricerPass(state: PricerState): Promise<PassResult> {
  const acs = await readActive(state.venue, [TEMPLATE_IDS.OpenPrint, TEMPLATE_IDS.Quote, TEMPLATE_IDS.Leg]);
  const opens = pick(acs, TEMPLATE_IDS.OpenPrint, decodeOpenPrint);
  if (opens.some((o) => !state.terms.has(o.data.termsCid))) {
    for (const t of pick(await readActive(state.venue, [TEMPLATE_IDS.MarketTerms]), TEMPLATE_IDS.MarketTerms, decodeTerms)) state.terms.set(t.cid, t.data);
  }
  const quotes = pick(acs, TEMPLATE_IDS.Quote, decodeQuote);
  const venueLegs = pick(acs, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.owner === state.venue.party);
  const nowSec = Math.floor(Date.now() / 1000);
  const s = state.settings;
  const live = new Set<string>();
  const notes: string[] = [];
  for (const op of opens) {
    const t = state.terms.get(op.data.termsCid);
    if (!t || !isTicker(t.symbol)) continue;
    const untilSec = quotingUntilSec(t);
    if (nowSec < t.tradingStartSec || nowSec > untilSec - s.minQuoteLifeSec) continue;
    const spot = state.spot?.latest(t.symbol, s.maker.spotMaxAgeSec) ?? null;
    if (!spot) {
      notes.push(`${t.marketId} no fresh spot`);
      continue;
    }
    const fair = fairYesTicks({ spotE8: spot.priceE8, openE8: op.data.openPriceE8, secondsLeft: t.expirySec - nowSec, sigmaBps: s.maker.sigmaBps(t.symbol), minTick: s.maker.minTick });
    // Venue stake held against each side: its legs opposite the users' and its live quotes on that side.
    let usedUpBase = 0n;
    let usedDownBase = 0n;
    for (const l of venueLegs) if (l.data.termsCid === op.data.termsCid) l.data.outcome === "SideDown" ? (usedUpBase += l.data.backingShare) : (usedDownBase += l.data.backingShare);
    for (const q of quotes) {
      if (q.data.termsCid !== op.data.termsCid) continue;
      const stake = q.data.lots * BigInt(1000 - q.data.priceTicks) * q.data.cashUnit;
      if (q.data.side === "SideUp") usedUpBase += stake;
      else usedDownBase += stake;
    }
    const ladder = buildLadder({
      fairTicks: fair, halfSpreadTicks: s.maker.halfSpreadTicks, minTick: s.maker.minTick, levels: s.levels, stepTicks: s.stepTicks,
      lotsPerLevel: s.lotsPerLevel, cashUnit: t.cashUnit, capBase: s.marketCapBase, usedUpBase, usedDownBase,
    });
    live.add(t.marketId);
    state.board.put({
      marketId: t.marketId, termsCid: op.data.termsCid, seriesKey: t.seriesKey, symbol: t.symbol, index: t.index,
      tradingStartSec: t.tradingStartSec, lockAtSec: t.lockAtSec, expirySec: t.expirySec, quotingUntilSec: untilSec,
      cashUnit: t.cashUnit, feeRateBps: s.feeRateBps, fairTicks: fair, openPriceE8: op.data.openPriceE8, spotE8: spot.priceE8,
      up: ladder.up, down: ladder.down, asOfMs: Date.now(), state: "quoting",
    });
    notes.push(`${t.marketId} fair ${fair} up ${ladder.up[0]?.[0] ?? "-"} down ${ladder.down[0]?.[0] ?? "-"}`);
  }
  for (const e of state.board.all()) if (!live.has(e.marketId)) state.board.close(e.marketId);
  return { why: notes.length ? notes.join("; ") : "no Window quoting", detail: { quoting: live.size } };
}

export function startPricer(input: { venue: RoleSession; spot: SpotFeed | null; board: LadderBoard; log: (why: string) => void; settings?: PricerSettings }): { stop: () => void } {
  const settings = input.settings ?? readPricerSettings();
  const state: PricerState = { venue: input.venue, spot: input.spot, board: input.board, settings, terms: new Map() };
  input.log(`pricer: ${settings.levels} levels × ${settings.lotsPerLevel} lots every ${settings.stepTicks} ticks, half-spread ${settings.maker.halfSpreadTicks}, cap ${settings.marketCapBase} base/side, fee ${settings.feeRateBps} bps${input.spot ? "" : " · NO SPOT FEED"}`);
  return runActor({ name: "pricer", log: input.log, dryRun: false, everyMs: settings.everyMs, pass: () => pricerPass(state) });
}
