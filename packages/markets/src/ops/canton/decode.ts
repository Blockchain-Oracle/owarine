/**
 * abu-pm-main contract payloads (Daml-LF JSON) → the typed shapes the venue actors read. Server-only.
 *
 * Every Daml `Int` arrives as a string and becomes a `bigint` through `@agari/ledger`'s `fromDamlInt`, never `Number`,
 * except small counters (index, cadence, quorum, ticks, seconds) that are range-checked into a safe `number`. Every
 * Daml `Time` becomes epoch seconds (`…Sec`), floored: the engine's deadlines are whole seconds.
 */
import { fromDamlInt, type ContractId, type CreatedEvent, type Party } from "@agari/ledger";

export type Side = "SideUp" | "SideDown";
export type SlotName = "OpenSlot" | "CloseSlot";

type Raw = Record<string, unknown>;

export class DecodeError extends Error {
  override readonly name = "DecodeError";
}

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
/** A small Int (index, seconds, ticks, bps) as a safe number. */
const small = (r: Raw, k: string): number => {
  const b = big(r, k);
  if (b > BigInt(Number.MAX_SAFE_INTEGER) || b < -BigInt(Number.MAX_SAFE_INTEGER)) throw new DecodeError(`field ${k} exceeds a safe integer`);
  return Number(b);
};

/** Daml `Time` JSON (`2026-09-29T12:00:00Z`, optionally with a fraction) → epoch seconds, floored. */
export function timeSec(v: unknown, what = "Time"): number {
  if (typeof v !== "string") throw new DecodeError(`${what} is not a timestamp string`);
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) throw new DecodeError(`${what} ${JSON.stringify(v)} is not a timestamp`);
  return Math.floor(ms / 1000);
}
const sec = (r: Raw, k: string) => timeSec(r[k], k);

/** Epoch seconds → Daml `Time` JSON. */
export const isoOfSec = (s: number): string => new Date(s * 1000).toISOString().replace(".000Z", "Z");

const optional = <T>(v: unknown, read: (x: unknown) => T): T | null => (v === null || v === undefined ? null : read(v));
const parties = (v: unknown, what: string): Party[] => {
  if (!Array.isArray(v) || !v.every((p) => typeof p === "string")) throw new DecodeError(`${what} is not a party list`);
  return v as Party[];
};
const side = (v: unknown): Side => {
  if (v === "SideUp" || v === "SideDown") return v;
  throw new DecodeError(`side ${JSON.stringify(v)} is not SideUp/SideDown`);
};

export interface PolicyVersionC {
  version: number;
  effectiveFromSec: number;
  validUntilSec: number | null;
  printSource: string;
  minDelaySec: number;
  barLenSec: number;
  /** Negative: admit until `lockAt` (the reference's ADMIT_UNTIL_LOCK). */
  openAdmissionSec: number;
  closeAdmissionSec: number;
}

export interface SeriesC {
  venue: Party;
  resolver: Party;
  auditor: Party;
  seriesKey: string;
  symbol: string;
  anchorSec: number;
  cadenceSec: number;
  lockLeadSec: number;
  settleGraceSec: number;
  cashUnit: bigint;
  nextIndex: number;
  oracles: Party[];
  quorum: number;
  maxDeviationBps: number;
  policyVersions: PolicyVersionC[];
}

export interface TermsC {
  venue: Party;
  resolver: Party;
  seriesKey: string;
  marketId: string;
  index: number;
  symbol: string;
  cashUnit: bigint;
  tradingStartSec: number;
  lockAtSec: number;
  expirySec: number;
  openDeadlineSec: number;
  closeDeadlineSec: number;
  refundAfterSec: number;
  policyVersion: number;
  printSource: string;
  minDelaySec: number;
  barLenSec: number;
  tieUp: boolean;
  oracles: Party[];
  quorum: number;
  maxDeviationBps: number;
}

export interface WindowStateC {
  venue: Party;
  resolver: Party;
  termsCid: ContractId;
}

export interface EvidenceC {
  oracle: Party;
  priceE8: bigint;
  fetchedAtSec: number;
  payloadHash: string;
  quoteCid: ContractId;
}

export interface OpenPrintC {
  termsCid: ContractId;
  marketId: string;
  openPriceE8: bigint;
  evidence: EvidenceC[];
  signers: number;
}

export type VoidReasonC = { tag: "MissingPrint" | "QuorumNotMet" | "ResolverAbsent" | "SourceDisagreement"; slot: SlotName };

export interface ResolutionC {
  venue: Party;
  resolver: Party;
  termsCid: ContractId;
  marketId: string;
  outcome: Side | null;
  voidReason: VoidReasonC | null;
  openPriceE8: bigint | null;
  closePriceE8: bigint | null;
  openEvidence: EvidenceC[];
  closeEvidence: EvidenceC[];
  signers: number;
}

