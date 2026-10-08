/**
 * abu-pm-seat 0.1.0 (R2, revamp step 4) as the venue's actors and the web's server half read it: the seat's resting
 * exit and a credit transfer between seats. The venue observes every exit and co-signs every transfer offer, so its ACS
 * holds them all.
 */
import type { ContractId, Party } from "@owarine/ledger/pure";
import { decodeParts, DecodeError, type Side } from "./decode";

const { obj, text, big, small, sec, optional, side } = decodeParts;

/** A spot level that triggers an exit; `trailBps` set makes it a trailing stop the venue ratchets. */
export interface ExitStopC {
  /** price × 10^8, as the Window's prints are written */
  stopE8: bigint;
  trailBps: number | null;
}

/** One resting exit: sell up to `lots` of the owner's `outcome` on this Window at ≥ `floorTicks` (own-side ticks of 1000). */
export interface RestingExitC {
  owner: Party;
  venue: Party;
  exitRef: string;
  termsCid: ContractId;
  marketId: string;
  outcome: Side;
  lots: bigint;
  cashUnit: bigint;
  floorTicks: number;
  takeProfitTicks: number | null;
  stop: ExitStopC | null;
  expiresAtSec: number;
}

export interface CashTransferOfferC {
  venue: Party;
  sender: Party;
  receiver: Party;
  amount: bigint;
  memo: string;
}

const smallOf = (v: unknown, k: string): number => small({ [k]: v }, k);

export function decodeRestingExit(v: unknown): RestingExitC {
  const r = obj(v, "RestingExit");
  const stop = optional(r.stop, (x) => {
    const s = obj(x, "Stop");
    return { stopE8: big(s, "stopE8"), trailBps: optional(s.trailBps, (b) => smallOf(b, "trailBps")) };
  });
  const out: RestingExitC = {
    owner: text(r, "owner"), venue: text(r, "venue"), exitRef: text(r, "exitRef"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"),
    outcome: side(r.outcome), lots: big(r, "lots"), cashUnit: big(r, "cashUnit"), floorTicks: small(r, "floorTicks"),
    takeProfitTicks: optional(r.takeProfitTicks, (x) => smallOf(x, "takeProfitTicks")), stop, expiresAtSec: sec(r, "expiresAt"),
  };
  if (out.takeProfitTicks === null && out.stop === null) throw new DecodeError("RestingExit has neither a take-profit nor a stop");
  return out;
}

export function decodeCashTransferOffer(v: unknown): CashTransferOfferC {
  const r = obj(v, "CashTransferOffer");
  return { venue: text(r, "venue"), sender: text(r, "sender"), receiver: text(r, "receiver"), amount: big(r, "amount"), memo: text(r, "memo") };
}
