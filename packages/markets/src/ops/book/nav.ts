/**
 * The maker vault's book as ops reads it, and its statement by the ledger's own rule (`PM.Maker.Maker_PublishNav`,
 * abu-pm-main 0.5.0). Pure: the ledger recomputes every figure from the contracts ops passes, so this mirror only
 * decides WHAT to pass and when a new statement is due; a disagreement is the ledger's to settle, never ops'.
 *
 * The mark (conservative, and said so on every surface):
 *   cash, withdraw locks, quote locks, buy-back locks   at their amount
 *   a book leg        min(cost, backing); with its Window's Resolution, also at most what that pays; 0 once the
 *                     Window has expired without one
 *   a residual        the lesser of its void and resolved values, or the one its Resolution picks
 */
import type { Active, BuyQuoteC, LegC, NettedResidualC, QuoteC, ResolutionC, VenueCashC } from "../canton/decode";
import type { BookReceiptC } from "../canton/decode-book";
import { legBookOf } from "../canton/decode-book";
import type { LpShareC, NavStatementC, SupplyQuoteC, WithdrawQuoteC } from "../tickets/decode";
import type { MakerNavInputsC } from "./commands";

/** The maker vault's reserve id, and the bucket its cash sits in. */
export const MAKER_RESERVE = "maker";
export const MAKER_BOOK = `reserve:${MAKER_RESERVE}`;

export interface MakerSnapshot {
  atMs: number;
  /** The book's live statement (the highest `seq` of reserve `maker`). */
  nav: Active<NavStatementC> | null;
  deskCid: string | null;
  cash: Active<VenueCashC>[];
  lpShares: Active<LpShareC>[];
  supplyQuotes: Active<SupplyQuoteC>[];
  withdrawQuotes: Active<WithdrawQuoteC>[];
  quotes: Active<QuoteC>[];
  buyQuotes: Active<BuyQuoteC>[];
  /** The venue's legs tagged with the book (`legBookOf`). */
  legs: Active<LegC>[];
  residuals: Active<NettedResidualC>[];
  receipts: Active<BookReceiptC>[];
  /** Resolution per terms contract id. */
  resolutions: ReadonlyMap<string, Active<ResolutionC>>;
  /** The Daml market id and expiry (epoch seconds) per terms contract id, for every Window the book is on. */
  markets: ReadonlyMap<string, MarketInfo>;
}

export interface MarketInfo {
  marketId: string;
  expirySec: number;
}

/** Whether a contract is the book's. */
export const isBookCash = (venue: string, c: VenueCashC) => c.owner === venue && c.venue === venue && c.bucket === MAKER_BOOK;
export const isBookQuote = (x: { book?: string | null }) => (x.book ?? null) === MAKER_BOOK;
export const isBookLeg = (l: LegC) => legBookOf(l) === MAKER_BOOK;

const quantityOf = (l: Pick<LegC, "lots" | "cashUnit">) => l.lots * 1000n * l.cashUnit;
export const quoteLockOf = (q: Pick<QuoteC, "lots" | "priceTicks" | "cashUnit">) => q.lots * BigInt(1000 - q.priceTicks) * q.cashUnit;
const min = (a: bigint, b: bigint) => (a < b ? a : b);

/** What the book paid for a leg: its recorded cost (a buy-back pays the price), else its backing. */
export const paidFor = (l: Pick<LegC, "backingShare" | "bookCost">) => l.bookCost ?? l.backingShare;

/** The ledger's `legPayout` owner half: void → backing + fee, won → the pair's quantity, lost → 0. */
export function legPayoutOf(l: LegC, r: ResolutionC): bigint {
  if (r.outcome === null) return l.backingShare + l.feePaid;
  return r.outcome === l.outcome ? quantityOf(l) : 0n;
}

/** `PM.Maker.legMark`. */
export function legMark(l: LegC, asOfSec: number, res: ResolutionC | null, expirySec: number | null): bigint {
  const cost = min(l.backingShare, paidFor(l));
  if (res) return min(cost, legPayoutOf(l, res));
  // A Window whose expiry ops has not read yet counts at cost; the ledger reads it and may count 0.
  return expirySec !== null && asOfSec >= expirySec ? 0n : cost;
}

/** `PM.Maker.residualMark`. */
export function residualMark(x: NettedResidualC, res: ResolutionC | null): bigint {
  if (res) return res.outcome === null ? x.heldIfVoid : x.owedIfResolved;
  return min(x.heldIfVoid, x.owedIfResolved);
}

export interface MakerNav {
  inputs: MakerNavInputsC;
  /** Reserve-bucket cash: what a provider can be paid from right now. */
  liquid: bigint;
  /** Cash locked in open book quotes, buy-backs and providers' withdraw quotes. */
  locked: bigint;
  /** The book's positions at their mark. */
  positions: bigint;
  assets: bigint;
  shares: bigint;
}

const sum = (xs: readonly bigint[]) => xs.reduce((a, b) => a + b, 0n);

/** The statement the ledger would publish at `asOfSec` from this snapshot, and exactly the inputs it needs. */
export function makerNav(s: MakerSnapshot, asOfSec: number): MakerNav {
  const res = (termsCid: string) => s.resolutions.get(termsCid) ?? null;
  const terms = new Set([...s.legs.map((l) => l.data.termsCid), ...s.residuals.map((r) => r.data.termsCid)]);
  const resolutions = [...terms].flatMap((t) => {
    const r = res(t);
    return r ? [r.cid] : [];
  });
  const liquid = sum(s.cash.map((c) => c.data.amount));
  const locked =
    sum(s.withdrawQuotes.map((q) => q.data.cashOut)) + sum(s.quotes.map((q) => quoteLockOf(q.data))) + sum(s.buyQuotes.map((q) => q.data.locked));
  const positions =
    sum(s.legs.map((l) => legMark(l.data, asOfSec, res(l.data.termsCid)?.data ?? null, s.markets.get(l.data.termsCid)?.expirySec ?? null))) +
    sum(s.residuals.map((x) => residualMark(x.data, res(x.data.termsCid)?.data ?? null)));
  return {
    inputs: {
      cash: s.cash.map((c) => c.cid), lpShares: s.lpShares.map((c) => c.cid), withdrawQuotes: s.withdrawQuotes.map((c) => c.cid),
      quotes: s.quotes.map((c) => c.cid), buyQuotes: s.buyQuotes.map((c) => c.cid), legs: s.legs.map((c) => c.cid),
      residuals: s.residuals.map((c) => c.cid), resolutions,
    },
    liquid,
    locked,
    positions,
    assets: liquid + locked + positions,
    shares: sum(s.lpShares.map((l) => l.data.shares)),
  };
}
