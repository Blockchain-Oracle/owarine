/**
 * The ticket desk's view of the ledger (C8c): per reserve, its one live `NavStatement` and `RiskBook`, the venue's
 * `EarnDesk`, and every contract the NAV counts. Rebuilt from the venue's active contracts; the desk swaps in the new
 * book and statement ids from each write's created events between reads, so a reserve's issuer never waits a pass.
 */
import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@owarine/daml";
import { decodeResolution, decodeVenueCash, pick, readActive, type Active, type ResolutionC, type RoleSession, type VenueCashC } from "@owarine/markets/ops/canton";
import {
  decodeBoostExitQuote, decodeBoostPosition, decodeBoostQuote, decodeLpShare, decodeNavStatement, decodeParlayQuote, decodeParlayTicket,
  decodeRangeQuote, decodeRangeRound, decodeRiskBook, decodeSupplyQuote, decodeWithdrawQuote, isTicketReserve,
  type BoostExitQuoteC, type BoostPositionC, type BoostQuoteC, type LpShareC, type NavStatementC, type ParlayQuoteC, type ParlayTicketC,
  type RangeQuoteC, type RangeRoundC, type RiskBookC, type SupplyQuoteC, type TicketReserveId, type WithdrawQuoteC,
} from "@owarine/markets/ops/tickets";

const T = TICKET_TEMPLATE_IDS;

/**
 * What every pass reads. `Resolution` is not here: one exists for every Window the venue ever ran and none is archived,
 * so reading them all every 4 s grew with the venue's age (650 KB per pass on DevNet after 4 h, C4g). They are read only
 * when a live round, ticket or position can use one (`readDesk`).
 */
export const DESK_TEMPLATES = [
  T.RiskBook, T.EarnDesk, T.RangeQuote, T.RangeRound, T.ParlayQuote, T.ParlayTicket, T.BoostQuote, T.BoostPosition, T.BoostExitQuote,
  TEMPLATE_IDS.NavStatement, TEMPLATE_IDS.LpShare, TEMPLATE_IDS.SupplyQuote, TEMPLATE_IDS.WithdrawQuote, TEMPLATE_IDS.VenueCash,
] as const;

export const reserveBucket = (reserveId: string) => `reserve:${reserveId}`;

export interface DeskSnapshot {
  atMs: number;
  earnDeskCid: string | null;
  navs: Map<TicketReserveId, Active<NavStatementC>>;
  books: Map<TicketReserveId, Active<RiskBookC>>;
  /** Reserve-bucket cash per reserve. */
  cash: Map<TicketReserveId, Active<VenueCashC>[]>;
  lpShares: Active<LpShareC>[];
  supplyQuotes: Active<SupplyQuoteC>[];
  withdrawQuotes: Active<WithdrawQuoteC>[];
  rangeQuotes: Active<RangeQuoteC>[];
  rounds: Active<RangeRoundC>[];
  parlayQuotes: Active<ParlayQuoteC>[];
  tickets: Active<ParlayTicketC>[];
  boostQuotes: Active<BoostQuoteC>[];
  positions: Active<BoostPositionC>[];
  exitQuotes: Active<BoostExitQuoteC>[];
  /** Resolution per terms contract id. */
  resolutions: Map<string, Active<ResolutionC>>;
}

