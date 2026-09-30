/**
 * The JSON shapes of our own ledger routes (`/api/seat`, `/api/ledger/*`, `/api/view`) and of ops' internal quote
 * endpoint, shared by the route handlers and this client half so both sides encode and decode the same bytes. Money
 * travels as decimal strings and is parsed back to bigint strictly (never `Number`); ids are validated on the way in.
 */
import {
  diagnosisSchema,
  isMarketId,
  type BalanceSheet,
  type ClaimableRow,
  type ExitQuote,
  type MarketId,
  type OpenPosition,
  type Quote,
  type Side,
  type Signature,
} from "@agari/core/types";
import { isSignature } from "@agari/core/types";
import type { BookedOrder } from "@agari/core/ports";
import { z } from "zod";

const baseUnits = z.string().regex(/^-?\d+$/, "an integer string").transform((s) => BigInt(s));
const marketId = z.custom<MarketId>(isMarketId, "expected a base58 market id");
const side = z.enum(["up", "down"]);
const txHash = z.custom<Signature>(isSignature, "expected a Canton update id");

/** bigint-safe JSON: every bigint becomes its decimal string. */
export function toWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)));
}

export const quoteWire = z.object({
  side,
  stakeBase: baseUnits,
  contractsRaw: baseUnits,
  expectedCostBase: baseUnits,
  maxCostBase: baseUnits,
  limitPriceRaw: baseUnits,
  avgPriceBps: z.number().int(),
  oddsCents: z.number(),
  payoutIfRightBase: baseUnits,
  fillableStakeBase: baseUnits,
  partial: z.boolean(),
  feeBps: z.number(),
  decimals: z.number().int(),
  quotedAtMs: z.number(),
}) satisfies z.ZodType<Quote, unknown>;

// ---- /api/ledger/quotes (and ops /internal/quotes) -------------------------------------------------

export const quoteRequestWire = z.strictObject({
  marketId,
  side,
  stakeBase: baseUnits,
  displayedMaxCostBase: baseUnits,
});
export type QuoteRequest = z.output<typeof quoteRequestWire>;

export const quoteReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("quote"), quoteCid: z.string().min(1), quote: quoteWire, validUntilMs: z.number() }),
  z.object({ kind: z.literal("requote"), quote: quoteWire }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
]);
export type QuoteReply = z.output<typeof quoteReplyWire>;

// ---- /api/ledger/resting (and ops /internal/resting-offers): a pre-open resting call (C7c, K-235) -----------

/** How long a call rests: to the bell plus 90 s (default) or, opted in, to the Window's lock (`@agari/core/orders`). */
export const restUntilWire = z.enum(["bell", "lock"]);

/**
 * Rest a call on a listed Window at the seat's own price. The ticket's sizing is echoed as `displayedEscrowBase`: ops
 * re-sizes on the Window's own grid and answers a requote, never a different escrow taken silently.
 */
export const restingRequestWire = z.strictObject({
  marketId,
  side,
  stakeBase: baseUnits,
  priceCents: z.number().int().min(1).max(99),
  restUntil: restUntilWire.default("bell"),
  displayedEscrowBase: baseUnits,
});
export type RestingRequest = z.output<typeof restingRequestWire>;

/** What a call is, before it has a transaction: `priceTicks` in YES terms (an UP call at 55c is 550, a DOWN call at 55c is 450). */
export const restedOfferWire = z.object({
  marketId,
  side,
  callRef: z.string().min(1).max(80),
  lots: baseUnits,
  priceTicks: z.number().int(),
  contractsRaw: baseUnits,
  escrowBase: baseUnits,
  expireSec: z.number().int(),
});
export type RestedOffer = z.output<typeof restedOfferWire>;

export const restedWire = restedOfferWire.extend({ txHash });

export const restingOfferReplyWire = z.discriminatedUnion("kind", [
  /** The venue's offer to hold the call, good until `validUntilMs` (never later than the bell); the seat places it. */
  z.object({ kind: z.literal("offer"), offerCid: z.string().min(1), rested: restedOfferWire, validUntilMs: z.number() }),
  /** The Window's own grid sizes the call differently from the ticket: the fresh quote is shown, nothing is offered. */
  z.object({ kind: z.literal("requote"), quote: quoteWire }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
]);
export type RestingOfferReply = z.output<typeof restingOfferReplyWire>;

export const restingPlaceReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), rested: restedWire, updateId: txHash, recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type RestingPlaceReply = z.output<typeof restingPlaceReplyWire>;

/** Cancel the named calls of one Window; a call that already ended is not an error, it is reported as `gone`. */
export const restingCancelRequestWire = z.strictObject({ commandId: z.uuid(), marketId, callRefs: z.array(z.string().min(1).max(80)).min(1).max(16) });

