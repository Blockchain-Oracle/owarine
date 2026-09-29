/**
 * The venue's ledger facts, as the order lane and the read port consume them (first-call.md §2.1 shapes, kept).
 *
 * C1 stub (the reference's D-015 on Canton): there is no participant to read yet, so every read here rejects with the
 * not-deployed reading before touching the network, and callers that wrap it in `withReading` answer "not live on this
 * network yet". The shapes stay, because the whole quote and size math is built on them: C4 fills `SeriesFacts` and
 * `VenueFacts` from the venue's `Series` / `VenueAccount` contracts and `MarketData` from `MarketTerms` + `Resolution`.
 */
import type { BookSideView } from "@agari/core/market";
import type { TickerSymbol } from "@agari/core/market";
import type { Address } from "@agari/core/types";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";

const NOT_LIVE = cantonNotLive("runtime");

export interface VenueFacts {
  /** The venue's id as the app keys it. */
  config: Address;
  /** The venue cash instrument's id (the reference's collateral mint). */
  collateralMint: Address;
  decimals: number;
  treasury: Address;
  /** 0 Normal, 1 ReduceOnly, 2 Halted (the reference's `GlobalConfig.mode`; on Canton the venue's issuer policy). */
  mode: 0 | 1 | 2;
  /** Seats that trade and are not people (the reference's program seats: the pooled vault's, the maker's). */
  programSeats: Address[];
}

export interface SeriesFacts {
  address: Address;
  /** Null for a ticker outside the core registry. */
  symbol: TickerSymbol | null;
  basis: number;
  cadenceSec: number;
  lotBase: bigint;
  tickBase: bigint;
  cashUnit: bigint;
  minLots: bigint;
  /** Always 0 on Canton: a seat posts no bond (plan "Adapter mapping", `./runtime`). */
  seatBond: bigint;
  fillsCap: number;
  evictionsCap: number;
  minRestSlots: bigint;
  /** `Source` of each policy version's primary and check (0 none, 1 Pyth, 2 RedStone, 3 Switchboard, 4 attested). */
  policySources: readonly { primary: number; check: number }[];
}

/** One Window's terms and state, the fields the order lane and the read port use. */
export interface MarketData {
  series: Address;
  book: Address;
  ledger: Address;
  index: bigint;
  /** 0 open, 1 resolved, 2 voided (`MARKET_STATE`). */
  state: number;
  tradingStartSec: bigint;
  lockAtSec: bigint;
  expirySec: bigint;
  backingLots: bigint;
  payoutYes: number;
  payoutNo: number;
}

/**
 * One side-pair of the venue's published price ladder, walkable by core's book math. On Canton it is built from the
 * venue ladder (C4), not decoded from an account.
 */
export interface BookState {
  address: Address;
  /** The Window the ladder is bound to; a caller keyed on another Window reads it empty. */
  market: Address;
  series: Address;
  bids: BookSideView;
  asks: BookSideView;
  /** The rested-order filter's clock (kept for the shared kernel; a published ladder has no resting age). */
  slot: bigint;
  generation: number;
  orderCount: number;
}

/** A user's position in one Window (the reference's Ledger seat). */
export interface LedgerSeat {
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
}

/** `Seat.flags` bits. */
export const SEAT_FLAG = { program: 1, bonded: 2 } as const;

const notLive = <T>(): Promise<T> => Promise.reject(notDeployedError(NOT_LIVE));

/** The venue's id. Not derivable before the venue exists on a participant. */
export function eventsProgramAddress(): Address {
  throw notDeployedError(NOT_LIVE);
}

export const configAddress = (): Promise<Address> => notLive();
export const readVenue = (): Promise<VenueFacts> => notLive();
/** The venue's immutable facts without a mode refresh. */
export const readVenueStatic = (): Promise<VenueFacts> => notLive();
export const readSeries = (_series: Address): Promise<SeriesFacts> => notLive();
/** Null when the Window doesn't exist. */
export const readMarket = (_market: Address): Promise<{ address: Address; data: MarketData } | null> => notLive();
/** Null = the Window's positions are closed; `seat` null = the owner holds nothing there. */
export const readSeat = (_ledger: Address, _owner: Address): Promise<{ seat: LedgerSeat | null; seatBond: bigint } | null> => notLive();
/** Null when the Window has no ladder. */
export const readBook = (_book: Address): Promise<BookState | null> => notLive();
/** `amountBase` null = the owner holds no venue cash yet. */
export const readTokenBalance = (_owner: Address, _mint: Address): Promise<{ ata: Address; amountBase: bigint | null }> => notLive();
