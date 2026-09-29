/**
 * The seat-facing contracts as the routes read them: Daml JSON decoded with the generated `@agari/daml` codecs, then
 * every `Int` converted through `@agari/ledger`'s units boundary (strings to bigint, never `Number`) and every `Time`
 * to epoch ms. A payload that fails its codec throws: a contract we cannot read is never guessed at.
 */
import { PM, TEMPLATE_IDS } from "@agari/daml";
import type { MarketId, Side } from "@agari/core/types";
import { fromDamlInt, type CreatedEvent } from "@agari/ledger";
import { appMarketId } from "./ids";

export interface CashView {
  cid: string;
  amount: bigint;
  bucket: string;
}

export interface LegView {
  cid: string;
  damlMarketId: string;
  marketId: MarketId;
  termsCid: string;
  pairId: string;
  side: Side;
  lots: bigint;
  cashUnit: bigint;
  backingShare: bigint;
  feePaid: bigint;
  refundAfterMs: number;
  createdAtMs: number;
}

export interface QuoteView {
  cid: string;
  damlMarketId: string;
  marketId: MarketId;
  termsCid: string;
  pairId: string;
  side: Side;
  priceTicks: bigint;
  lots: bigint;
  cashUnit: bigint;
  fee: bigint;
  validUntilMs: number;
  lockAtMs: number;
  refundAfterMs: number;
}

/** A firm buy-back of (part of) one of the seat's legs (C7a exit): `lots` at `priceTicks` pays `locked`. */
export interface BuyQuoteView {
  cid: string;
  legCid: string;
  termsCid: string;
  pairId: string;
  side: Side;
  lots: bigint;
  cashUnit: bigint;
  priceTicks: bigint;
  locked: bigint;
  validUntilMs: number;
}

export interface TermsView {
  cid: string;
  damlMarketId: string;
  marketId: MarketId;
  seriesKey: string;
  symbol: string;
  cashUnit: bigint;
  tradingStartMs: number;
  lockAtMs: number;
  expiryMs: number;
  refundAfterMs: number;
}

export interface ResolutionView {
  cid: string;
  termsCid: string;
  damlMarketId: string;
  /** null = void. */
  outcome: Side | null;
  voidReason: string | null;
  createdAtMs: number;
  /** The disclosed-contract fields `Leg_Claim` needs (the seat is not a stakeholder of the resolution). */
  disclosure: { createdEventBlob: string; templateId: string; contractId: string; synchronizerId: string } | null;
}

/** `#pkg:Module:Entity` or `<pkgId>:Module:Entity` → `Module:Entity`, so package-id and package-name forms compare. */
export const entityOf = (templateId: string): string => templateId.split(":").slice(1).join(":");
const ENTITY = {
  VenueCash: entityOf(TEMPLATE_IDS.VenueCash),
  Leg: entityOf(TEMPLATE_IDS.Leg),
  Quote: entityOf(TEMPLATE_IDS.Quote),
  BuyQuote: entityOf(TEMPLATE_IDS.BuyQuote),
  MarketTerms: entityOf(TEMPLATE_IDS.MarketTerms),
  Resolution: entityOf(TEMPLATE_IDS.Resolution),
} as const;
export const isEntity = (event: CreatedEvent, name: keyof typeof ENTITY): boolean => entityOf(event.templateId) === ENTITY[name];

const sideOf = (s: PM.Types.Side): Side => (s === "SideUp" ? "up" : "down");
export const toDamlSide = (s: Side): PM.Types.Side => (s === "up" ? "SideUp" : "SideDown");
const ms = (t: string, what: string): number => {
  const v = Date.parse(t);
  if (!Number.isFinite(v)) throw new Error(`${what} is not a Daml Time: ${t}`);
  return v;
};

export function cashView(e: CreatedEvent): CashView {
  const c = PM.Money.VenueCash.decoder.runWithException(e.createArgument);
  return { cid: e.contractId, amount: fromDamlInt(c.amount, "VenueCash.amount"), bucket: c.bucket };
}