export const restingCancelReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), updateId: txHash, refundedBase: baseUnits, cancelled: z.number().int(), recovered: z.boolean() }),
  /** None of the calls is resting any more: each filled, expired or was cancelled already. Nothing was sent. */
  z.object({ kind: z.literal("gone") }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type RestingCancelReply = z.output<typeof restingCancelReplyWire>;

// ---- /api/ledger/exit-quotes (and ops /internal/exit-quotes): a firm buy-back of a held side (C7a) --------

export const exitQuoteWire = z.object({
  contractsRaw: baseUnits,
  limitPriceRaw: baseUnits,
  expectedProceedsBase: baseUnits,
  minProceedsBase: baseUnits,
  avgPriceBps: z.number().int(),
}) satisfies z.ZodType<ExitQuote, unknown>;

/** Sell `contractsRaw` of `side` on a Window; the floor is what the seat confirmed (a fresh price below it is a requote). */
export const exitQuoteRequestWire = z.strictObject({
  marketId,
  side,
  contractsRaw: baseUnits,
  displayedMinProceedsBase: baseUnits,
});
export type ExitQuoteRequest = z.output<typeof exitQuoteRequestWire>;

export const exitQuoteReplyWire = z.discriminatedUnion("kind", [
  /** One `BuyQuote` per leg the sale takes (largest first, the last one partial); the accept takes them all at once. */
  z.object({ kind: z.literal("quote"), quoteCids: z.array(z.string().min(1)).min(1), exit: exitQuoteWire, validUntilMs: z.number() }),
  z.object({ kind: z.literal("requote"), exit: exitQuoteWire }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
]);
export type ExitQuoteReply = z.output<typeof exitQuoteReplyWire>;

/** The path names the first `BuyQuote`; `with` names the rest of the same exit quote. */
export const exitAcceptRequestWire = z.strictObject({ commandId: z.uuid(), with: z.array(z.string().regex(/^[0-9a-f]{40,400}$/)).max(7).default([]) });

// ---- accept / claim / refund ------------------------------------------------------------------------

export const bookedWire = z.object({
  marketId,
  side,
  contractsRaw: baseUnits,
  costBase: baseUnits,
  avgPriceBps: z.number().int(),
  txHash,
  fillCount: z.number().int(),
}) satisfies z.ZodType<BookedOrder, unknown>;

export const writeRequestWire = z.strictObject({ commandId: z.uuid() });
export const legsRequestWire = z.strictObject({ commandId: z.uuid(), marketId });

export const acceptReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), booked: bookedWire, updateId: txHash, recovered: z.boolean() }),
  /** The quote was gone at accept time; ops quoted again, and the surface shows the new price. */
  z.object({ kind: z.literal("requote"), quote: quoteWire }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type AcceptReply = z.output<typeof acceptReplyWire>;

export const exitAcceptReplyWire = z.discriminatedUnion("kind", [
  /** `booked` is the sale: `costBase` 0, `proceedsBase` the `VenueCash` the accept paid the seat (tap-trading.md §1.4). */
  z.object({ kind: z.literal("confirmed"), booked: bookedWire.extend({ proceedsBase: baseUnits }), updateId: txHash, recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type ExitAcceptReply = z.output<typeof exitAcceptReplyWire>;

export const legsReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), updateId: txHash, payoutBase: baseUnits, legs: z.number().int(), recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type LegsReply = z.output<typeof legsReplyWire>;

export const commandStatusWire = z.object({
  commandId: z.uuid(),
  /** landed: committed · failed: rejected, nothing committed · pending: no answer yet · absent: past its deadline, cannot land. */
  status: z.enum(["landed", "failed", "pending", "absent"]),
  updateId: txHash.nullable(),
  diagnosis: diagnosisSchema.nullable(),
});
export type CommandStatus = z.output<typeof commandStatusWire>;

// ---- /api/ledger/me/* ----------------------------------------------------------------------------------

export const balanceWire = z.object({
  decimals: z.number().int(),
  spendableBase: baseUnits,
  nativeLamports: baseUnits,
  orderEscrowBase: baseUnits,
  venueCreditBase: baseUnits,
  venueCreditByMarket: z.array(z.object({ marketId, amountBase: baseUnits })),
  vaultBase: baseUnits.nullable(),
}) satisfies z.ZodType<BalanceSheet, unknown>;

export const positionWire = z.object({
  marketId,
  asset: z.string(),
  intervalSec: z.number(),
  expirySec: z.number(),
  decimals: z.number().int(),
  balanceUpRaw: baseUnits,
  balanceDownRaw: baseUnits,
  costBasisBase: baseUnits,
  avgCostRaw: baseUnits,
  markValueBase: baseUnits,
  unrealizedPnlBase: baseUnits,
  realizedPnlBase: baseUnits,
}) satisfies z.ZodType<OpenPosition, unknown>;

export const claimableWire = z.object({
  kind: z.enum(["win", "void", "vault-credit", "stale-refund"]),
  marketId,
  marketAddress: z.string().transform((s) => s as ClaimableRow["marketAddress"]),
  asset: z.string(),
  intervalSec: z.number(),
  expirySec: z.number(),
  legs: z.array(z.object({ outcomeIdx: z.union([z.literal(0), z.literal(1)]), amountRaw: baseUnits, payoutBase: baseUnits })),
  netPayoutBase: baseUnits,
  feeBps: z.number(),
  decimals: z.number().int(),
  settledAtMs: z.number().nullable(),
}) satisfies z.ZodType<ClaimableRow, unknown>;

export const openQuoteWire = z.object({
  quoteCid: z.string(),
  marketId,
  side,
  priceTicks: baseUnits,
  lots: baseUnits,
  contractsRaw: baseUnits,
  costBase: baseUnits,
  feeBase: baseUnits,
  validUntilMs: z.number(),
});
export type OpenQuote = z.output<typeof openQuoteWire>;

/** Every `/api/ledger/me/*` answer: the rows, the seat they belong to, and the party and offset they were read as and at. */
export const meReplyWire = z.object({ value: z.unknown(), address: z.string(), party: z.string(), offset: z.number() });

export type WireSide = Side;
