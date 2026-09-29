/**
 * abu-pm-tickets payloads (and the `PM.Reserve` ones they ride on) → typed shapes, for ops and the web's server half.
 * Server-only. Same rules as `../canton/decode.ts`: every Daml `Int` a `bigint` through `fromDamlInt`, small counters
 * range-checked into a `number`, every `Time` epoch seconds.
 */
import { fromDamlInt, type ContractId, type Party } from "@agari/ledger";
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
const side = (v: unknown): Side => {
  if (v === "SideUp" || v === "SideDown") return v;
  throw new DecodeError(`side ${JSON.stringify(v)} is not SideUp/SideDown`);
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], what: string): T => {
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  throw new DecodeError(`${what} ${JSON.stringify(v)} is not one of ${allowed.join("/")}`);
};

export type RangeKindC = "RangeTicket" | "Moonshot";
export type RangeSideC = "Inside" | "Outside";
export type ProductC = "RangeProduct" | "ParlayProduct" | "BoostProduct";

export interface RiskParamsC {
  maxExposureBps: number;
  maxPerTicket: bigint;
  maxPerExpiry: bigint;
  maxLeverageBps: number;
}

export interface RiskBookC {
  venue: Party;
  reserveId: string;
  product: ProductC;
  params: RiskParamsC;
  /** Reserve capital locked per boundary (epoch seconds → base units). */
  locked: Array<[number, bigint]>;
}

export interface NavStatementC {
  venue: Party;
  auditor: Party;
  reserveId: string;
  seq: number;
  asOfSec: number;
  assets: bigint;
  shares: bigint;
}

export interface LpShareC {
  venue: Party;
  provider: Party;
  reserveId: string;
  shares: bigint;
}

export interface SupplyQuoteC {
  venue: Party;
  provider: Party;
  reserveId: string;
  navSeq: number;
  cashIn: bigint;
  sharesOut: bigint;
  validUntilSec: number;
}

export interface WithdrawQuoteC {
  venue: Party;
  provider: Party;
  reserveId: string;
  navSeq: number;
  lpShareCid: ContractId;
  sharesIn: bigint;
  cashOut: bigint;
  validUntilSec: number;
}

interface RangeCommon {
  venue: Party;
  reserveId: string;
  termsCid: ContractId;
  marketId: string;
  kind: RangeKindC;
  side: RangeSideC;
  lowE8: bigint;
  highE8: bigint;
  stake: bigint;
  maxPayout: bigint;
  expirySec: number;
  refundAfterSec: number;
}

export interface RangeQuoteC extends RangeCommon {
  user: Party;
  validUntilSec: number;
  lockAtSec: number;
}

export interface RangeRoundC extends RangeCommon {
  owner: Party;
}

interface BoostCommon {
  venue: Party;
  reserveId: string;
  termsCid: ContractId;
  marketId: string;
  pairId: string;
  side: Side;
  priceTicks: number;
  lots: bigint;
  cashUnit: bigint;
  leverageBps: number;
  stake: bigint;
  fronted: bigint;
  premium: bigint;
  barrierE8: bigint;
  knockOutProceeds: bigint;
  lockAtSec: number;
  expirySec: number;
  refundAfterSec: number;
}

export interface BoostQuoteC extends BoostCommon {
  user: Party;
  validUntilSec: number;
}

export interface BoostPositionC extends BoostCommon {
  owner: Party;
  barrierFromSec: number;
}

export interface BoostExitQuoteC {
  venue: Party;
  user: Party;
  positionCid: ContractId;
  pairId: string;
  exitTicks: number;
  proceeds: bigint;
  validUntilSec: number;
}

export interface ParlayLegC {
  termsCid: ContractId;
  marketId: string;
  side: Side;
  expirySec: number;
  refundAfterSec: number;
  won: boolean;
}

export interface ParlayQuoteC {
  venue: Party;
  user: Party;
  reserveId: string;
  legs: ParlayLegC[];
  stake: bigint;
  maxPayout: bigint;
  validUntilSec: number;
  voidAfterSec: number;
}

export interface ParlayTicketC {
  venue: Party;
  owner: Party;
  reserveId: string;
  legs: ParlayLegC[];
  stake: bigint;
  maxPayout: bigint;
  voidAfterSec: number;
}

export function decodeRiskBook(v: unknown): RiskBookC {
  const r = obj(v, "RiskBook");
  const p = obj(r.params, "RiskParams");
  const lockedRaw = r.locked;
  if (!Array.isArray(lockedRaw)) throw new DecodeError("RiskBook.locked is not a map");
  const locked = lockedRaw.map((pair): [number, bigint] => {
    if (!Array.isArray(pair) || pair.length !== 2) throw new DecodeError("RiskBook.locked entry is not a pair");
    return [timeSec(pair[0], "locked key"), fromDamlInt(pair[1], "locked value")];
  });
  return {
    venue: text(r, "venue"), reserveId: text(r, "reserveId"), product: oneOf(r.product, ["RangeProduct", "ParlayProduct", "BoostProduct"] as const, "product"),
    params: { maxExposureBps: small(p, "maxExposureBps"), maxPerTicket: big(p, "maxPerTicket"), maxPerExpiry: big(p, "maxPerExpiry"), maxLeverageBps: small(p, "maxLeverageBps") },
    locked,
  };
}

export function decodeNavStatement(v: unknown): NavStatementC {
  const r = obj(v, "NavStatement");
  return { venue: text(r, "venue"), auditor: text(r, "auditor"), reserveId: text(r, "reserveId"), seq: small(r, "seq"), asOfSec: sec(r, "asOf"), assets: big(r, "assets"), shares: big(r, "shares") };
}

