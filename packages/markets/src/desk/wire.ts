/**
 * The desk's shapes on the app's ledger routes (`/api/ledger/desk/*`): bigints travel as decimal strings, everything is
 * validated on arrival (it crosses a browser). Shared by the routes and the browser/phone reader so the two cannot drift.
 */
import { diagnosisSchema, type Address, type Hash32, type Signature } from "@owarine/core/types";
import { DESK_MODES } from "@owarine/core/desk";
import { z } from "zod";
import type { DeskState, OwnerDeskBalances, SealedAction } from "./types";

const big = z.union([z.string().regex(/^-?\d+$/), z.number().int()]).transform((v) => BigInt(v));
const addr = z.string().min(1).transform((v) => v as Address);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform((v) => v as Hash32);

const tokenAccount = z.object({ address: addr, exists: z.boolean(), raw: big, frozen: z.boolean() });

export const deskStateWire = z.object({
  address: addr,
  owner: addr,
  operator: addr.nullable(),
  seq: big,
  head: hash,
  perActionCapE6: big,
  dailyCapE6: big,
  spentInWindowE6: big,
  windowStartSec: z.number().int(),
  remainingDailyCapE6: big,
  maxPremiumBps: z.number().int(),
  mode: z.enum(DESK_MODES),
  paused: z.boolean(),
  requirePythIndex: z.boolean(),
  usdc: tokenAccount,
  tokens: z.array(tokenAccount.extend({ mint: addr, symbol: z.string().nullable(), enabled: z.boolean() })),
  refs: z.record(z.string(), z.object({ mint: addr, tokenPriceE8: big, markPriceE8: big, multiplierE12: big, fetchedAtSec: z.number().int(), postedBy: addr, pythFeedId: hash.nullable() })),
  mints: z.record(z.string(), z.object({ mint: addr, decimals: z.number().int(), multiplierE12: big.nullable(), paused: z.boolean().nullable() })),
  slot: big,
});

/** `GET /api/ledger/desk`: the seat's own desk, or none. */
export const deskStateReplyWire = z.object({ state: deskStateWire.nullable() });

export const ownerBalancesWire = z.object({
  lamports: big,
  usdc: z.object({ ownerToken: addr, raw: big }),
  names: z.array(z.object({ symbol: z.string(), mint: addr, ownerToken: addr, raw: big, multiplierE12: big.nullable(), paused: z.boolean().nullable() })),
  slot: big,
});

export const sealsReplyWire = z.object({ seals: z.array(z.object({ kind: z.enum(["Bought", "Sold", "Checkpoint"]), seq: big, head: hash, decisionHash: hash })) });

/** Every desk write's answer: the update id it landed in, or a refusal / an unknown outcome. */
export const deskWriteReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), updateId: z.string().min(1), offset: z.number().int(), recovered: z.boolean().default(false) }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type DeskWriteReply = z.output<typeof deskWriteReplyWire>;

/** The owner's writes, as the routes take them (`POST /api/ledger/desk/<action>`, each with a journal UUID). */
export const DESK_OWNER_ACTIONS = ["open", "allow", "disallow", "deposit", "withdraw", "limits", "mode", "operator", "revoke", "pause", "unpause", "close"] as const;
export type DeskOwnerAction = (typeof DESK_OWNER_ACTIONS)[number];

const commandId = z.uuid();
export const deskWriteRequestWire = {
  open: z.object({ commandId, operator: z.string().min(1), perActionCapE6: big, dailyCapE6: big, maxPremiumBps: z.number().int().min(0).max(10_000), mode: z.enum(DESK_MODES) }),
  allow: z.object({ commandId, symbols: z.array(z.string()).min(1).max(8) }),
  disallow: z.object({ commandId, symbol: z.string() }),
  deposit: z.object({ commandId, amountE6: big }),
  withdraw: z.object({ commandId, amountE6: big.nullable() }),
  limits: z.object({ commandId, perActionCapE6: big, dailyCapE6: big, maxPremiumBps: z.number().int().min(0).max(10_000) }),
  mode: z.object({ commandId, mode: z.enum(DESK_MODES) }),
  operator: z.object({ commandId, operator: z.string().min(1) }),
  revoke: z.object({ commandId }),
  pause: z.object({ commandId }),
  unpause: z.object({ commandId }),
  close: z.object({ commandId }),
} as const satisfies Record<DeskOwnerAction, z.ZodType>;

const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x: unknown) => (typeof x === "bigint" ? x.toString() : x)));

export const deskStateToWire = (s: DeskState | null): unknown => ({ state: s ? json(s) : null });
export const ownerBalancesToWire = (b: OwnerDeskBalances): unknown => json(b);
export const sealsToWire = (seals: readonly SealedAction[]): unknown => json({ seals });

export const deskStateFromWire = (v: z.output<typeof deskStateWire>): DeskState => v as unknown as DeskState;
export const ownerBalancesFromWire = (v: z.output<typeof ownerBalancesWire>): OwnerDeskBalances => v as unknown as OwnerDeskBalances;
export const sealsFromWire = (v: z.output<typeof sealsReplyWire>): SealedAction[] => v.seals as SealedAction[];

export type { Signature };
