/**
 * The JSON shapes of the Canton Coin routes (C7b): `GET /api/ledger/cc` (the seat's path) and `POST /api/ledger/cc/withdraw`.
 * Shared by the route handlers and this package's client half, so both sides encode and decode the same bytes. Amounts
 * are integer strings on the wire and stay strings here: the screens format them with `formatBaseUnits`, they never
 * compute with them as a float.
 */
import { diagnosisSchema } from "@owarine/core/types";
import { z } from "zod";

const digits = z.string().regex(/^\d{1,20}$/, "a non-negative integer string");
const commandId = z.uuid();

export const ccListingWire = z.object({
  listingId: z.string(),
  instrumentAdmin: z.string(),
  instrumentId: z.string(),
  unitsPerCoin: digits,
  minDepositUnits: digits,
  maxDepositUnits: digits,
  depositsOpen: z.boolean(),
});

export const ccRailWire = z.object({
  capability: z.enum(["not-live", "live"]),
  reason: z.string().nullable(),
  listing: ccListingWire.nullable(),
  allowanceUnits: digits,
  cashUnits: digits,
  holdings: z.array(z.object({ instrumentAdmin: z.string(), instrumentId: z.string(), unlockedAtomic: digits, lockedAtomic: digits })),
  deposits: z.array(z.object({ units: digits, receivedAtomic: digits, settledAtSec: z.number().int(), ref: z.string() })),
  withdrawals: z.array(z.object({ units: digits, sentAtomic: digits, state: z.enum(["sent", "completed", "refunded"]), openedAtSec: z.number().int(), ref: z.string() })),
  proposals: z.array(z.object({ units: digits, ref: z.string() })),
  reserve: z.object({ covered: z.boolean(), asOfSec: z.number().int(), heldUnits: digits, liabilityUnits: digits }).nullable(),
  faucetCoin: z.string().regex(/^\d{1,8}(\.\d{1,10})?$/).nullable(),
});
export type CcRailReply = z.output<typeof ccRailWire>;

/** `POST /api/ledger/cc/withdraw`: the seat's own ask, cash units back in coin. The party is the lease's, never the body's. */
export const ccWithdrawRequestWire = z.strictObject({ commandId, units: digits });

/** `POST /api/ledger/cc/deposit`: `amount` is a `Decimal` string (`"12.5"`), exact or refused; the seat is the lease's. */
export const ccDepositRequestWire = z.strictObject({ commandId, amount: z.string().regex(/^\d{1,8}(\.\d{1,10})?$/, "a decimal amount with at most 10 places") });

/** `POST /api/ledger/cc/tap` (DevNet): the seat taps the faucet's fixed amount for itself; nothing but a journal id is sent. */
export const ccTapRequestWire = z.strictObject({ commandId });
/** `POST /api/ledger/cc/receive`: the seat accepts the venue's pending transfers for its withdrawals; only a journal id is sent. */
export const ccReceiveRequestWire = ccTapRequestWire;

export const ccWriteReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("requested"), updateId: z.string(), recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type CcWriteReply = z.output<typeof ccWriteReplyWire>;
