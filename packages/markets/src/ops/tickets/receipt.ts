/**
 * `PM.Publication.SettlementReceipt` (abu-pm-main 0.4.0) → a typed shape. A ticket's receipt carries its product and a
 * `ReceiptDetail`; a pair leg's has neither. abu-pm-tickets 0.1.2 (K-088) writes one on every way a ticket ends, so
 * the `detail.result` vocabulary is "won" | "lost" | "void" (settle, claim, stale refund or void) plus "sold" and
 * "knocked-out" for a boost. Server-only, same rules as `./decode.ts`.
 */
import { fromDamlInt, type Party } from "@agari/ledger";
import { DecodeError, type Side } from "../canton/decode";

type Raw = Record<string, unknown>;

const obj = (v: unknown, what: string): Raw => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new DecodeError(`${what} is not a record`);
  return v as Raw;
};
const text = (r: Raw, k: string): string => {
  const v = r[k];
  if (typeof v !== "string") throw new DecodeError(`field ${k} is not text`);
  return v;
};
const big = (r: Raw, k: string): bigint => fromDamlInt(r[k], k);
const side = (v: unknown, what: string): Side => {
  if (v === "SideUp" || v === "SideDown") return v;
  throw new DecodeError(`${what} ${JSON.stringify(v)} is not SideUp/SideDown`);
};

export const TICKET_RECEIPT_PRODUCTS = ["range", "moonshot", "parlay", "boost", "short"] as const;
export type TicketReceiptProduct = (typeof TICKET_RECEIPT_PRODUCTS)[number];
export const TICKET_RECEIPT_RESULTS = ["won", "lost", "void", "sold", "knocked-out"] as const;
export type TicketReceiptResult = (typeof TICKET_RECEIPT_RESULTS)[number];

export interface ReceiptDetailC {
  reserveId: string;
  marketIds: string[];
  pick: string;
  stake: bigint;
  toReserve: bigint;
  result: string;
}

export interface SettlementReceiptC {
  venue: Party;
  owner: Party;
  marketId: string;
  pairId: string;
  outcome: Side;
  resolved: Side | null;
  lots: bigint;
  cashUnit: bigint;
  backingShare: bigint;
  cost: bigint;
  payout: bigint;
  fee: bigint;
  /** null = a pair leg's receipt. */
  product: string | null;
  detail: ReceiptDetailC | null;
}

export function decodeSettlementReceipt(v: unknown): SettlementReceiptC {
  const r = obj(v, "SettlementReceipt");
  const d = r.detail === null || r.detail === undefined ? null : obj(r.detail, "ReceiptDetail");
  const ids = d?.marketIds;
  if (d && (!Array.isArray(ids) || ids.some((x) => typeof x !== "string"))) throw new DecodeError("marketIds is not a list of text");
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), marketId: text(r, "marketId"), pairId: text(r, "pairId"),
    outcome: side(r.outcome, "outcome"), resolved: r.resolved === null || r.resolved === undefined ? null : side(r.resolved, "resolved"),
    lots: big(r, "lots"), cashUnit: big(r, "cashUnit"), backingShare: big(r, "backingShare"), cost: big(r, "cost"), payout: big(r, "payout"), fee: big(r, "fee"),
    product: r.product === null || r.product === undefined ? null : text(r, "product"),
    detail: d ? { reserveId: text(d, "reserveId"), marketIds: ids as string[], pick: text(d, "pick"), stake: big(d, "stake"), toReserve: big(d, "toReserve"), result: text(d, "result") } : null,
  };
}

export const isTicketReceiptProduct = (p: string | null): p is TicketReceiptProduct => p !== null && (TICKET_RECEIPT_PRODUCTS as readonly string[]).includes(p);
export const isTicketReceiptResult = (r: string): r is TicketReceiptResult => (TICKET_RECEIPT_RESULTS as readonly string[]).includes(r);

export { parseBoostPick, parseParlayPick, parseRangePick } from "../../tickets/receipt-pick";
