/**
 * abu-pm-main 0.5.1 (`PM.Resting`, K-235): the pre-open resting call as the venue's actors read it. The venue signs
 * every one of these, so its ACS holds them all.
 */
import type { ContractId, Party } from "@agari/ledger/pure";
import { decodeParts, type Side } from "./decode";

const { obj, text, big, small, sec, side } = decodeParts;

/** One resting call: `lots` still rest at `priceTicks` (the owner's own-side price), `escrow` held for them. */
export interface RestingCallC {
  venue: Party;
  owner: Party;
  callRef: string;
  termsCid: ContractId;
  marketId: string;
  side: Side;
  priceTicks: number;
  lotsPlaced: bigint;
  lots: bigint;
  cashUnit: bigint;
  escrow: bigint;
  tradingStartSec: number;
  lockAtSec: number;
  refundAfterSec: number;
  expiresAtSec: number;
}

/** The venue's offer to hold a call, not yet placed by its owner. */
export interface RestingOfferC {
  venue: Party;
  owner: Party;
  callRef: string;
  termsCid: ContractId;
  marketId: string;
  side: Side;
  lots: bigint;
  priceTicks: number;
  cashUnit: bigint;
  tradingStartSec: number;
  lockAtSec: number;
  refundAfterSec: number;
  expiresAtSec: number;
  validUntilSec: number;
}

export function decodeRestingCall(v: unknown): RestingCallC {
  const r = obj(v, "RestingCall");
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), callRef: text(r, "callRef"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"),
    side: side(r.side), priceTicks: small(r, "priceTicks"), lotsPlaced: big(r, "lotsPlaced"), lots: big(r, "lots"), cashUnit: big(r, "cashUnit"),
    escrow: big(r, "escrow"), tradingStartSec: sec(r, "tradingStart"), lockAtSec: sec(r, "lockAt"), refundAfterSec: sec(r, "refundAfter"),
    expiresAtSec: sec(r, "expiresAt"),
  };
}

export function decodeRestingOffer(v: unknown): RestingOfferC {
  const r = obj(v, "RestingOffer");
  return {
    venue: text(r, "venue"), owner: text(r, "owner"), callRef: text(r, "callRef"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"),
    side: side(r.side), lots: big(r, "lots"), priceTicks: small(r, "priceTicks"), cashUnit: big(r, "cashUnit"), tradingStartSec: sec(r, "tradingStart"),
    lockAtSec: sec(r, "lockAt"), refundAfterSec: sec(r, "refundAfter"), expiresAtSec: sec(r, "expiresAt"), validUntilSec: sec(r, "validUntil"),
  };
}
