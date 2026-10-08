/**
 * The JSON shapes of the R2 seat routes (abu-pm-seat): `/api/ledger/exits` (the seat's resting exit: trailing stop,
 * stop, take-profit, and Close through an armed exit) and `/api/ledger/transfers` (credits sent between seats). Shared
 * by the route handlers and the client half. Money is a decimal string parsed back to bigint; prices are the held
 * side's own ticks of 1000; spot levels are price × 10^8 as decimal strings.
 */
import { diagnosisSchema, isMarketId, isSignature, type MarketId, type Signature } from "@owarine/core/types";
import { z } from "zod";

const baseUnits = z.string().regex(/^-?\d+$/, "an integer string").transform((s) => BigInt(s));
const positiveUnits = z.string().regex(/^[1-9]\d{0,18}$/, "a positive integer string").transform((s) => BigInt(s));
const marketId = z.custom<MarketId>(isMarketId, "expected a base58 market id");
const side = z.enum(["up", "down"]);
const txHash = z.custom<Signature>(isSignature, "expected a Canton update id");
const ticks = z.number().int().min(1).max(999);

/** A Canton party id: `<hint>::<fingerprint>`. */
export const partyIdPattern = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;

/** The widest trail the ledger takes (`maxTrailBps`, 50 %). */
export const MAX_TRAIL_BPS = 5000;

const stopWire = z.object({ stopE8: positiveUnits, trailBps: z.number().int().min(1).max(MAX_TRAIL_BPS).nullable() });

export const exitWire = z.object({
  cid: z.string().min(1),
  exitRef: z.string(),
  marketId,
  termsCid: z.string(),
  side,
  lots: baseUnits,
  cashUnit: baseUnits,
  floorTicks: ticks,
  takeProfitTicks: ticks.nullable(),
  stop: stopWire.nullable(),
  expiresAtMs: z.number(),
});
export type ExitWire = z.output<typeof exitWire>;

export const transferWire = z.object({
  cid: z.string().min(1),
  direction: z.enum(["in", "out"]),
  counterparty: z.string(),
  amount: baseUnits,
  memo: z.string(),
  createdAtMs: z.number(),
});
export type TransferWire = z.output<typeof transferWire>;

/** `GET /api/ledger/exits` and `GET /api/ledger/transfers` both answer the seat's whole abu-pm-seat view. */
export const seatPkgReplyWire = z.object({ deployed: z.boolean(), exits: z.array(exitWire), transfers: z.array(transferWire), party: z.string() });
export type SeatPkgReply = z.output<typeof seatPkgReplyWire>;

/** Arm (or re-arm, replacing the earlier one) the seat's exit on one Window side, over every lot it holds there. */
export const armExitRequestWire = z
  .strictObject({ commandId: z.uuid(), marketId, side, floorTicks: ticks, takeProfitTicks: ticks.nullable().default(null), stop: stopWire.nullable().default(null) })
  .refine((r) => r.takeProfitTicks !== null || r.stop !== null, "an exit needs a take-profit or a stop")
  .refine((r) => r.takeProfitTicks === null || r.takeProfitTicks >= r.floorTicks, "a take-profit sits at or above the floor");
export type ArmExitRequest = z.output<typeof armExitRequestWire>;

export const armExitReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), exit: exitWire, replaced: z.number().int(), updateId: txHash, recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type ArmExitReply = z.output<typeof armExitReplyWire>;

export const exitCancelRequestWire = z.strictObject({ commandId: z.uuid(), marketId, side });

export const exitCancelReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), cancelled: z.number().int(), updateId: txHash, recovered: z.boolean() }),
  z.object({ kind: z.literal("gone") }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type ExitCancelReply = z.output<typeof exitCancelReplyWire>;

/** Close through the armed exit: the venue fills it now at its bid, never below `minProceedsBase`. */
export const exitCloseRequestWire = z.strictObject({ minProceedsBase: baseUnits });

export const exitCloseClientReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("closed"), lots: baseUnits, priceTicks: z.number().int(), proceedsBase: baseUnits, updateId: z.string() }),
  /** The bid moved below what the seat confirmed: nothing was sold. */
  z.object({ kind: z.literal("requote"), why: z.string() }),
  /** The exit is gone (filled, cancelled, swept): the caller closes the ordinary way. */
  z.object({ kind: z.literal("gone"), why: z.string() }),
  z.object({ kind: z.literal("refused"), why: z.string() }),
]);
export type ExitCloseClientReply = z.output<typeof exitCloseClientReplyWire>;

/** Send `amount` of the seat's spendable credits to another seat (`to`: its party id). */
export const sendRequestWire = z.strictObject({ commandId: z.uuid(), to: z.string().regex(partyIdPattern, "a seat id"), amount: positiveUnits, memo: z.string().max(140).default("") });

export const sendReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), transfer: transferWire, updateId: txHash, recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type SendReply = z.output<typeof sendReplyWire>;

export const transferEndRequestWire = z.strictObject({ commandId: z.uuid(), choice: z.enum(["accept", "reject", "withdraw"]) });

export const transferEndReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), creditedBase: baseUnits, updateId: txHash, recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type TransferEndReply = z.output<typeof transferEndReplyWire>;

