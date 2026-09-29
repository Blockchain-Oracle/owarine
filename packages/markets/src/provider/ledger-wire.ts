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