export function legView(e: CreatedEvent): LegView & { owner: string } {
  const l = PM.Leg.Leg.decoder.runWithException(e.createArgument);
  return {
    cid: e.contractId,
    owner: l.owner,
    damlMarketId: l.marketId,
    marketId: appMarketId(l.marketId),
    termsCid: l.termsCid,
    pairId: l.pairId,
    side: sideOf(l.outcome),
    lots: fromDamlInt(l.lots, "Leg.lots"),
    cashUnit: fromDamlInt(l.cashUnit, "Leg.cashUnit"),
    backingShare: fromDamlInt(l.backingShare, "Leg.backingShare"),
    feePaid: fromDamlInt(l.feePaid, "Leg.feePaid"),
    refundAfterMs: ms(l.refundAfter, "Leg.refundAfter"),
    createdAtMs: ms(e.createdAt, "createdAt"),
  };
}

export function quoteView(e: CreatedEvent): QuoteView & { user: string } {
  const q = PM.Quote.Quote.decoder.runWithException(e.createArgument);
  return {
    cid: e.contractId,
    user: q.user,
    damlMarketId: q.marketId,
    marketId: appMarketId(q.marketId),
    termsCid: q.termsCid,
    pairId: q.pairId,
    side: sideOf(q.side),
    priceTicks: fromDamlInt(q.priceTicks, "Quote.priceTicks"),
    lots: fromDamlInt(q.lots, "Quote.lots"),
    cashUnit: fromDamlInt(q.cashUnit, "Quote.cashUnit"),
    fee: fromDamlInt(q.fee, "Quote.fee"),
    validUntilMs: ms(q.validUntil, "Quote.validUntil"),
    lockAtMs: ms(q.lockAt, "Quote.lockAt"),
    refundAfterMs: ms(q.refundAfter, "Quote.refundAfter"),
  };
}

export function buyQuoteView(e: CreatedEvent): BuyQuoteView & { user: string } {
  const q = PM.Quote.BuyQuote.decoder.runWithException(e.createArgument);
  return {
    cid: e.contractId,
    user: q.user,
    legCid: q.legCid,
    termsCid: q.termsCid,
    pairId: q.pairId,
    side: sideOf(q.outcome),
    lots: fromDamlInt(q.lots, "BuyQuote.lots"),
    cashUnit: fromDamlInt(q.cashUnit, "BuyQuote.cashUnit"),
    priceTicks: fromDamlInt(q.priceTicks, "BuyQuote.priceTicks"),
    locked: fromDamlInt(q.locked, "BuyQuote.locked"),
    validUntilMs: ms(q.validUntil, "BuyQuote.validUntil"),
  };
}

export function termsView(e: CreatedEvent): TermsView {
  const t = PM.Market.MarketTerms.decoder.runWithException(e.createArgument);
  return {
    cid: e.contractId,
    damlMarketId: t.marketId,
    marketId: appMarketId(t.marketId),
    seriesKey: t.seriesKey,
    symbol: t.symbol,
    cashUnit: fromDamlInt(t.cashUnit, "MarketTerms.cashUnit"),
    tradingStartMs: ms(t.tradingStart, "tradingStart"),
    lockAtMs: ms(t.lockAt, "lockAt"),
    expiryMs: ms(t.expiry, "expiry"),
    refundAfterMs: ms(t.refundAfter, "refundAfter"),
  };
}

export function resolutionView(e: CreatedEvent, synchronizerId: string): ResolutionView {
  const r = PM.Market.Resolution.decoder.runWithException(e.createArgument);
  return {
    cid: e.contractId,
    termsCid: r.termsCid,
    damlMarketId: r.marketId,
    outcome: r.outcome === null ? null : sideOf(r.outcome),
    voidReason: r.voidReason === null ? null : r.voidReason.tag,
    createdAtMs: ms(e.createdAt, "createdAt"),
    disclosure: e.createdEventBlob
      ? { createdEventBlob: e.createdEventBlob, templateId: e.templateId, contractId: e.contractId, synchronizerId }
      : null,
  };
}
