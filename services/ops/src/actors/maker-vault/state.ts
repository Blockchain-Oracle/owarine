/**
 * The maker vault's book as the venue sees it (abu-pm-main 0.5.0): its live statement, its desk, its cash, providers'
 * shares and quotes, the book's open quotes, buy-backs, legs and residuals, its receipts, and the Resolution and
 * expiry of every Window it is on. Rebuilt from the venue's active contracts each pass.
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import {
  decodeBookReceipt, decodeBuyQuote, decodeLeg, decodeNettedResidual, decodeQuote, decodeResolution, decodeTerms, decodeVenueCash, pick, readActive,
  type Active, type ResolutionC, type RoleSession,
} from "@owarine/markets/ops/canton";
import { isBookCash, isBookLeg, isBookQuote, MAKER_BOOK, MAKER_RESERVE, type MakerSnapshot, type MarketInfo } from "@owarine/markets/ops/book";
import { decodeLpShare, decodeNavStatement, decodeSupplyQuote, decodeWithdrawQuote, type NavStatementC } from "@owarine/markets/ops/tickets";

/**
 * What every pass reads. `Resolution` and `MarketTerms` are not here: both exist for every Window the venue ever ran and
 * neither is archived, so reading them every 5 s grew with the venue's age (1 MB per pass on DevNet after 4 h, C4g). They
 * are read only when the book holds a leg, residual or quote on some Window (`readMakerSnapshot`).
 */
export const MAKER_TEMPLATES = [
  TEMPLATE_IDS.NavStatement, TEMPLATE_IDS.MakerDesk, TEMPLATE_IDS.VenueCash, TEMPLATE_IDS.LpShare, TEMPLATE_IDS.SupplyQuote, TEMPLATE_IDS.WithdrawQuote,
  TEMPLATE_IDS.Quote, TEMPLATE_IDS.BuyQuote, TEMPLATE_IDS.Leg, TEMPLATE_IDS.NettedResidual, TEMPLATE_IDS.BookReceipt,
] as const;

export async function readMakerSnapshot(venue: RoleSession, onBad?: (cid: string, error: unknown) => void): Promise<MakerSnapshot> {
  const acs = await readActive(venue, MAKER_TEMPLATES);
  const me = venue.party;
  const mine = <X extends { venue: string }>(xs: Active<X>[]) => xs.filter((x) => x.data.venue === me);
  let nav: Active<NavStatementC> | null = null;
  for (const n of mine(pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement, onBad))) {
    if (n.data.reserveId === MAKER_RESERVE && (!nav || n.data.seq > nav.data.seq)) nav = n;
  }
  const desk = acs.find((c) => c.createdEvent.templateId.endsWith(":PM.Maker:MakerDesk") && (c.createdEvent.createArgument as { venue?: string }).venue === me);
  const legs = mine(pick(acs, TEMPLATE_IDS.Leg, decodeLeg, onBad)).filter((l) => isBookLeg(l.data));
  // A residual is the venue's alone (its only signatory), so every one read as the venue is the venue's.
  const residuals = pick(acs, TEMPLATE_IDS.NettedResidual, decodeNettedResidual, onBad).filter((r) => isBookQuote(r.data));
  const quotes = mine(pick(acs, TEMPLATE_IDS.Quote, decodeQuote, onBad)).filter((q) => isBookQuote(q.data));
  const buyQuotes = mine(pick(acs, TEMPLATE_IDS.BuyQuote, decodeBuyQuote, onBad)).filter((q) => isBookQuote(q.data));
  // Every use of a Resolution or a Window's terms is keyed by a book contract's terms: with none, neither is read.
  const wanted = new Set([...legs, ...residuals, ...quotes, ...buyQuotes].map((x) => x.data.termsCid));
  const resolutions = new Map<string, Active<ResolutionC>>();
  const markets = new Map<string, MarketInfo>();
  if (wanted.size > 0) {
    const windows = await readActive(venue, [TEMPLATE_IDS.Resolution, TEMPLATE_IDS.MarketTerms]);
    for (const r of mine(pick(windows, TEMPLATE_IDS.Resolution, decodeResolution, onBad))) if (wanted.has(r.data.termsCid)) resolutions.set(r.data.termsCid, r);
    for (const t of mine(pick(windows, TEMPLATE_IDS.MarketTerms, decodeTerms, onBad))) {
      if (wanted.has(t.cid)) markets.set(t.cid, { marketId: t.data.marketId, expirySec: t.data.expirySec });
    }
  }
  const receipts = mine(pick(acs, TEMPLATE_IDS.BookReceipt, decodeBookReceipt, onBad)).filter((r) => r.data.book === MAKER_BOOK);
  return {
    atMs: Date.now(),
    nav,
    deskCid: desk?.createdEvent.contractId ?? null,
    cash: mine(pick(acs, TEMPLATE_IDS.VenueCash, decodeVenueCash, onBad)).filter((c) => isBookCash(me, c.data)),
    lpShares: mine(pick(acs, TEMPLATE_IDS.LpShare, decodeLpShare, onBad)).filter((s) => s.data.reserveId === MAKER_RESERVE),
    supplyQuotes: mine(pick(acs, TEMPLATE_IDS.SupplyQuote, decodeSupplyQuote, onBad)).filter((q) => q.data.reserveId === MAKER_RESERVE),
    withdrawQuotes: mine(pick(acs, TEMPLATE_IDS.WithdrawQuote, decodeWithdrawQuote, onBad)).filter((q) => q.data.reserveId === MAKER_RESERVE),
    quotes,
    buyQuotes,
    legs,
    residuals,
    receipts,
    resolutions,
    markets,
  };
}
