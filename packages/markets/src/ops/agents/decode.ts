/**
 * abu-pm-agents contract payloads (Daml-LF JSON) → typed shapes, and abu-pm-main's `AgentGrant` beside them. Server-only.
 * Same rules as `../canton/decode.ts`: Daml `Int` → `bigint` (small counters → safe `number`), `Time` → epoch seconds,
 * `Optional` → `null` when absent, variants as `{ tag, value }`, enums as their constructor name.
 */
import { fromDamlInt, type ContractId, type Party } from "@owarine/ledger/pure";
import { DecodeError, timeSec, type Side } from "../canton/decode";

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
const bool = (r: Raw, k: string): boolean => {
  const v = r[k];
  if (typeof v !== "boolean") throw new DecodeError(`field ${k} is not a Bool`);
  return v;
};
const big = (r: Raw, k: string): bigint => fromDamlInt(r[k], k);
const small = (r: Raw, k: string): number => {
  const b = big(r, k);
  if (b > BigInt(Number.MAX_SAFE_INTEGER) || b < -BigInt(Number.MAX_SAFE_INTEGER)) throw new DecodeError(`field ${k} exceeds a safe integer`);
  return Number(b);
};
const sec = (r: Raw, k: string) => timeSec(r[k], k);
const optSec = (r: Raw, k: string): number | null => (r[k] === null || r[k] === undefined ? null : timeSec(r[k], k));
const list = (r: Raw, k: string): unknown[] => {
  const v = r[k];
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v)) throw new DecodeError(`field ${k} is not a list`);
  return v;
};
const texts = (r: Raw, k: string): string[] => list(r, k).map((x) => {
  if (typeof x !== "string") throw new DecodeError(`field ${k} holds a non-text`);
  return x;
});
const side = (v: unknown): Side => {
  if (v === "SideUp" || v === "SideDown") return v;
  throw new DecodeError(`side ${JSON.stringify(v)} is not SideUp/SideDown`);
};

// ---- grants (abu-pm-main PM.Grant, abu-pm-agents PM.Agents.Vault) -----------------------------------

export interface GrantCapsC {
  maxStakePerTrade: bigint;
  maxDailySpend: bigint;
  /** Side terms; 0 = no price cap. */
  maxPriceTicks: number;
  maxOpenPositions: number;
}

export interface GrantPositionC {
  marketId: string;
  outcome: Side;
  refundAfterSec: number;
}

export interface AgentGrantC {
  venue: Party;
  owner: Party;
  agent: Party;
  caps: GrantCapsC;
  budget: bigint;
  expiresAtSec: number;
  dayZeroSec: number;
  day: number;
  spentToday: bigint;
  positions: GrantPositionC[];
}

export const decodeGrantCaps = (v: unknown): GrantCapsC => {
  const r = obj(v, "GrantCaps");
  return { maxStakePerTrade: big(r, "maxStakePerTrade"), maxDailySpend: big(r, "maxDailySpend"), maxPriceTicks: small(r, "maxPriceTicks"), maxOpenPositions: small(r, "maxOpenPositions") };
};

export function decodeAgentGrant(v: unknown): AgentGrantC {
  const r = obj(v, "AgentGrant");
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), agent: text(r, "agent"), caps: decodeGrantCaps(r.caps), budget: big(r, "budget"),
    expiresAtSec: sec(r, "expiresAt"), dayZeroSec: sec(r, "dayZero"), day: small(r, "day"), spentToday: big(r, "spentToday"),
    positions: list(r, "positions").map((p) => {
      const x = obj(p, "GrantPosition");
      return { marketId: text(x, "marketId"), outcome: side(x.outcome), refundAfterSec: sec(x, "refundAfter") };
    }),
  };
}

export interface GrantDeskC {
  venue: Party;
  owner: Party;
}
export const decodeGrantDesk = (v: unknown): GrantDeskC => {
  const r = obj(v, "GrantDesk");
  return { venue: text(r, "venue"), owner: text(r, "owner") };
};

// ---- the strategy registry (PM.Agents.Strategy) -----------------------------------------------------

export interface EnvelopeC {
  maxStakePerTrade: bigint;
  maxDailySpend: bigint;
  maxOpenPositions: number;
  /** Side terms; 0 = the strategy sets no price ceiling. */
  maxPriceTicks: number;
}
const envelope = (v: unknown): EnvelopeC => {
  const r = obj(v, "Envelope");
  return { maxStakePerTrade: big(r, "maxStakePerTrade"), maxDailySpend: big(r, "maxDailySpend"), maxOpenPositions: small(r, "maxOpenPositions"), maxPriceTicks: small(r, "maxPriceTicks") };
};

