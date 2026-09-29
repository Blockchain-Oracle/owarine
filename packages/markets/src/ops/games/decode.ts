/**
 * abu-pm-games payloads → typed shapes, for ops (the arena desk, the settler, the duel projection) and the web's server
 * half. Server-only. Same rules as `../canton/decode.ts`: every Daml `Int` a `bigint` through `fromDamlInt`, small
 * counters range-checked into a `number`, every `Time` epoch seconds. Variants with a record constructor arrive as
 * `{tag, value}`; an all-nullary variant (`RefundReason`) as its constructor's name.
 */
import { fromDamlInt, type ContractId, type Party } from "@agari/ledger/pure";
import { DecodeError, decodeLeg, timeSec, type LegC } from "../canton/decode";

type Raw = Record<string, unknown>;

const obj = (v: unknown, what: string): Raw => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new DecodeError(`${what} is not a record`);
  return v as Raw;
};
const text = (r: Raw, k: string): string => {
  const v = r[k];
  if (typeof v !== "string") throw new DecodeError(`field ${k} is not text`);
  return v;
};
const big = (r: Raw, k: string): bigint => fromDamlInt(r[k], k);
const small = (r: Raw, k: string): number => {
  const b = big(r, k);
  if (b > BigInt(Number.MAX_SAFE_INTEGER) || b < -BigInt(Number.MAX_SAFE_INTEGER)) throw new DecodeError(`field ${k} exceeds a safe integer`);
  return Number(b);
};
const sec = (r: Raw, k: string) => timeSec(r[k], k);
const bool = (r: Raw, k: string): boolean => {
  const v = r[k];
  if (typeof v !== "boolean") throw new DecodeError(`field ${k} is not a bool`);
  return v;
};
const list = (v: unknown, what: string): unknown[] => {
  if (!Array.isArray(v)) throw new DecodeError(`${what} is not a list`);
  return v;
};
const texts = (v: unknown, what: string): string[] => list(v, what).map((x) => {
  if (typeof x !== "string") throw new DecodeError(`${what} holds a non-text`);
  return x;
});
const optional = <T>(v: unknown, read: (x: unknown) => T): T | null => (v === null || v === undefined ? null : read(v));
const variant = (v: unknown, what: string): { tag: string; value: Raw } => {
  const r = obj(v, what);
  if (typeof r.tag !== "string") throw new DecodeError(`${what} has no tag`);
  return { tag: r.tag, value: r.value === undefined || r.value === null ? {} : obj(r.value, `${what}.value`) };
};

// ---- shapes -------------------------------------------------------------------------------------------

export interface TierC {
  tierId: string;
  potEach: bigint;
  perCardCap: bigint;
  ranked: boolean;
  enabled: boolean;
}

export interface ArenaParamsC {
  joinWindowSec: number;
  revealWindowSec: number;
  pickWindowSec: number;
  minDeckSize: number;
  maxDeckSize: number;
}

export interface ArenaTermsC {
  venue: Party;
  arenaId: string;
  policyVersion: number;
  params: ArenaParamsC;
  tiers: TierC[];
}

interface DuelBase {
  venue: Party;
  creator: Party;
  challenger: Party;
  arenaId: string;
  matchId: string;
  policyVersion: number;
  tier: TierC;
  params: ArenaParamsC;
  deckHash: string;
  deckSize: number;
  clientSeeds: string[];
}

export interface DuelOpenC extends DuelBase {
  joinDeadlineSec: number;
}

export type DuelStatusC = { tag: "Unrevealed" } | { tag: "Picking" } | { tag: "Settling" } | { tag: "Forfeited"; absent: Party };

export interface CardC {
  termsCid: ContractId;
  marketId: string;
  lockAtSec: number;
  refundAfterSec: number;
}

export interface PickC {
  /** 0 = creator, 1 = challenger. */
  seat: 0 | 1;
  cardIndex: number;
  legCid: ContractId;
  leg: LegC;
  cost: bigint;
  payout: bigint | null;
}

export interface DuelMatchC extends DuelBase {
  revealDeadlineSec: number;
  status: DuelStatusC;
  serverSeed: string | null;
  cards: CardC[];
  pickDeadlineSec: number | null;
  picks: PickC[];
}

export type RefundReasonC = "BothIncomplete" | "RevealUnavailable" | "StaleSettlement";
export type DuelOutcomeC = { tag: "Won"; winner: Party } | { tag: "Tied" } | { tag: "Refunded"; reason: RefundReasonC };

export interface DuelResultC {
  venue: Party;
  creator: Party;
  challenger: Party;
  arenaId: string;
  matchId: string;
  tierId: string;
  ranked: boolean;
  outcome: DuelOutcomeC;
  creatorPnl: bigint;
  challengerPnl: bigint;
  toCreator: bigint;
  toChallenger: bigint;
  serverSeed: string | null;
  cards: string[];
}

export interface SeasonPoolC {
  venue: Party;
  seasonId: string;
  endsAtSec: number;
  amount: bigint;
  deposited: bigint;
  distributed: boolean;
}

// ---- decoders ---------------------------------------------------------------------------------------------

