/**
 * abu-pm-main 0.5.0 (`PM.Book`, K-092, K-200): the maker vault's receipts, and which venue legs are a book's.
 */
import type { Party } from "@owarine/ledger/pure";
import { decodeParts, DecodeError, type LegC, type Side } from "./decode";

const { obj, text, big, optional, side } = decodeParts;

/** 0.5.0 (`PM.Book`): a book position turned back into cash. */
export interface BookReceiptC {
  venue: Party;
  book: string;
  marketId: string;
  pairId: string;
  outcome: Side;
  resolved: Side | null;
  kind: "settled" | "merged" | "residual" | "refunded";
  lots: bigint;
  cost: bigint;
  proceeds: bigint;
}

const RECEIPT_KINDS = ["settled", "merged", "residual", "refunded"] as const;

export function decodeBookReceipt(v: unknown): BookReceiptC {
  const r = obj(v, "BookReceipt");
  const kind = text(r, "kind");
  if (!(RECEIPT_KINDS as readonly string[]).includes(kind)) throw new DecodeError(`BookReceipt kind ${kind}`);
  return {
    venue: text(r, "venue"), book: text(r, "book"), marketId: text(r, "marketId"), pairId: text(r, "pairId"), outcome: side(r.outcome),
    resolved: optional(r.resolved, side), kind: kind as BookReceiptC["kind"], lots: big(r, "lots"), cost: big(r, "cost"), proceeds: big(r, "proceeds"),
  };
}

/** The book a venue leg belongs to (the ledger's `legBook`): only a leg the venue owns, tagged with a reserve bucket. */
export const legBookOf = (l: Pick<LegC, "venue" | "owner" | "beneficiaryRef">): string | null =>
  l.owner === l.venue && l.beneficiaryRef !== null && l.beneficiaryRef.startsWith("reserve:") && l.beneficiaryRef !== "reserve:" ? l.beneficiaryRef : null;

