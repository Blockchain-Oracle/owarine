/**
 * The JSON shapes of the ticket routes (C8c): ops' `POST /internal/tickets/*`, the web's `/api/ledger/tickets/*`, and
 * this package's client half, so all three encode and decode the same bytes. Money travels as decimal strings and is
 * parsed back to bigint strictly; contract ids are hex; a party never travels from a browser (the web adds it from the
 * lease on its way to ops).
 */
import { diagnosisSchema, isMarketId, isSignature, type MarketId, type Signature } from "@agari/core/types";
import { z } from "zod";

const baseUnits = z.string().regex(/^-?\d+$/, "an integer string").transform((s) => BigInt(s));
const uint = z.string().regex(/^\d{1,19}$/, "a non-negative integer string").transform((s) => BigInt(s));
const marketId = z.custom<MarketId>(isMarketId, "expected a base58 market id");
const side = z.enum(["up", "down"]);
const rangeSide = z.enum(["inside", "outside"]);
const cid = z.string().regex(/^[0-9a-f]{40,400}$/, "a contract id");
const txHash = z.custom<Signature>(isSignature, "expected a Canton update id");
export const ticketReserveWire = z.enum(["range", "parlay", "boost"]);
const mode = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixStake"), stakeBase: uint }),
  z.object({ kind: z.literal("fixPayout"), maxPayoutBase: uint }),
]);

// ---- core quote shapes on the wire ----------------------------------------------------------------

export const rangeQuoteWire = z.object({
  side: rangeSide,
  insideProbE6: baseUnits,
  probRaw: baseUnits,
  stakeBase: baseUnits,
  maxPayoutBase: baseUnits,
  multiplierMilli: z.number(),
  decimals: z.number().int(),
  quotedAtMs: z.number(),
});
export const rangeBasisWire = z.object({ centerQE6: z.number(), sigmaE8: z.number(), tauSec: z.number() });

export const parlayQuoteWire = z.object({
  legPricesRaw: z.array(baseUnits),
  legProbBps: z.array(z.number()),
  combinedProbRaw: baseUnits,
  rawCombinedProbRaw: baseUnits,
  correlated: z.boolean(),
  stakeBase: baseUnits,
  maxPayoutBase: baseUnits,
  multiplierMilli: z.number(),
  decimals: z.number().int(),
  quotedAtMs: z.number(),
});

export const leverageQuoteWire = z.object({
  side,
  leverageBps: z.number().int(),
  quantityRaw: baseUnits,
  costBase: baseUnits,
  limitYesRaw: baseUnits,
  priceRaw: baseUnits,
  stakeBase: baseUnits,
  frontedBase: baseUnits,
  premiumBase: baseUnits,
  winIfRightBase: baseUnits,
  lineBase: baseUnits,
  decimals: z.number().int(),
  quotedAtMs: z.number(),
});

// ---- requests (browser → web; the web adds `party` and `leaseId` for ops) ---------------------------

export const rangeTicketRequestWire = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("basis"), marketId }),
  z.strictObject({ op: z.literal("preview"), marketId, side: rangeSide, lowE8: uint, highE8: uint, mode }),
  z.strictObject({ op: z.literal("issue"), marketId, side: rangeSide, lowE8: uint, highE8: uint, maxPayoutBase: uint, maxStakeBase: uint, moonshot: z.boolean().default(false) }),
]);
export type RangeTicketRequest = z.output<typeof rangeTicketRequestWire>;

const parlayLeg = z.strictObject({ marketId, side });
export const parlayTicketRequestWire = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("preview"), legs: z.array(parlayLeg).min(1).max(4), mode }),
  z.strictObject({ op: z.literal("issue"), legs: z.array(parlayLeg).min(2).max(4), maxPayoutBase: uint, maxStakeBase: uint }),
]);
export type ParlayTicketRequest = z.output<typeof parlayTicketRequestWire>;

export const boostTicketRequestWire = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("preview"), marketId, side, stakeBase: uint, leverageBps: z.number().int().min(10_000).max(100_000) }),
  z.strictObject({ op: z.literal("issue"), marketId, side, stakeBase: uint, leverageBps: z.number().int().min(10_000).max(100_000), minQuantityRaw: uint }),
  z.strictObject({ op: z.literal("exit"), positionCid: cid, minProceedsBase: uint }),
]);
export type BoostTicketRequest = z.output<typeof boostTicketRequestWire>;

