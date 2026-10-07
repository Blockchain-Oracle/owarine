/**
 * The ledger shapes the venue actors share, re-meant for Canton (C1 stub). The reference decoded agari-events Anchor
 * accounts (`Series`, `Market`); on Canton these are the fields of the `Series` and `MarketTerms` contracts the C3
 * adapter will read from the venue's active contracts. They are kept field-compatible with what the actors read, so
 * `services/ops` keeps its pure planning code; nothing in C1 produces a value of these types.
 */
import type { Address } from "@owarine/core/types";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";
import type { ReadingError } from "../errors/reading-error";

/** A ledger command the Canton adapter will build (C3). No command exists in C1, so this is opaque. */
export type Instruction = { readonly kind: string; readonly label?: string };

/** One print source policy of a Series policy version (`source`: 0 none, 1 Pyth, 2 RedStone, 3 Switchboard, 4 attested). */
export interface PrintPolicy {
  source: number;
  graceSec: number;
  /** Pyth feed id / RedStone ASCII id left-aligned zero-padded / attested source hash. */
  feedId: Uint8Array;
  minDelaySec: number;
  barLenSec: number;
  maxConfBps: number;
  maxSlotAge: number;
  openAdmissionSec: number;
  closeAdmissionSec: number;
  strictSec: number;
}

/** A dated price-policy version (append-only on the `Series` contract). `validUntilTs` = i64 max means open-ended. */
export interface PolicyVersion {
  validFromTs: bigint;
  validUntilTs: bigint;
  primary: PrintPolicy;
  check: PrintPolicy;
  maxDivergenceBps: number;
  checkAdmissionSec: number;
}

/** A recorded print (empty: `source === 0 && sourceTs === 0n`). Prices × 10^expo. */
export interface Print {
  source: number;
  sourceTs: bigint;
  price: bigint;
  expo: number;
}

/** The `Series` contract's fields the actors read. */
export interface Series {
  ticker: number;
  basis: number;
  cadenceSec: number;
  lotBase: bigint;
  tickBase: bigint;
  cashUnit: bigint;
  minLots: bigint;
  seatBond: bigint;
  nextIndex: bigint;
  lastExpiry: bigint;
  minRestSlots: number;
  maxLeadSec: number;
  fillsCap: number;
  evictionsCap: number;
  versionCount: number;
  freeBookCount: number;
  freeBooks: Address[];
  policyVersions: PolicyVersion[];
}

/** The `MarketTerms` contract (plus its resolution state) as the actors read it. */
export interface Market {
  series: Address;
  book: Address;
  ledger: Address;
  mvault: Address;
  rentPayer: Address;
  index: bigint;
  tradingStartSec: bigint;
  lockAtSec: bigint;
  expirySec: bigint;
  openDeadline: bigint;
  closeDeadline: bigint;
  open: Print;
  close: Print;
  checkOpen: Print;
  checkClose: Print;
  backingLots: bigint;
  volumeCash: bigint;
  volumeLots: bigint;
  tradeCount: bigint;
  lastTradeTs: bigint;
  eventSeq: bigint;
  resolvedTs: bigint;
  payoutYes: number;
  payoutNo: number;
  dependents: number;
  lastPrice: number;
  policyVersion: number;
  openKind: number;
  closeKind: number;
  basis: number;
  state: number;
  voidReason: number;
  flags: number;
}

/** The error every venue-actor ledger call throws in C1: `diagnose()` reads it as `not-deployed`. */
export const opsNotLive = (area = "ops"): ReadingError => notDeployedError(cantonNotLive(area));