function tier(v: unknown): TierC {
  const r = obj(v, "Tier");
  return { tierId: text(r, "tierId"), potEach: big(r, "potEach"), perCardCap: big(r, "perCardCap"), ranked: bool(r, "ranked"), enabled: bool(r, "enabled") };
}

function params(v: unknown): ArenaParamsC {
  const r = obj(v, "ArenaParams");
  return {
    joinWindowSec: small(r, "joinWindowSec"), revealWindowSec: small(r, "revealWindowSec"), pickWindowSec: small(r, "pickWindowSec"),
    minDeckSize: small(r, "minDeckSize"), maxDeckSize: small(r, "maxDeckSize"),
  };
}

function base(r: Raw): DuelBase {
  return {
    venue: text(r, "venue"), creator: text(r, "creator"), challenger: text(r, "challenger"), arenaId: text(r, "arenaId"), matchId: text(r, "matchId"),
    policyVersion: small(r, "policyVersion"), tier: tier(r.tier), params: params(r.params), deckHash: text(r, "deckHash"), deckSize: small(r, "deckSize"),
    clientSeeds: texts(r.clientSeeds, "clientSeeds"),
  };
}

function status(v: unknown): DuelStatusC {
  const s = variant(v, "DuelStatus");
  if (s.tag === "Unrevealed" || s.tag === "Picking" || s.tag === "Settling") return { tag: s.tag };
  if (s.tag === "Forfeited") return { tag: "Forfeited", absent: text(s.value, "absent") };
  throw new DecodeError(`DuelStatus ${s.tag} is unknown`);
}

function card(v: unknown): CardC {
  const r = obj(v, "Card");
  return { termsCid: text(r, "termsCid"), marketId: text(r, "marketId"), lockAtSec: sec(r, "lockAt"), refundAfterSec: sec(r, "refundAfter") };
}

function pick(v: unknown): PickC {
  const r = obj(v, "Pick");
  const seat = small(r, "seat");
  if (seat !== 0 && seat !== 1) throw new DecodeError(`seat ${seat} is not 0 or 1`);
  return {
    seat, cardIndex: small(r, "cardIndex"), legCid: text(r, "legCid"), leg: decodeLeg(r.leg), cost: big(r, "cost"),
    payout: optional(r.payout, (x) => fromDamlInt(x, "payout")),
  };
}

function refundReason(v: unknown): RefundReasonC {
  if (v === "BothIncomplete" || v === "RevealUnavailable" || v === "StaleSettlement") return v;
  throw new DecodeError(`RefundReason ${JSON.stringify(v)} is unknown`);
}

function outcome(v: unknown): DuelOutcomeC {
  const o = variant(v, "DuelOutcome");
  if (o.tag === "Won") return { tag: "Won", winner: text(o.value, "winner") };
  if (o.tag === "Tied") return { tag: "Tied" };
  if (o.tag === "Refunded") return { tag: "Refunded", reason: refundReason(o.value.reason) };
  throw new DecodeError(`DuelOutcome ${o.tag} is unknown`);
}

export function decodeArenaTerms(v: unknown): ArenaTermsC {
  const r = obj(v, "ArenaTerms");
  return { venue: text(r, "venue"), arenaId: text(r, "arenaId"), policyVersion: small(r, "policyVersion"), params: params(r.params), tiers: list(r.tiers, "tiers").map(tier) };
}

export function decodeDuelOpen(v: unknown): DuelOpenC {
  const r = obj(v, "DuelOpen");
  return { ...base(r), joinDeadlineSec: sec(r, "joinDeadline") };
}

export function decodeDuelMatch(v: unknown): DuelMatchC {
  const r = obj(v, "DuelMatch");
  return {
    ...base(r), revealDeadlineSec: sec(r, "revealDeadline"), status: status(r.status), serverSeed: optional(r.serverSeed, (x) => (typeof x === "string" ? x : null)),
    cards: list(r.cards, "cards").map(card), pickDeadlineSec: optional(r.pickDeadline, (x) => timeSec(x, "pickDeadline")), picks: list(r.picks, "picks").map(pick),
  };
}

export function decodeDuelResult(v: unknown): DuelResultC {
  const r = obj(v, "DuelResult");
  return {
    venue: text(r, "venue"), creator: text(r, "creator"), challenger: text(r, "challenger"), arenaId: text(r, "arenaId"), matchId: text(r, "matchId"),
    tierId: text(r, "tierId"), ranked: bool(r, "ranked"), outcome: outcome(r.outcome), creatorPnl: big(r, "creatorPnl"), challengerPnl: big(r, "challengerPnl"),
    toCreator: big(r, "toCreator"), toChallenger: big(r, "toChallenger"), serverSeed: optional(r.serverSeed, (x) => (typeof x === "string" ? x : null)),
    cards: texts(r.cards, "cards"),
  };
}

export function decodeSeasonPool(v: unknown): SeasonPoolC {
  const r = obj(v, "SeasonPool");
  return { venue: text(r, "venue"), seasonId: text(r, "seasonId"), endsAtSec: sec(r, "endsAt"), amount: big(r, "amount"), deposited: big(r, "deposited"), distributed: bool(r, "distributed") };
}