export const earnRequestWire = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("supply"), reserve: ticketReserveWire, amountBase: uint }),
  z.strictObject({ op: z.literal("withdraw"), reserve: ticketReserveWire, shares: uint }),
]);
export type EarnRequest = z.output<typeof earnRequestWire>;

// ---- replies ------------------------------------------------------------------------------------------

const refused = z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema });

export const rangeTicketReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("basis"), openingPrint: baseUnits, centerQE6: baseUnits, sigmaE8: baseUnits, tauSec: z.number(), expirySec: z.number() }),
  z.object({ kind: z.literal("preview"), quote: rangeQuoteWire, basis: rangeBasisWire, openingPrint: baseUnits }),
  z.object({ kind: z.literal("quote"), quoteCid: cid, stakeBase: baseUnits, maxPayoutBase: baseUnits, validUntilMs: z.number() }),
  /** The fresh stake for this payout is above the confirmed cap: nothing was issued. */
  z.object({ kind: z.literal("requote"), stakeBase: baseUnits, maxPayoutBase: baseUnits }),
  refused,
]);
export type RangeTicketReply = z.output<typeof rangeTicketReplyWire>;

export const parlayTicketReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preview"), quote: parlayQuoteWire }),
  z.object({ kind: z.literal("quote"), quoteCid: cid, stakeBase: baseUnits, maxPayoutBase: baseUnits, validUntilMs: z.number() }),
  z.object({ kind: z.literal("requote"), stakeBase: baseUnits, maxPayoutBase: baseUnits }),
  refused,
]);
export type ParlayTicketReply = z.output<typeof parlayTicketReplyWire>;

export const boostTicketReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preview"), quote: leverageQuoteWire }),
  z.object({ kind: z.literal("quote"), quoteCid: cid, quote: leverageQuoteWire, validUntilMs: z.number() }),
  z.object({ kind: z.literal("exit-quote"), quoteCid: cid, proceedsBase: baseUnits, validUntilMs: z.number() }),
  /** Fewer contracts than the guard (open), or less than the floor (exit): nothing was issued. */
  z.object({ kind: z.literal("requote"), quote: leverageQuoteWire.nullable(), proceedsBase: baseUnits.nullable() }),
  refused,
]);
export type BoostTicketReply = z.output<typeof boostTicketReplyWire>;

export const earnReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("supply-quote"), quoteCid: cid, cashIn: baseUnits, sharesOut: baseUnits, validUntilMs: z.number() }),
  z.object({ kind: z.literal("withdraw-quote"), quoteCid: cid, sharesIn: baseUnits, cashOut: baseUnits, validUntilMs: z.number() }),
  refused,
]);
export type EarnReply = z.output<typeof earnReplyWire>;

/** One reserve as ops reads it: the live statement, the book's locks, liquid cash, and what the pricer runs on. */
export const ticketReserveStateWire = z.object({
  reserveId: ticketReserveWire,
  navSeq: z.number().int(),
  asOfMs: z.number(),
  assetsBase: baseUnits,
  shares: baseUnits,
  liquidBase: baseUnits,
  lockedBase: baseUnits,
  /** What the `RiskBook` has booked (released at prune after each boundary). */
  bookLockedBase: baseUnits,
  openTickets: z.number().int(),
  paused: z.boolean(),
});
export type TicketReserveState = z.output<typeof ticketReserveStateWire>;

export const ticketStateReplyWire = z.object({ asOfMs: z.number(), reserves: z.array(ticketReserveStateWire) });
export type TicketStateReply = z.output<typeof ticketStateReplyWire>;

// ---- the seat's tickets (GET /api/ledger/tickets/mine) ------------------------------------------------

export const rangeRoundViewWire = z.object({
  cid,
  marketId,
  kind: z.enum(["range", "moonshot"]),
  side: rangeSide,
  lowE8: baseUnits,
  highE8: baseUnits,
  stakeBase: baseUnits,
  maxPayoutBase: baseUnits,
  expirySec: z.number(),
  refundAfterSec: z.number(),
  /** The Window's opening print, when its terms could be read. */
  openingPrint: baseUnits.nullable(),
  /** The Window's Resolution: close print, or null while pending; `void` when voided. */
  resolution: z.object({ closeE8: baseUnits.nullable(), void: z.boolean() }).nullable(),
});
export type RangeRoundView = z.output<typeof rangeRoundViewWire>;