export async function readDesk(venue: RoleSession, onBad?: (cid: string, error: unknown) => void): Promise<DeskSnapshot> {
  const acs = await readActive(venue, DESK_TEMPLATES);
  const me = venue.party;
  const mine = <X extends { venue: string }>(xs: Active<X>[]) => xs.filter((x) => x.data.venue === me);
  const navs = new Map<TicketReserveId, Active<NavStatementC>>();
  for (const n of mine(pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement, onBad))) {
    const id = n.data.reserveId;
    if (!isTicketReserve(id)) continue;
    const had = navs.get(id);
    if (!had || n.data.seq > had.data.seq) navs.set(id, n);
  }
  const books = new Map<TicketReserveId, Active<RiskBookC>>();
  for (const b of mine(pick(acs, T.RiskBook, decodeRiskBook, onBad))) if (isTicketReserve(b.data.reserveId)) books.set(b.data.reserveId, b);
  const cash = new Map<TicketReserveId, Active<VenueCashC>[]>();
  for (const c of mine(pick(acs, TEMPLATE_IDS.VenueCash, decodeVenueCash, onBad))) {
    if (c.data.owner !== me || !c.data.bucket.startsWith("reserve:")) continue;
    const id = c.data.bucket.slice("reserve:".length);
    if (!isTicketReserve(id)) continue;
    cash.set(id, [...(cash.get(id) ?? []), c]);
  }
  const rounds = mine(pick(acs, T.RangeRound, decodeRangeRound, onBad));
  const tickets = mine(pick(acs, T.ParlayTicket, decodeParlayTicket, onBad));
  const positions = mine(pick(acs, T.BoostPosition, decodeBoostPosition, onBad));
  // The keeper settles, resolves legs of and knocks out only these three: with none live, no Resolution is needed.
  const resolutions = new Map<string, Active<ResolutionC>>();
  if (rounds.length + tickets.length + positions.length > 0) {
    for (const r of mine(pick(await readActive(venue, [TEMPLATE_IDS.Resolution]), TEMPLATE_IDS.Resolution, decodeResolution, onBad))) resolutions.set(r.data.termsCid, r);
  }
  const earn = acs.find((c) => c.createdEvent.templateId.endsWith(":PM.Tickets.Earn:EarnDesk") && (c.createdEvent.createArgument as { venue?: string }).venue === me);
  return {
    atMs: Date.now(),
    earnDeskCid: earn?.createdEvent.contractId ?? null,
    navs,
    books,
    cash,
    lpShares: mine(pick(acs, TEMPLATE_IDS.LpShare, decodeLpShare, onBad)),
    supplyQuotes: mine(pick(acs, TEMPLATE_IDS.SupplyQuote, decodeSupplyQuote, onBad)),
    withdrawQuotes: mine(pick(acs, TEMPLATE_IDS.WithdrawQuote, decodeWithdrawQuote, onBad)),
    rangeQuotes: mine(pick(acs, T.RangeQuote, decodeRangeQuote, onBad)),
    rounds,
    parlayQuotes: mine(pick(acs, T.ParlayQuote, decodeParlayQuote, onBad)),
    tickets,
    boostQuotes: mine(pick(acs, T.BoostQuote, decodeBoostQuote, onBad)),
    positions,
    exitQuotes: mine(pick(acs, T.BoostExitQuote, decodeBoostExitQuote, onBad)),
    resolutions,
  };
}

/** What one reserve's statement is built from (`Earn_PublishNav`'s inputs), and its value by the ledger's own rule. */
export function navInputsOf(s: DeskSnapshot, reserveId: TicketReserveId) {
  const of = <X extends { reserveId: string }>(xs: Active<X>[]) => xs.filter((x) => x.data.reserveId === reserveId);
  const cash = s.cash.get(reserveId) ?? [];
  const lpShares = of(s.lpShares);
  const withdrawQuotes = of(s.withdrawQuotes);
  const rangeQuotes = of(s.rangeQuotes);
  const rounds = of(s.rounds);
  const parlayQuotes = of(s.parlayQuotes);
  const tickets = of(s.tickets);
  const boostQuotes = of(s.boostQuotes);
  const positions = of(s.positions);
  const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);
  const liquid = sum(cash.map((c) => c.data.amount));
  const locked =
    sum(withdrawQuotes.map((q) => q.data.cashOut)) +
    sum([...rangeQuotes, ...rounds, ...parlayQuotes, ...tickets].map((x) => x.data.maxPayout - x.data.stake)) +
    sum([...boostQuotes, ...positions].map((x) => x.data.fronted));
  return {
    inputs: {
      cash: cash.map((c) => c.cid), lpShares: lpShares.map((c) => c.cid), withdrawQuotes: withdrawQuotes.map((c) => c.cid),
      rangeQuotes: rangeQuotes.map((c) => c.cid), rounds: rounds.map((c) => c.cid), parlayQuotes: parlayQuotes.map((c) => c.cid),
      tickets: tickets.map((c) => c.cid), boostQuotes: boostQuotes.map((c) => c.cid), positions: positions.map((c) => c.cid),
    },
    liquid,
    locked,
    assets: liquid + locked,
    shares: sum(lpShares.map((l) => l.data.shares)),
    openTickets: rounds.length + tickets.length + positions.length,
  };
}
