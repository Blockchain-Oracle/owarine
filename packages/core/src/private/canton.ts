/**
 * Private mode on Canton (L-39, C8d). The plan's shape, `VenueCash` with `bucket = private`, on the released engine:
 *
 *   balance   the seat's `VenueCash` in the `private` bucket: never counted as its spendable balance, never spent by a
 *             public call, a ticket, a grant or a desk. Moving in or out is one atomic transaction the venue's ops
 *             signs with the seat: the seat's own cash is withdrawn and the venue credits the same amount into the other
 *             bucket (`VenueCash_Withdraw` + `VenueAccount_Credit`), so nothing moves unless both happen.
 *   bet       a firm venue quote accepted with exactly that much private cash (`VenueCash_Split` keeps the bucket, so
 *             there is no change to leak) and `beneficiaryRef = "private"` on the leg: it is kept out of the public
 *             portfolio, exits and publications, and appears only in the private list.
 *   payout    abu-pm-main 0.5.2 (K-315): the venue's settle (or the owner's claim, or the stale refund) pays a private
 *             call straight back into the private bucket, won, lost or void, and its settlement receipt names the
 *             bucket (`paidInto = "private"`). Nothing waits for a cash-out and nothing touches the public balance.
 *   cash-out  only for a call settled by the 0.5.1 engine, which paid the seat's public balance: its payout is moved
 *             back into the private bucket and its receipt dismissed in the same transaction, once.
 *
 * What this is, said plainly: Canton already shows a seat's contracts only to the seat and the venue; private mode keeps
 * those calls off everything the seat can make public. It is not anonymity: the venue still sees every call.
 */
import { z } from "zod";

export const PRIVATE_BUCKET = "private" as const;
export const PRIVATE_LEG_REF = "private" as const;

const decimal = z.string().regex(/^\d+$/);

export const privatePositionWire = z.object({
  pairId: z.string().min(1).max(64),
  marketId: z.string().min(1),
  asset: z.string(),
  intervalSec: z.number().int(),
  expirySec: z.number().int(),
  side: z.enum(["up", "down"]),
  lots: decimal,
  /** Stake plus fee, what the bet took from the private balance. */
  costBase: decimal,
  /**
   * open: the Window has not settled · settled: paid into the seat's public balance by the 0.5.1 engine, waiting for Cash
   * out · credited: home in the private bucket (0.5.2: at settlement; 0.5.1: after Cash out).
   */
  status: z.enum(["open", "settled", "credited"]),
  result: z.enum(["won", "lost", "void"]).nullable(),
  payoutBase: decimal.nullable(),
  /** The bucket the ledger's receipt says the payout landed in: `private` (0.5.2, at settlement); null before 0.5.2 or while open. */
  paidInto: z.string().nullable().optional(),
  openedUpdateId: z.string(),
  openedAtSec: z.number().int(),
});
export type PrivatePosition = z.infer<typeof privatePositionWire>;

/** `GET /api/private/balance`: the seat's private bucket and its private calls under this lease. */
export const privateBalanceReplyWire = z.object({
  balanceBase: decimal,
  positions: z.array(privatePositionWire),
});
export type PrivateBalanceReply = z.infer<typeof privateBalanceReplyWire>;

/** `POST /api/private/balance`: move demo credits between the seat's balance and its private bucket. */
export const privateMoveRequestWire = z.strictObject({ commandId: z.uuid(), op: z.enum(["in", "out"]), amountBase: decimal });
export type PrivateMoveRequest = z.infer<typeof privateMoveRequestWire>;

/** `POST /api/private/cashout` on Canton: the seat names its own settled private call; the lease says whose. */
export const privateCantonCashoutRequestWire = z.strictObject({ pairId: z.string().min(1).max(64), marketId: z.string().min(1) });

/** ops `POST /internal/private/move`: the web adds WHO from the lease row. */
export interface OpsPrivateMoveRequest {
  party: string;
  leaseId: string;
  requestId: string;
  op: "in" | "out" | "cashout";
  amountBase?: string;
  receiptCid?: string;
}

export const opsPrivateMoveReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("moved"), op: z.enum(["in", "out", "cashout"]), amountBase: decimal, updateId: z.string(), recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: z.object({ kind: z.string(), retryable: z.boolean(), technical: z.string() }).passthrough() }),
]);
export type OpsPrivateMoveReply = z.infer<typeof opsPrivateMoveReplyWire>;

/** The per-bet bounds of the private route, in base units (demo credits × 10⁶): the reference's desk caps, in credits. */
export const PRIVATE_MIN_STAKE_BASE = 1_000_000n;
export const PRIVATE_MAX_STAKE_BASE = 50_000_000n;

/** A v4 UUID for a private write's command id: `crypto.randomUUID` where the runtime has it, else built from `getRandomValues` (the phone). */
export function privateRequestId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