export const parlayTicketViewWire = z.object({
  cid,
  stakeBase: baseUnits,
  maxPayoutBase: baseUnits,
  voidAfterSec: z.number(),
  legs: z.array(z.object({ marketId, side, expirySec: z.number(), won: z.boolean(), resolved: z.enum(["pending", "won", "lost", "void"]) })),
});
export type ParlayTicketView = z.output<typeof parlayTicketViewWire>;

export const boostPositionViewWire = z.object({
  cid,
  marketId,
  side,
  leverageBps: z.number().int(),
  priceTicks: z.number().int(),
  lots: baseUnits,
  cashUnit: baseUnits,
  stakeBase: baseUnits,
  frontedBase: baseUnits,
  premiumBase: baseUnits,
  barrierE8: baseUnits,
  knockOutProceedsBase: baseUnits,
  expirySec: z.number(),
  refundAfterSec: z.number(),
  resolved: z.enum(["pending", "up", "down", "void"]),
  /** At the venue ladder's fair price when it is quoting; null otherwise. */
  markBase: baseUnits.nullable(),
});
export type BoostPositionView = z.output<typeof boostPositionViewWire>;

export const lpShareViewWire = z.object({ reserveId: ticketReserveWire, shares: baseUnits, worthBase: baseUnits });

/**
 * A ticket that has ended, from its `SettlementReceipt` (abu-pm-main 0.4.0; abu-pm-tickets 0.1.2 writes one on every
 * way a ticket ends, K-088). The receipt is the seat's own contract, so a settled ticket stays in history. What the
 * receipt does not carry is read beside it: the Window's prints and expiry (0 when its terms could not be read), and
 * a parlay's per-leg outcomes from each Window's Resolution.
 */
export const ticketReceiptViewWire = z.object({
  cid,
  product: z.enum(["range", "moonshot", "parlay", "boost", "short"]),
  result: z.enum(["won", "lost", "void", "sold", "knocked-out"]),
  /** When the receipt was written: the ticket's settle, claim, sale, knock-out or refund. */
  settledAtSec: z.number(),
  marketId,
  side,
  resolved: side.nullable(),
  lots: baseUnits,
  cashUnit: baseUnits,
  backingShare: baseUnits,
  cost: baseUnits,
  payout: baseUnits,
  fee: baseUnits,
  stakeBase: baseUnits,
  toReserveBase: baseUnits,
  pick: z.string(),
  expirySec: z.number(),
  openingPrint: baseUnits.nullable(),
  closingPrint: baseUnits.nullable(),
  legs: z.array(z.object({ marketId, side, expirySec: z.number(), resolved: z.enum(["pending", "won", "lost", "void"]) })),
});
export type TicketReceiptView = z.output<typeof ticketReceiptViewWire>;

export const ticketsMineWire = z.object({
  rounds: z.array(rangeRoundViewWire),
  parlays: z.array(parlayTicketViewWire),
  positions: z.array(boostPositionViewWire),
  shares: z.array(lpShareViewWire),
  /** Older servers send none. */
  receipts: z.array(ticketReceiptViewWire).default([]),
});
export type TicketsMine = z.output<typeof ticketsMineWire>;

// ---- the seat's writes ----------------------------------------------------------------------------------

export const ticketProductWire = z.enum(["range", "parlay", "boost", "earn"]);
export type TicketProduct = z.output<typeof ticketProductWire>;

export const ticketAcceptRequestWire = z.strictObject({ commandId: z.uuid(), quoteCid: cid });
export const ticketExitRequestWire = z.strictObject({ commandId: z.uuid(), ticketCid: cid });

export const ticketWriteReplyWire = z.discriminatedUnion("kind", [
  /** `ticketCid`: the round, ticket, position or share the write created, when it created one; `paidBase`: cash it paid the seat. */
  z.object({ kind: z.literal("confirmed"), updateId: txHash, ticketCid: cid.nullable(), paidBase: baseUnits, recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type TicketWriteReply = z.output<typeof ticketWriteReplyWire>;
