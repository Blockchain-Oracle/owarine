/**
 * Window addresses, the ledger clock and seat reads for the drives (C1 stub). The reference derived Solana PDAs and read
 * the clock sysvar; on Canton a window is a `MarketTerms` contract (C3). `coveringVersion` is pure and kept.
 */
import type { Address } from "@owarine/core/types";
import type { Series } from "../../ops/shapes";
import type { DeployClient } from "../client";
import { deployNotLive } from "../send";

export type WindowAddresses = { series: Address; index: bigint; market: Address; ledger: Address; mvault: Address };

export async function eventAuthority(): Promise<Address> {
  throw deployNotLive();
}

export async function windowAddresses(_series: Address, _index: bigint): Promise<WindowAddresses> {
  throw deployNotLive();
}

/** The ledger's clock (C3 reads the participant's time); not live in C1. */
export async function chainNowSec(_client: DeployClient): Promise<number> {
  throw deployNotLive();
}

const I64_MAX = 9_223_372_036_854_775_807n;

/** The highest policy version covering both boundaries, or null (the Window isn't listed). Pure. */
export function coveringVersion(series: Series, startSec: number, expirySec: number): number | null {
  for (let i = series.versionCount - 1; i >= 0; i--) {
    const v = series.policyVersions[i]!;
    const until = v.validUntilTs === I64_MAX ? Number.MAX_SAFE_INTEGER : Number(v.validUntilTs);
    if (Number(v.validFromTs) <= startSec && expirySec <= until) return i;
  }
  return null;
}

export type Seat = {
  index: number;
  owner: Address;
  credit: bigint;
  lockedCash: bigint;
  yesFree: bigint;
  yesLocked: bigint;
  noFree: bigint;
  noLocked: bigint;
  openOrders: number;
  flags: number;
};

export async function readSeats(_client: DeployClient, _ledger: Address): Promise<Seat[]> {
  throw deployNotLive();
}