export function decodeLpShare(v: unknown): LpShareC {
  const r = obj(v, "LpShare");
  return { venue: text(r, "venue"), provider: text(r, "provider"), reserveId: text(r, "reserveId"), shares: big(r, "shares") };
}

export function decodeSupplyQuote(v: unknown): SupplyQuoteC {
  const r = obj(v, "SupplyQuote");
  return {
    venue: text(r, "venue"), provider: text(r, "provider"), reserveId: text(r, "reserveId"), navSeq: small(r, "navSeq"),
    cashIn: big(r, "cashIn"), sharesOut: big(r, "sharesOut"), validUntilSec: sec(r, "validUntil"),
  };
}

export function decodeWithdrawQuote(v: unknown): WithdrawQuoteC {
  const r = obj(v, "WithdrawQuote");
  return {
    venue: text(r, "venue"), provider: text(r, "provider"), reserveId: text(r, "reserveId"), navSeq: small(r, "navSeq"), lpShareCid: text(r, "lpShareCid"),
    sharesIn: big(r, "sharesIn"), cashOut: big(r, "cashOut"), validUntilSec: sec(r, "validUntil"),
  };
}

function rangeCommon(r: Raw): RangeCommon {
  return {
    venue: text(r, "venue"), reserveId: text(r, "reserveId"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"),
    kind: oneOf(r.kind, ["RangeTicket", "Moonshot"] as const, "kind"), side: oneOf(r.side, ["Inside", "Outside"] as const, "side"),
    lowE8: big(r, "lowE8"), highE8: big(r, "highE8"), stake: big(r, "stake"), maxPayout: big(r, "maxPayout"),
    expirySec: sec(r, "expiry"), refundAfterSec: sec(r, "refundAfter"),
  };
}

export function decodeRangeQuote(v: unknown): RangeQuoteC {
  const r = obj(v, "RangeQuote");
  return { ...rangeCommon(r), user: text(r, "user"), validUntilSec: sec(r, "validUntil"), lockAtSec: sec(r, "lockAt") };
}

export function decodeRangeRound(v: unknown): RangeRoundC {
  const r = obj(v, "RangeRound");
  return { ...rangeCommon(r), owner: text(r, "owner") };
}

function boostCommon(r: Raw): BoostCommon {
  return {
    venue: text(r, "venue"), reserveId: text(r, "reserveId"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"), pairId: text(r, "pairId"),
    side: side(r.side), priceTicks: small(r, "priceTicks"), lots: big(r, "lots"), cashUnit: big(r, "cashUnit"), leverageBps: small(r, "leverageBps"),
    stake: big(r, "stake"), fronted: big(r, "fronted"), premium: big(r, "premium"), barrierE8: big(r, "barrierE8"), knockOutProceeds: big(r, "knockOutProceeds"),
    lockAtSec: sec(r, "lockAt"), expirySec: sec(r, "expiry"), refundAfterSec: sec(r, "refundAfter"),
  };
}

export function decodeBoostQuote(v: unknown): BoostQuoteC {
  const r = obj(v, "BoostQuote");
  return { ...boostCommon(r), user: text(r, "user"), validUntilSec: sec(r, "validUntil") };
}

export function decodeBoostPosition(v: unknown): BoostPositionC {
  const r = obj(v, "BoostPosition");
  return { ...boostCommon(r), owner: text(r, "owner"), barrierFromSec: sec(r, "barrierFrom") };
}

export function decodeBoostExitQuote(v: unknown): BoostExitQuoteC {
  const r = obj(v, "BoostExitQuote");
  return {
    venue: text(r, "venue"), user: text(r, "user"), positionCid: text(r, "positionCid"), pairId: text(r, "pairId"),
    exitTicks: small(r, "exitTicks"), proceeds: big(r, "proceeds"), validUntilSec: sec(r, "validUntil"),
  };
}

function legs(v: unknown): ParlayLegC[] {
  if (!Array.isArray(v)) throw new DecodeError("legs is not a list");
  return v.map((x) => {
    const r = obj(x, "ParlayLeg");
    return { termsCid: text(r, "termsCid"), marketId: text(r, "marketId"), side: side(r.side), expirySec: sec(r, "expiry"), refundAfterSec: sec(r, "refundAfter"), won: bool(r, "won") };
  });
}

export function decodeParlayQuote(v: unknown): ParlayQuoteC {
  const r = obj(v, "ParlayQuote");
  return {
    venue: text(r, "venue"), user: text(r, "user"), reserveId: text(r, "reserveId"), legs: legs(r.legs), stake: big(r, "stake"), maxPayout: big(r, "maxPayout"),
    validUntilSec: sec(r, "validUntil"), voidAfterSec: sec(r, "voidAfter"),
  };
}

export function decodeParlayTicket(v: unknown): ParlayTicketC {
  const r = obj(v, "ParlayTicket");
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), reserveId: text(r, "reserveId"), legs: legs(r.legs), stake: big(r, "stake"), maxPayout: big(r, "maxPayout"),
    voidAfterSec: sec(r, "voidAfter"),
  };
}

/** The leg a parlay ticket decides next (the ledger's `nextLeg`): the pending leg with the earliest expiry, lowest index first. */
export function nextParlayLeg(legs: readonly ParlayLegC[]): number | null {
  let best: number | null = null;
  legs.forEach((l, i) => {
    if (l.won) return;
    if (best === null || l.expirySec < legs[best]!.expirySec) best = i;
  });
  return best;
}

/** The reserve capital a live ticket or quote holds (what `Earn_PublishNav` counts at cost). */
export const rangeHouseLock = (x: { stake: bigint; maxPayout: bigint }) => x.maxPayout - x.stake;
