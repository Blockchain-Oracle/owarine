/**
 * The seat's ticket contracts, read AS its party (C8c): the snapshot the seat routes act on, and what a landed write
 * did for the seat (the ticket or share it now holds, the cash it was paid).
 */
import { PRIVATE_BUCKET } from "@owarine/core/private";
import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@owarine/daml";
import type { CreatedEvent, DisclosedContract, JsTransaction, Party } from "@owarine/ledger";
import { decodeVenueCash, templateSuffix } from "../ops/canton/decode";
import {
  decodeBoostExitQuote, decodeBoostPosition, decodeBoostQuote, decodeLpShare, decodeParlayQuote, decodeParlayTicket, decodeRangeQuote,
  decodeRangeRound, decodeSupplyQuote, decodeWithdrawQuote,
  type BoostExitQuoteC, type BoostPositionC, type BoostQuoteC, type LpShareC, type ParlayQuoteC, type ParlayTicketC, type RangeQuoteC, type RangeRoundC,
  type SupplyQuoteC, type WithdrawQuoteC,
} from "../ops/tickets/decode";
import { decodeSettlementReceipt, isTicketReceiptProduct, type SettlementReceiptC } from "../ops/tickets/receipt";

const T = TICKET_TEMPLATE_IDS;
export const SEAT_TICKET_TEMPLATES = [
  T.RangeQuote, T.RangeRound, T.ParlayQuote, T.ParlayTicket, T.BoostQuote, T.BoostPosition, T.BoostExitQuote,
  TEMPLATE_IDS.LpShare, TEMPLATE_IDS.SupplyQuote, TEMPLATE_IDS.WithdrawQuote, TEMPLATE_IDS.VenueCash,
  TEMPLATE_IDS.SettlementReceipt,
];

export interface Row<X> {
  cid: string;
  data: X;
}

export interface TicketSeatSnapshot {
  party: Party;
  offset: number;
  cash: Array<{ cid: string; amount: bigint }>;
  rangeQuotes: Row<RangeQuoteC>[];
  rounds: Row<RangeRoundC>[];
  parlayQuotes: Row<ParlayQuoteC>[];
  tickets: Row<ParlayTicketC>[];
  boostQuotes: Row<BoostQuoteC>[];
  positions: Row<BoostPositionC>[];
  exitQuotes: Row<BoostExitQuoteC>[];
  lpShares: Row<LpShareC>[];
  supplyQuotes: Row<SupplyQuoteC>[];
  withdrawQuotes: Row<WithdrawQuoteC>[];
  /** The seat's ticket receipts (a pair leg's receipt has no product and is not listed here). */
  receipts: Array<Row<SettlementReceiptC> & { createdAtSec: number }>;
}

export interface WindowFacts {
  resolutionCid: string;
  outcome: "SideUp" | "SideDown" | null;
  openE8: bigint | null;
  closeE8: bigint | null;
  disclosure: DisclosedContract | null;
}

/**
 * `fromOffset` is the lease's start (C4d H3): a seat party is recycled, so a ticket, quote, share or receipt created
 * before this lease began is an earlier visitor's and is left out, for the reads and for every action that picks its
 * contract from this snapshot. Cash is fungible and swept at recycle, so it is kept whatever its offset.
 */
export function toTicketSnapshot(party: Party, events: readonly CreatedEvent[], offset: number, fromOffset = 0): TicketSeatSnapshot {
  const s: TicketSeatSnapshot = { party, offset, cash: [], rangeQuotes: [], rounds: [], parlayQuotes: [], tickets: [], boostQuotes: [], positions: [], exitQuotes: [], lpShares: [], supplyQuotes: [], withdrawQuotes: [], receipts: [] };
  const is = (e: CreatedEvent, templateId: string) => templateSuffix(e.templateId) === templateSuffix(templateId);
  for (const e of events) {
    const cid = e.contractId;
    const v = e.createArgument;
    if (!is(e, TEMPLATE_IDS.VenueCash) && Number(e.offset ?? 0) < fromOffset) continue;
    // Only what is the party's own: a seat is a stakeholder of nothing else, but the filter is stated anyway.
    if (is(e, TEMPLATE_IDS.VenueCash)) {
      const c = decodeVenueCash(v);
      if (c.owner === party && c.bucket !== PRIVATE_BUCKET) s.cash.push({ cid, amount: c.amount });
    } else if (is(e, T.RangeQuote)) {
      const q = decodeRangeQuote(v);
      if (q.user === party) s.rangeQuotes.push({ cid, data: q });
    } else if (is(e, T.RangeRound)) {
      const r = decodeRangeRound(v);
      if (r.owner === party) s.rounds.push({ cid, data: r });
    } else if (is(e, T.ParlayQuote)) {
      const q = decodeParlayQuote(v);
      if (q.user === party) s.parlayQuotes.push({ cid, data: q });
    } else if (is(e, T.ParlayTicket)) {
      const t = decodeParlayTicket(v);
      if (t.owner === party) s.tickets.push({ cid, data: t });
    } else if (is(e, T.BoostQuote)) {
      const q = decodeBoostQuote(v);
      if (q.user === party) s.boostQuotes.push({ cid, data: q });
    } else if (is(e, T.BoostPosition)) {
      const p = decodeBoostPosition(v);
      if (p.owner === party) s.positions.push({ cid, data: p });
    } else if (is(e, T.BoostExitQuote)) {
      const q = decodeBoostExitQuote(v);
      if (q.user === party) s.exitQuotes.push({ cid, data: q });
    } else if (is(e, TEMPLATE_IDS.LpShare)) {
      const l = decodeLpShare(v);
      if (l.provider === party) s.lpShares.push({ cid, data: l });
    } else if (is(e, TEMPLATE_IDS.SupplyQuote)) {
      const q = decodeSupplyQuote(v);
      if (q.provider === party) s.supplyQuotes.push({ cid, data: q });
    } else if (is(e, TEMPLATE_IDS.SettlementReceipt)) {
      const r = decodeSettlementReceipt(v);
      if (r.owner === party && isTicketReceiptProduct(r.product) && r.detail) s.receipts.push({ cid, data: r, createdAtSec: Math.floor(Date.parse(e.createdAt) / 1000) || 0 });
    } else if (is(e, TEMPLATE_IDS.WithdrawQuote)) {
      const q = decodeWithdrawQuote(v);
      if (q.provider === party) s.withdrawQuotes.push({ cid, data: q });
    }
  }
  return s;
}

export const createdEvents = (tx: JsTransaction): CreatedEvent[] => tx.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));

/** What a landed write did for the seat: the ticket or share it now holds, and the cash it was paid (change excluded). */
export function ticketOutcome(tx: JsTransaction, party: Party): { ticketCid: string | null; paidBase: bigint } {
  const created = createdEvents(tx);
  const owned = (e: CreatedEvent) => {
    const a = e.createArgument as { owner?: unknown; provider?: unknown };
    return a.owner === party || a.provider === party;
  };
  const kept = [T.RangeRound, T.ParlayTicket, T.BoostPosition, TEMPLATE_IDS.LpShare].map(templateSuffix);
  const ticket = created.find((e) => kept.includes(templateSuffix(e.templateId)) && owned(e));
  const paidBase = created
    .filter((e) => templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.VenueCash) && owned(e))
    .map((e) => decodeVenueCash(e.createArgument))
    .filter((c) => c.bucket !== "change")
    .reduce((s, c) => s + c.amount, 0n);
  return { ticketCid: ticket?.contractId ?? null, paidBase };
}