export interface PriceQuoteC {
  oracle: Party;
  venue: Party;
  resolver: Party;
  symbol: string;
  boundarySec: number;
  priceE8: bigint;
  barStartSec: number;
  barLenSec: number;
  fetchedAtSec: number;
  payloadHash: string;
  policyVersion: number;
}

export interface VenueCashC {
  venue: Party;
  owner: Party;
  amount: bigint;
  bucket: string;
}

export interface QuoteC {
  venue: Party;
  user: Party;
  termsCid: ContractId;
  marketId: string;
  pairId: string;
  side: Side;
  priceTicks: number;
  lots: bigint;
  cashUnit: bigint;
  fee: bigint;
  validUntilSec: number;
  lockAtSec: number;
  refundAfterSec: number;
}

export interface LegC {
  venue: Party;
  owner: Party;
  termsCid: ContractId;
  marketId: string;
  pairId: string;
  outcome: Side;
  lots: bigint;
  cashUnit: bigint;
  backingShare: bigint;
  feePaid: bigint;
  refundAfterSec: number;
  beneficiaryRef: string | null;
}

export interface NettedResidualC {
  termsCid: ContractId;
  marketId: string;
  pairA: string;
  pairB: string;
  heldIfVoid: bigint;
  owedIfResolved: bigint;
}

export interface VenueAccountC {
  venue: Party;
  owner: Party;
  label: string;
}

function policyVersion(v: unknown): PolicyVersionC {
  const r = obj(v, "PolicyVersion");
  return {
    version: small(r, "version"),
    effectiveFromSec: sec(r, "effectiveFrom"),
    validUntilSec: optional(r.validUntil, (x) => timeSec(x, "validUntil")),
    printSource: text(r, "printSource"),
    minDelaySec: small(r, "minDelaySec"),
    barLenSec: small(r, "barLenSec"),
    openAdmissionSec: small(r, "openAdmissionSec"),
    closeAdmissionSec: small(r, "closeAdmissionSec"),
  };
}

export function decodeSeries(v: unknown): SeriesC {
  const r = obj(v, "Series");
  const versions = r.policyVersions;
  if (!Array.isArray(versions)) throw new DecodeError("policyVersions is not a list");
  return {
    venue: text(r, "venue"), resolver: text(r, "resolver"), auditor: text(r, "auditor"),
    seriesKey: text(r, "seriesKey"), symbol: text(r, "symbol"), anchorSec: sec(r, "anchor"),
    cadenceSec: small(r, "cadenceSec"), lockLeadSec: small(r, "lockLeadSec"), settleGraceSec: small(r, "settleGraceSec"),
    cashUnit: big(r, "cashUnit"), nextIndex: small(r, "nextIndex"), oracles: parties(r.oracles, "oracles"),
    quorum: small(r, "quorum"), maxDeviationBps: small(r, "maxDeviationBps"), policyVersions: versions.map(policyVersion),
  };
}

export function decodeTerms(v: unknown): TermsC {
  const r = obj(v, "MarketTerms");
  return {
    venue: text(r, "venue"), resolver: text(r, "resolver"), seriesKey: text(r, "seriesKey"), marketId: text(r, "marketId"),
    index: small(r, "index"), symbol: text(r, "symbol"), cashUnit: big(r, "cashUnit"),
    tradingStartSec: sec(r, "tradingStart"), lockAtSec: sec(r, "lockAt"), expirySec: sec(r, "expiry"),
    openDeadlineSec: sec(r, "openDeadline"), closeDeadlineSec: sec(r, "closeDeadline"), refundAfterSec: sec(r, "refundAfter"),
    policyVersion: small(r, "policyVersion"), printSource: text(r, "printSource"), minDelaySec: small(r, "minDelaySec"),
    barLenSec: small(r, "barLenSec"), tieUp: r.tieUp === true, oracles: parties(r.oracles, "oracles"),
    quorum: small(r, "quorum"), maxDeviationBps: small(r, "maxDeviationBps"),
  };
}

export function decodeWindowState(v: unknown): WindowStateC {
  const r = obj(v, "WindowState");
  return { venue: text(r, "venue"), resolver: text(r, "resolver"), termsCid: text(r, "termsCid") };
}

function evidence(v: unknown): EvidenceC {
  const r = obj(v, "Evidence");
  return { oracle: text(r, "oracle"), priceE8: big(r, "priceE8"), fetchedAtSec: sec(r, "fetchedAt"), payloadHash: text(r, "payloadHash"), quoteCid: text(r, "quoteCid") };
}
const evidenceList = (v: unknown, what: string) => {
  if (!Array.isArray(v)) throw new DecodeError(`${what} is not a list`);
  return v.map(evidence);
};