export interface CreatorLicenseC {
  venue: Party;
  creator: Party;
  nextIndex: number;
}
export const decodeCreatorLicense = (v: unknown): CreatorLicenseC => {
  const r = obj(v, "CreatorLicense");
  return { venue: text(r, "venue"), creator: text(r, "creator"), nextIndex: small(r, "nextIndex") };
};

export interface StrategyC {
  venue: Party;
  creator: Party;
  strategyId: string;
  runner: Party;
  envelope: EnvelopeC;
  fee: bigint;
  spec: string;
  specHash: string;
  version: number;
  active: boolean;
  publishedAtSec: number | null;
}
export function decodeStrategy(v: unknown): StrategyC {
  const r = obj(v, "Strategy");
  return {
    venue: text(r, "venue"), creator: text(r, "creator"), strategyId: text(r, "strategyId"), runner: text(r, "runner"), envelope: envelope(r.envelope),
    fee: big(r, "fee"), spec: text(r, "spec"), specHash: text(r, "specHash"), version: small(r, "version"), active: bool(r, "active"), publishedAtSec: optSec(r, "publishedAt"),
  };
}

export interface StrategyListingC {
  venue: Party;
  creator: Party;
  strategyId: string;
  strategyCid: ContractId;
  runner: Party;
  envelope: EnvelopeC;
  fee: bigint;
  specHash: string;
  version: number;
  active: boolean;
  publishedAtSec: number | null;
}
export function decodeStrategyListing(v: unknown): StrategyListingC {
  const r = obj(v, "StrategyListing");
  return {
    venue: text(r, "venue"), creator: text(r, "creator"), strategyId: text(r, "strategyId"), strategyCid: text(r, "strategyCid"), runner: text(r, "runner"),
    envelope: envelope(r.envelope), fee: big(r, "fee"), specHash: text(r, "specHash"), version: small(r, "version"), active: bool(r, "active"), publishedAtSec: optSec(r, "publishedAt"),
  };
}

export interface SubscriberInviteC {
  venue: Party;
  subscriber: Party;
}
export const decodeSubscriberInvite = (v: unknown): SubscriberInviteC => {
  const r = obj(v, "SubscriberInvite");
  return { venue: text(r, "venue"), subscriber: text(r, "subscriber") };
};

export interface SubscriberBookC {
  venue: Party;
  subscriber: Party;
  following: string[];
}
export const decodeSubscriberBook = (v: unknown): SubscriberBookC => {
  const r = obj(v, "SubscriberBook");
  return { venue: text(r, "venue"), subscriber: text(r, "subscriber"), following: texts(r, "following") };
};

export type SubKindC = "SubCopy" | "SubFade" | "SubMirror";
const subKind = (v: unknown): SubKindC => {
  if (v === "SubCopy" || v === "SubFade" || v === "SubMirror") return v;
  throw new DecodeError(`kind ${JSON.stringify(v)} is not a SubKind`);
};

export interface SubscriptionC {
  venue: Party;
  subscriber: Party;
  creator: Party;
  strategyId: string;
  runner: Party;
  kind: SubKindC;
  version: number;
  specHash: string;
  /** The grant as it was at subscribe time: a grant is re-created by every trade, so read the live one by (owner, agent). */
  grantCid: ContractId;
  feePaid: bigint;
}
export function decodeSubscription(v: unknown): SubscriptionC {
  const r = obj(v, "Subscription");
  return {
    venue: text(r, "venue"), subscriber: text(r, "subscriber"), creator: text(r, "creator"), strategyId: text(r, "strategyId"), runner: text(r, "runner"),
    kind: subKind(r.kind), version: small(r, "version"), specHash: text(r, "specHash"), grantCid: text(r, "grantCid"), feePaid: big(r, "feePaid"),
  };
}

export interface StrategyFeeC {
  venue: Party;
  creator: Party;
  strategyId: string;
  amount: bigint;
}
export const decodeStrategyFee = (v: unknown): StrategyFeeC => {
  const r = obj(v, "StrategyFee");
  return { venue: text(r, "venue"), creator: text(r, "creator"), strategyId: text(r, "strategyId"), amount: big(r, "amount") };
};

export interface CreatorPayoutC {
  venue: Party;
  creator: Party;
  period: number;
  feeCount: number;
  amount: bigint;
}
export const decodeCreatorPayout = (v: unknown): CreatorPayoutC => {
  const r = obj(v, "CreatorPayout");
  return { venue: text(r, "venue"), creator: text(r, "creator"), period: small(r, "period"), feeCount: small(r, "feeCount"), amount: big(r, "amount") };
};

