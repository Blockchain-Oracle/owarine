/**
 * abu-pm-cc contract payloads and CIP-56 interface views (Daml-LF JSON) → the typed shapes the Canton Coin rail reads
 * (C7b). Server-only. Int arrives as a string → `bigint`; Time → epoch seconds; a `Decimal` is converted to atomic
 * integer units through `@agari/ledger`'s `fromDamlNumeric` and never becomes a `number` (plan §7).
 */
import { fromDamlNumeric, type ContractId, type Party } from "@agari/ledger/pure";
import { decodeParts, DecodeError } from "../canton/decode";

const { obj, text, big, sec, optional } = decodeParts;
type Raw = Record<string, unknown>;

const bool = (r: Raw, k: string): boolean => {
  const v = r[k];
  if (typeof v !== "boolean") throw new DecodeError(`field ${k} is not a boolean`);
  return v;
};
const optCid = (v: unknown): ContractId | null => optional(v, (x) => (typeof x === "string" ? x : null));
const stringMap = (v: unknown, what: string): Record<string, string> => {
  const m = obj(v ?? {}, what);
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(m)) if (typeof x === "string") out[k] = x;
  return out;
};
const decimalAtomic = (r: Raw, k: string): bigint => fromDamlNumeric(r[k], 10, k);

// ---- abu-pm-cc -----------------------------------------------------------------------------------

export interface ListingC {
  venue: Party;
  auditor: Party;
  listingId: string;
  instrumentAdmin: Party;
  instrumentId: string;
  /** Cash base units per one whole coin; divides 10^10 (K-245). */
  unitsPerCoin: bigint;
  minDepositUnits: bigint;
  maxDepositUnits: bigint;
  depositsOpen: boolean;
}

export function decodeListing(v: unknown): ListingC {
  const r = obj(v, "CcListing");
  return {
    venue: text(r, "venue"), auditor: text(r, "auditor"), listingId: text(r, "listingId"), instrumentAdmin: text(r, "instrumentAdmin"),
    instrumentId: text(r, "instrumentId"), unitsPerCoin: big(r, "unitsPerCoin"), minDepositUnits: big(r, "minDepositUnits"),
    maxDepositUnits: big(r, "maxDepositUnits"), depositsOpen: bool(r, "depositsOpen"),
  };
}

export interface AllowanceC {
  venue: Party;
  auditor: Party;
  owner: Party;
  listingId: string;
  units: bigint;
}

export function decodeAllowance(v: unknown): AllowanceC {
  const r = obj(v, "CcAllowance");
  return { venue: text(r, "venue"), auditor: text(r, "auditor"), owner: text(r, "owner"), listingId: text(r, "listingId"), units: big(r, "units") };
}

export interface DepositC {
  venue: Party;
  owner: Party;
  listingId: string;
  instrumentAdmin: Party;
  instrumentId: string;
  unitsPerCoin: bigint;
  receivedAtomic: bigint;
  units: bigint;
  settledAtSec: number;
  ref: string;
}

export function decodeDeposit(v: unknown): DepositC {
  const r = obj(v, "CcDeposit");
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), listingId: text(r, "listingId"), instrumentAdmin: text(r, "instrumentAdmin"),
    instrumentId: text(r, "instrumentId"), unitsPerCoin: big(r, "unitsPerCoin"), receivedAtomic: big(r, "receivedAtomic"),
    units: big(r, "units"), settledAtSec: sec(r, "settledAt"), ref: text(r, "ref"),
  };
}

export type WithdrawalStateName = "WdSent" | "WdCompleted" | "WdRefunded";

export interface WithdrawalC {
  venue: Party;
  owner: Party;
  listingId: string;
  instrumentAdmin: Party;
  instrumentId: string;
  unitsPerCoin: bigint;
  units: bigint;
  sentAtomic: bigint;
  state: WithdrawalStateName;
  /** Set exactly while the state is `WdSent`: the TransferInstruction the owner has not accepted yet. */
  instructionCid: ContractId | null;
  openedAtSec: number;
  ref: string;
}

export function decodeWithdrawal(v: unknown): WithdrawalC {
  const r = obj(v, "CcWithdrawal");
  const state = r.state;
  if (state !== "WdSent" && state !== "WdCompleted" && state !== "WdRefunded") throw new DecodeError(`withdrawal state ${JSON.stringify(state)} is unknown`);
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), listingId: text(r, "listingId"), instrumentAdmin: text(r, "instrumentAdmin"),
    instrumentId: text(r, "instrumentId"), unitsPerCoin: big(r, "unitsPerCoin"), units: big(r, "units"), sentAtomic: big(r, "sentAtomic"),
    state, instructionCid: optCid(r.instructionCid), openedAtSec: sec(r, "openedAt"), ref: text(r, "ref"),
  };
}

