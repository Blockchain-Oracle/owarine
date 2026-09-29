/**
 * The JSON shapes of the duel arena and the season pool (C9b): ops' `POST /internal/games/*`, the web's
 * `/api/ledger/games/*`, and this package's client half, so all three encode and decode the same bytes. Money travels
 * as decimal strings and is parsed back to bigint strictly; a party never travels from a browser (the web adds it from
 * the lease on its way to ops, and a view names players by their seat addresses only).
 */
import { ARENA_STATUSES, type ArenaMatch, type ArenaPick, type ArenaStatus } from "@agari/core/games";
import { diagnosisSchema, isAddress, isHash32, isMarketId, isSignature, type Address, type Hash32, type MarketId, type Signature } from "@agari/core/types";
import { z } from "zod";

const baseUnits = z.string().regex(/^-?\d+$/, "an integer string").transform((s) => BigInt(s));
const address = z.custom<Address>(isAddress, "expected a base58 address");
const hash32 = z.custom<Hash32>(isHash32, "expected a 32-byte hex value");
const marketId = z.custom<MarketId>(isMarketId, "expected a base58 market id");
const txHash = z.custom<Signature>(isSignature, "expected a Canton update id");
const cid = z.string().regex(/^[0-9a-f]{40,400}$/, "a contract id");
const status = z.enum(ARENA_STATUSES as unknown as [ArenaStatus, ...ArenaStatus[]]);

// ---- the arena ------------------------------------------------------------------------------------------------

export const arenaParamsWire = z.object({
  joinWindowSec: z.number().int(),
  revealWindowSec: z.number().int(),
  pickWindowSec: z.number().int(),
  minDeckSize: z.number().int(),
  maxDeckSize: z.number().int(),
  minCardLifeSec: z.number().int(),
});

export const arenaTierWire = z.object({ tier: z.number().int(), tierId: z.string(), potBase: baseUnits, perCardCapBase: baseUnits, enabled: z.boolean(), ranked: z.boolean() });

/** The arena as the public reads see it; `deployed: false` when there is no `ArenaTerms` on this participant. */
export const arenaStateWire = z.object({
  deployed: z.boolean(),
  chainId: z.number().int(),
  arenaId: z.string(),
  address,
  policyVersion: z.number().int(),
  params: arenaParamsWire,
  tiers: z.array(arenaTierWire),
  paused: z.boolean(),
  /** Every side pot the arena holds now (open and live matches). */
  escrowedBase: baseUnits,
  asOfMs: z.number(),
});
export type ArenaStateReply = z.output<typeof arenaStateWire>;

export const arenaMatchWire = z.object({
  matchId: hash32,
  creator: address,
  challenger: address,
  tier: z.number().int(),
  status,
  deckSize: z.number().int(),
  pickedMask0: z.number().int(),
  pickedMask1: z.number().int(),
  settledMask: z.number().int(),
  policyVersion: z.number().int(),
  deckHash: hash32,
  createdAtSec: z.number().int(),
  joinedAtSec: z.number().int(),
  revealedAtSec: z.number().int(),
  pickDeadlineSec: z.number().int(),
  potBase: baseUnits,
  perCardCapBase: baseUnits,
}) satisfies z.ZodType<ArenaMatch, unknown>;

export const arenaPickWire = z.object({
  cardIndex: z.number().int(),
  seat: z.union([z.literal(0), z.literal(1)]),
  placed: z.boolean(),
  settled: z.boolean(),
  pick: z.enum(["up", "down"]),
  quantity: baseUnits,
  costBase: baseUnits,
  payoutBase: baseUnits,
}) satisfies z.ZodType<ArenaPick, unknown>;

/** One match (null when neither a live contract nor a result holds it), plus the ledger's revealed seed once public. */
export const arenaMatchViewWire = z.object({
  view: z
    .object({
      match: arenaMatchWire,
      cards: z.array(marketId),
      picks: z.array(arenaPickWire),
      creatorPnlBase: baseUnits,
      challengerPnlBase: baseUnits,
      serverSeed: z.string().nullable(),
      clientSeeds: z.array(z.string()),
      arenaId: z.string(),
    })
    .nullable(),
});
export type ArenaMatchViewReply = z.output<typeof arenaMatchViewWire>;

// ---- the season pool ------------------------------------------------------------------------------------------------

export const seasonPoolWire = z.object({
  pool: z
    .object({ address, seasonId: z.string(), endsAtSec: z.number().int(), admin: address, balanceBase: baseUnits, depositedBase: baseUnits, distributed: z.boolean() })
    .nullable(),
});
export type SeasonPoolReply = z.output<typeof seasonPoolWire>;

// ---- writes ---------------------------------------------------------------------------------------------------------

export const DUEL_ACTIONS = ["open", "join", "pick", "cancel", "lock", "settle", "finalize", "refund-unjoined", "refund-unrevealed", "refund-stale"] as const;
export type DuelAction = (typeof DUEL_ACTIONS)[number];

/** A seat's duel write. `cardIndex` for `pick` and `settle`; `side` for `pick`. The match id is the room's `0x…` hash. */
export const duelWriteRequestWire = z.strictObject({
  commandId: z.uuid(),
  matchId: hash32,
  cardIndex: z.number().int().min(0).max(7).optional(),
  side: z.enum(["up", "down"]).optional(),
});
export type DuelWriteRequest = z.output<typeof duelWriteRequestWire>;

export const duelWriteReplyWire = z.discriminatedUnion("kind", [
  /** A pick carries what the ledger recorded for it: the leg's quantity and its cost (stake + fee). */
  z.object({ kind: z.literal("confirmed"), updateId: txHash, recovered: z.boolean(), quantity: baseUnits.nullable(), costBase: baseUnits.nullable() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
  z.object({ kind: z.literal("unknown"), diagnosis: diagnosisSchema }),
]);
export type DuelWriteReply = z.output<typeof duelWriteReplyWire>;

// ---- ops only: what a creator's open needs from the deckmaster ------------------------------------------------------

export const duelOpenArgsWire = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("open"),
    arenaCid: cid,
    disclosure: z.object({ contractId: cid, templateId: z.string(), createdEventBlob: z.string(), synchronizerId: z.string() }),
    arenaId: z.string(),
    challenger: z.string().min(1),
    tierId: z.string(),
    potEach: baseUnits,
    deckHash: z.string().regex(/^[0-9a-f]{64}$/),
    deckSize: z.number().int(),
    clientSeeds: z.array(z.string()),
    joinWindowSec: z.number().int(),
  }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
]);
export type DuelOpenArgs = z.output<typeof duelOpenArgsWire>;

/** The season admin's payout, as ops runs it: winners are seat addresses, mapped to their venue accounts there. */
export const seasonDistributeReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), updateId: txHash, paid: z.number().int() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
]);
export type SeasonDistributeReply = z.output<typeof seasonDistributeReplyWire>;

/** The season admin's close (K-105): what the pool held after the payout, returned to the venue, and the pool archived. */
export const seasonWithdrawReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirmed"), updateId: txHash, withdrawnBase: baseUnits }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
]);
export type SeasonWithdrawReply = z.output<typeof seasonWithdrawReplyWire>;
