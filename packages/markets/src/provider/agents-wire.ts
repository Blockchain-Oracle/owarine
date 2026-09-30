/**
 * The JSON shapes of the agents' routes (C8f): `/api/ledger/agents/*` (the seat's grants, its consents, its registry
 * writes) and the public strategy registry. Shared by the route handlers and this package's client half, so both sides
 * encode and decode the same bytes. Money travels as decimal strings and is parsed back to bigint strictly; a party is
 * shown as text (it is the grant's agent, a strategy's creator or runner), never sent by a browser as "who I am".
 */
import { diagnosisSchema, isSignature, type Signature } from "@agari/core/types";
import { z } from "zod";

const uint = z.string().regex(/^\d{1,20}$/, "a non-negative integer string").transform((s) => BigInt(s));
const txHash = z.custom<Signature>(isSignature, "expected a Canton update id");
const commandId = z.uuid();
/** A Canton party id, or a seat's base58 address where the server maps one onto the other. */
const who = z.string().min(1).max(300);

export const vaultCapsWire = z.object({
  maxStakePerTradeBase: uint,
  maxDailySpendBase: uint,
  maxOpenPositions: z.number().int().min(0),
  maxPriceRaw: uint,
});

export const grantKindWire = z.enum(["session", "executor", "strategy"]);

export const vaultGrantWire = z.object({
  grantId: uint,
  owner: who,
  actor: who,
  kind: grantKindWire,
  revoked: z.boolean(),
  expiresAtSec: z.number().int(),
  spentDay: z.number().int(),
  spentTodayBase: uint,
  openPositions: z.number().int(),
  caps: vaultCapsWire,
  budgetBase: uint,
});

export const vaultAccountWire = z.object({
  availableBase: uint,
  privateAvailableBase: uint,
  totalDepositedBase: uint,
  totalWithdrawnBase: uint,
});

/** `GET /api/ledger/agents/vault`: the seat's cash and its live grant per kind. */
export const vaultReplyWire = z.object({
  account: vaultAccountWire,
  grants: z.object({ session: vaultGrantWire.nullable(), executor: vaultGrantWire.nullable(), strategy: vaultGrantWire.nullable() }),
  /** Every live grant the seat holds (a kind holds at most one; a second to another agent shows here). */
  all: z.array(vaultGrantWire),
  decimals: z.number().int(),
});
export type VaultReply = z.output<typeof vaultReplyWire>;

/** `GET /api/ledger/agents/vault/grants/<id>`: the live grant, or a gone one (revoked: a grant leaves the ledger only by its revoke). */
export const grantReplyWire = z.object({ grant: vaultGrantWire.nullable() });

export const strategyRecordWire = z.object({
  strategyId: uint,
  /**
   * The registry's own id, `<creator party>/<index>`. Optional (C8g): the public route sends the reference's
   * `StrategyRecord`, which has no text id, and requiring it failed every client read of the registry (the copy
   * drawer could never verify the subscription fee).
   */
  textId: z.string().optional(),
  creator: who,
  runner: who,
  specHash: z.string(),
  metadata: z.string(),
  envelope: vaultCapsWire,
  feeBase: uint,
  active: z.boolean(),
  createdAtSec: z.number().int(),
  subscribers: z.number().int(),
  revision: z.number().int(),
});

/** `GET /api/ledger/agents/strategies`: the registry as the venue lists it (public). */
export const strategiesReplyWire = z.object({ strategies: z.array(strategyRecordWire) });

export const subscriptionWire = z.object({
  strategyId: uint,
  subscriber: who,
  grantId: uint,
  subscribedAtSec: z.number().int(),
  active: z.boolean(),
  live: z.boolean(),
  fade: z.boolean(),
});

/** `GET /api/ledger/agents/subscriptions?ids=`: the seat's own consents. */
export const subscriptionsReplyWire = z.object({ subscriptions: z.array(subscriptionWire) });

/** `GET /api/ledger/agents/payouts`: the creator fees waiting for the seat (C8i), a total and a count per period. */
export const creatorPayoutsReplyWire = z.object({
  totalBase: uint,
  feeCount: z.number().int().nonnegative(),
  payouts: z.array(z.object({ period: z.number().int(), feeCount: z.number().int().positive(), amountBase: uint })),
});
export type CreatorPayoutsReply = z.output<typeof creatorPayoutsReplyWire>;

// ---- writes ------------------------------------------------------------------------------------------

export const agentsWriteReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), updateId: txHash, recovered: z.boolean() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type AgentsWriteReply = z.output<typeof agentsWriteReplyWire>;

export const grantOpenRequestWire = z.strictObject({
  commandId,
  kind: grantKindWire,
  /** The agent the grant names (a party id). */
  actor: who,
  caps: vaultCapsWire,
  expiresAtSec: z.number().int().positive(),
  budgetBase: uint,
});
export const grantFundRequestWire = z.strictObject({ commandId, grantId: uint, amountBase: uint });
export const grantRevokeRequestWire = z.strictObject({ commandId, grantId: uint });

export const strategyPublishRequestWire = z.strictObject({
  commandId,
  runner: who,
  envelope: vaultCapsWire,
  feeBase: uint,
  /** The creator's published text (`encodeStrategyMetadata`); sealed on the ledger by its SHA-256. */
  metadata: z.string().min(1).max(2_048),
});
export const strategyUpdateRequestWire = z.strictObject({ commandId, strategyId: uint, metadata: z.string().min(1).max(2_048), feeBase: uint });
export const strategyRunnerRequestWire = z.strictObject({ commandId, strategyId: uint, runner: who });
export const strategyDeactivateRequestWire = z.strictObject({ commandId, strategyId: uint });
export const strategySubscribeRequestWire = z.strictObject({ commandId, strategyId: uint, grantId: uint, feeBase: uint, fade: z.boolean() });
export const strategyUnsubscribeRequestWire = z.strictObject({ commandId, strategyId: uint, fade: z.boolean() });
export const payoutClaimRequestWire = z.strictObject({ commandId });

/** `GET /api/ledger/agents/receipt/<updateId>`: the seat's own transaction, and the cash it paid the seat. */
export const agentsReceiptReplyWire = z.object({
  receipt: z.object({ status: z.literal("success"), paidBase: uint }).nullable(),
});