export interface StatementC {
  venue: Party;
  auditor: Party;
  listingId: string;
  instrumentAdmin: Party;
  instrumentId: string;
  unitsPerCoin: bigint;
  seq: number;
  asOfSec: number;
  heldAtomic: bigint;
  heldUnits: bigint;
  liabilityUnits: bigint;
  allowanceCount: number;
  covered: boolean;
}

export function decodeStatement(v: unknown): StatementC {
  const r = obj(v, "CcReserveStatement");
  return {
    venue: text(r, "venue"), auditor: text(r, "auditor"), listingId: text(r, "listingId"), instrumentAdmin: text(r, "instrumentAdmin"),
    instrumentId: text(r, "instrumentId"), unitsPerCoin: big(r, "unitsPerCoin"), seq: Number(big(r, "seq")), asOfSec: sec(r, "asOf"),
    heldAtomic: big(r, "heldAtomic"), heldUnits: big(r, "heldUnits"), liabilityUnits: big(r, "liabilityUnits"),
    allowanceCount: Number(big(r, "allowanceCount")), covered: bool(r, "covered"),
  };
}

export interface ProposalC {
  owner: Party;
  venue: Party;
  listingId: string;
  units: bigint;
  ref: string;
}

export function decodeProposal(v: unknown): ProposalC {
  const r = obj(v, "CcWithdrawProposal");
  return { owner: text(r, "owner"), venue: text(r, "venue"), listingId: text(r, "listingId"), units: big(r, "units"), ref: text(r, "ref") };
}

// ---- CIP-56 V1 views (the token standard's own shapes) -------------------------------------------

export interface HoldingViewC {
  owner: Party;
  instrumentAdmin: Party;
  instrumentId: string;
  /** The `Decimal` amount as atomic units of 10^-10: exact, never a float. */
  amountAtomic: bigint;
  lock: { holders: Party[]; expiresAtSec: number | null; context: string | null } | null;
  meta: Record<string, string>;
}

export function decodeHoldingView(v: unknown): HoldingViewC {
  const r = obj(v, "HoldingView");
  const inst = obj(r.instrumentId, "instrumentId");
  const lock = optional(r.lock, (x) => {
    const l = obj(x, "lock");
    const holders = Array.isArray(l.holders) ? l.holders.filter((p): p is string => typeof p === "string") : [];
    return { holders, expiresAtSec: optional(l.expiresAt, (t) => sec({ t }, "t")), context: optional(l.context, (c) => (typeof c === "string" ? c : null)) };
  });
  return {
    owner: text(r, "owner"), instrumentAdmin: text(inst, "admin"), instrumentId: text(inst, "id"), amountAtomic: decimalAtomic(r, "amount"),
    lock, meta: stringMap(obj(r.meta ?? { values: {} }, "meta").values, "meta.values"),
  };
}

export interface TransferInstructionViewC {
  status: "PendingReceiverAcceptance" | "PendingInternalWorkflow";
  sender: Party;
  receiver: Party;
  instrumentAdmin: Party;
  instrumentId: string;
  amountAtomic: bigint;
  requestedAtSec: number;
  executeBeforeSec: number;
  meta: Record<string, string>;
}

export function decodeTransferInstructionView(v: unknown): TransferInstructionViewC {
  const r = obj(v, "TransferInstructionView");
  const t = obj(r.transfer, "transfer");
  const inst = obj(t.instrumentId, "instrumentId");
  const s = r.status;
  const tag = typeof s === "string" ? s : typeof s === "object" && s !== null ? (s as Raw).tag : null;
  const status = tag === "TransferPendingReceiverAcceptance" ? "PendingReceiverAcceptance" : tag === "TransferPendingInternalWorkflow" ? "PendingInternalWorkflow" : null;
  if (!status) throw new DecodeError(`transfer status ${JSON.stringify(s)} is unknown`);
  return {
    status, sender: text(t, "sender"), receiver: text(t, "receiver"), instrumentAdmin: text(inst, "admin"), instrumentId: text(inst, "id"),
    amountAtomic: decimalAtomic(t, "amount"), requestedAtSec: sec(t, "requestedAt"), executeBeforeSec: sec(t, "executeBefore"),
    meta: stringMap(obj(t.meta ?? { values: {} }, "transfer.meta").values, "transfer.meta.values"),
  };
}

/** The view a created event carries for one interface (`interfaceViews`, present under an InterfaceFilter), or null. */
export function interfaceViewOf(event: { interfaceViews?: readonly { interfaceId: string; viewStatus?: { code?: number }; viewValue?: unknown }[] }, interfaceId: string): unknown | null {
  const want = interfaceId.slice(interfaceId.indexOf(":"));
  for (const view of event.interfaceViews ?? []) {
    if (view.interfaceId.slice(view.interfaceId.indexOf(":")) !== want) continue;
    if (view.viewStatus && view.viewStatus.code !== undefined && view.viewStatus.code !== 0) return null;
    return view.viewValue ?? null;
  }
  return null;
}