export function decodeOpenPrint(v: unknown): OpenPrintC {
  const r = obj(v, "OpenPrint");
  return { termsCid: text(r, "termsCid"), marketId: text(r, "marketId"), openPriceE8: big(r, "openPriceE8"), evidence: evidenceList(r.evidence, "evidence"), signers: small(r, "signers") };
}

function voidReason(v: unknown): VoidReasonC {
  const r = obj(v, "VoidReason");
  const tag = r.tag;
  if (tag !== "MissingPrint" && tag !== "QuorumNotMet" && tag !== "ResolverAbsent" && tag !== "SourceDisagreement") throw new DecodeError(`void reason ${JSON.stringify(tag)}`);
  const slot = obj(r.value, "VoidReason.value").slot;
  if (slot !== "OpenSlot" && slot !== "CloseSlot") throw new DecodeError(`slot ${JSON.stringify(slot)}`);
  return { tag, slot };
}

export function decodeResolution(v: unknown): ResolutionC {
  const r = obj(v, "Resolution");
  return {
    venue: text(r, "venue"), resolver: text(r, "resolver"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"),
    outcome: optional(r.outcome, side), voidReason: optional(r.voidReason, voidReason),
    openPriceE8: optional(r.openPriceE8, (x) => fromDamlInt(x, "openPriceE8")), closePriceE8: optional(r.closePriceE8, (x) => fromDamlInt(x, "closePriceE8")),
    openEvidence: evidenceList(r.openEvidence, "openEvidence"), closeEvidence: evidenceList(r.closeEvidence, "closeEvidence"), signers: small(r, "signers"),
  };
}

export function decodePriceQuote(v: unknown): PriceQuoteC {
  const r = obj(v, "PriceQuote");
  return {
    oracle: text(r, "oracle"), venue: text(r, "venue"), resolver: text(r, "resolver"), symbol: text(r, "symbol"),
    boundarySec: sec(r, "boundaryT"), priceE8: big(r, "priceE8"), barStartSec: sec(r, "barStart"), barLenSec: small(r, "barLenSec"),
    fetchedAtSec: sec(r, "fetchedAt"), payloadHash: text(r, "payloadHash"), policyVersion: small(r, "policyVersion"),
  };
}

export function decodeVenueCash(v: unknown): VenueCashC {
  const r = obj(v, "VenueCash");
  return { venue: text(r, "venue"), owner: text(r, "owner"), amount: big(r, "amount"), bucket: text(r, "bucket") };
}

export function decodeQuote(v: unknown): QuoteC {
  const r = obj(v, "Quote");
  return {
    venue: text(r, "venue"), user: text(r, "user"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"), pairId: text(r, "pairId"),
    side: side(r.side), priceTicks: small(r, "priceTicks"), lots: big(r, "lots"), cashUnit: big(r, "cashUnit"), fee: big(r, "fee"),
    validUntilSec: sec(r, "validUntil"), lockAtSec: sec(r, "lockAt"), refundAfterSec: sec(r, "refundAfter"),
  };
}

export function decodeLeg(v: unknown): LegC {
  const r = obj(v, "Leg");
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"), pairId: text(r, "pairId"),
    outcome: side(r.outcome), lots: big(r, "lots"), cashUnit: big(r, "cashUnit"), backingShare: big(r, "backingShare"), feePaid: big(r, "feePaid"),
    refundAfterSec: sec(r, "refundAfter"), beneficiaryRef: optional(r.beneficiaryRef, (x) => (typeof x === "string" ? x : null)),
  };
}

export function decodeNettedResidual(v: unknown): NettedResidualC {
  const r = obj(v, "NettedResidual");
  return { termsCid: text(r, "termsCid"), marketId: text(r, "marketId"), pairA: text(r, "pairA"), pairB: text(r, "pairB"), heldIfVoid: big(r, "heldIfVoid"), owedIfResolved: big(r, "owedIfResolved") };
}

export function decodeVenueAccount(v: unknown): VenueAccountC {
  const r = obj(v, "VenueAccount");
  return { venue: text(r, "venue"), owner: text(r, "owner"), label: text(r, "label") };
}

/** A decoded active contract: its id, its payload and (when asked for) its disclosure blob. */
export interface Active<T> {
  cid: ContractId;
  data: T;
  createdEventBlob?: string;
}

/** `#abu-pm-main:PM.Quote:Quote` and `<pkgId>:PM.Quote:Quote` both end in `:PM.Quote:Quote`. */
export const templateSuffix = (templateId: string): string => templateId.slice(templateId.indexOf(":"));

export function activeOf<T>(e: CreatedEvent, decode: (v: unknown) => T): Active<T> {
  return { cid: e.contractId, data: decode(e.createArgument), ...(e.createdEventBlob ? { createdEventBlob: e.createdEventBlob } : {}) };
}