// ---- the desk (PM.Agents.Desk) -----------------------------------------------------------------------

export type DeskModeC = "DeskLive" | "DeskShadow";

export interface DeskOfferC {
  venue: Party;
  owner: Party;
}
export const decodeDeskOffer = (v: unknown): DeskOfferC => {
  const r = obj(v, "DeskOffer");
  return { venue: text(r, "venue"), owner: text(r, "owner") };
};

export interface DeskHoldingC {
  marketId: string;
  side: Side;
  lots: bigint;
  refundAfterSec: number;
}

export interface DeskMandateC {
  venue: Party;
  owner: Party;
  /** null = revoked. */
  operator: Party | null;
  grant: AgentGrantC;
  /** Series keys the desk may buy. */
  allowList: string[];
  maxPremiumBps: number;
  attestors: Party[];
  refQuorum: number;
  mode: DeskModeC;
  paused: boolean;
  /** 64 lowercase hex digits, no `0x`. */
  head: string;
  seq: number;
  /** 0.2.0: what the desk bought and still holds (none on a 0.1.0 mandate). */
  holdings: DeskHoldingC[];
}
export function decodeDeskMandate(v: unknown): DeskMandateC {
  const r = obj(v, "DeskMandate");
  const mode = r.mode;
  if (mode !== "DeskLive" && mode !== "DeskShadow") throw new DecodeError(`mode ${JSON.stringify(mode)} is not a DeskMode`);
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), operator: r.operator === null || r.operator === undefined ? null : (r.operator as string),
    grant: decodeAgentGrant(r.grant), allowList: texts(r, "allowList"), maxPremiumBps: small(r, "maxPremiumBps"), attestors: texts(r, "attestors"),
    refQuorum: small(r, "refQuorum"), mode, paused: bool(r, "paused"), head: text(r, "head"), seq: small(r, "seq"),
    holdings: list(r, "holdings").map((h) => {
      const x = obj(h, "DeskHolding");
      return { marketId: text(x, "marketId"), side: side(x.side), lots: big(x, "lots"), refundAfterSec: sec(x, "refundAfter") };
    }),
  };
}

export type DeskActionC =
  | { kind: "hold" }
  | { kind: "trade"; marketId: string; side: Side; lots: bigint; priceTicks: number; referenceTicks: number; charge: bigint }
  | { kind: "sell"; marketId: string; side: Side; lots: bigint; priceTicks: number; referenceTicks: number; proceeds: bigint; counted: bigint };

export interface DeskDecisionC {
  venue: Party;
  owner: Party;
  operator: Party;
  seq: number;
  prevHead: string;
  decisionHash: string;
  head: string;
  action: DeskActionC;
  note: string;
}
function deskAction(v: unknown): DeskActionC {
  const r = obj(v, "DeskAction");
  if (r.tag === "DeskHold") return { kind: "hold" };
  const x = obj(r.value, String(r.tag));
  const base = { marketId: text(x, "marketId"), side: side(x.side), lots: big(x, "lots"), priceTicks: small(x, "priceTicks"), referenceTicks: small(x, "referenceTicks") };
  if (r.tag === "DeskTrade") return { kind: "trade", ...base, charge: big(x, "charge") };
  if (r.tag === "DeskSell") return { kind: "sell", ...base, proceeds: big(x, "proceeds"), counted: big(x, "counted") };
  throw new DecodeError(`DeskAction tag ${JSON.stringify(r.tag)}`);
}
export function decodeDeskDecision(v: unknown): DeskDecisionC {
  const r = obj(v, "DeskDecision");
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), operator: text(r, "operator"), seq: small(r, "seq"), prevHead: text(r, "prevHead"),
    decisionHash: text(r, "decisionHash"), head: text(r, "head"), action: deskAction(r.action), note: text(r, "note"),
  };
}

export interface DeskMarkC {
  attestor: Party;
  venue: Party;
  marketId: string;
  side: Side;
  refTicks: number;
  fetchedAtSec: number;
}
export const decodeDeskMark = (v: unknown): DeskMarkC => {
  const r = obj(v, "DeskMark");
  return { attestor: text(r, "attestor"), venue: text(r, "venue"), marketId: text(r, "marketId"), side: side(r.side), refTicks: small(r, "refTicks"), fetchedAtSec: sec(r, "fetchedAt") };
};
