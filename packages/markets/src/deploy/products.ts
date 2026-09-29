/**
 * Per-product operator tooling (C1 stub): reserve and vault initialisation, seat registration and the drive scripts'
 * product steps. On Canton each product is a Daml package with its own money gate (C7–C9); until it is on a
 * participant every step here refuses as not live. Names are kept for `scripts/`; the reference's devnet parameters
 * stay as plain data because the Daml packages take the same numbers.
 */
import type { Address, Side } from "@agari/core/types";
import { deployNotLive } from "./send";

/** One refusal for every product step: nothing is read or sent. */
const notLive = async (..._args: unknown[]): Promise<never> => {
  throw deployNotLive();
};

const UNIT = 1_000_000n;

export const VAULT_AUTHORITY_INDEX = 0;
export const MAKER_AUTHORITY_INDEX = 1;
export const LEVERAGE_AUTHORITY_INDEX = 2;
export const PRIVATE_AUTHORITY_INDEX = 3;
export const ARENA_AUTHORITY_INDEX = 4;

export const DEVNET_ARENA_PARAMS = { joinWindowSec: 180, revealWindowSec: 120, pickWindowSec: 180, minDeckSize: 3, maxDeckSize: 5, minCardLifeSec: 240 };
export const DEVNET_ARENA_TIERS = [0n, 1n, 5n, 10n].map((pot) => ({ potBase: pot * UNIT, perCardCapBase: UNIT, enabled: true }));
export const DEVNET_PRIVATE_PARAMS = { minStakeBase: 1n * UNIT, maxStakeBase: 25n * UNIT, minTimeLeftSec: 60 };
export const DEVNET_MAKER_PARAMS = {
  maxExposureBps: 5_000, minSpreadTicks: 20, minPriceTicks: 50, maxPriceTicks: 950, maxQuantityLots: 5_000n,
  maxWindowDeployedBase: 50n * UNIT, maxOpenWindows: 12, minTimeLeftSec: 120,
};
export const DEVNET_LEVERAGE_PARAMS = {
  maxLeverageBps: 30_000, premiumBps: 800, maintenanceBps: 12_000, maxExposureBps: 6_000, maxOpenPositions: 64, minTimeLeftSec: 90,
  minEntryPriceRaw: 50_000n, maxEntryPriceRaw: 950_000n, maxFrontedPerPositionBase: 200n * UNIT, maxWindowFrontedBase: 500n * UNIT,
};
export const DEVNET_PARLAY_PARAMS = {
  marginBps: 1_200, maxExposureBps: 6_000, correlationBps: 4_000, maxSpreadTicks: 0, maxLegs: 3, minRestSlots: 50, minTimeLeftSec: 60,
  maxPayoutCapBase: 50n * UNIT, maxExpiryLockedBase: 100n * UNIT, minCombinedProbRaw: 10_000n, priceDepthRaw: 1n * UNIT,
};
export const DEVNET_RANGE_PARAMS = {
  marginBps: 1_200, maxExposureBps: 6_000, minCenterQE6: 30_000, maxCenterQE6: 970_000, minProbRaw: 20_000n, maxProbRaw: 970_000n,
  minTimeLeftSec: 60, maxHorizonSec: 172_800, staleAfterSec: 21_600, maxPayoutCapBase: 500n * UNIT, sigmaE8: 6_200n, maxExpiryLockedBase: 200n * UNIT,
};

export interface BoostSpec {
  marketId: Address;
  side: Side;
  stakeBase: bigint;
  leverageBps: number;
}

export interface DriveLeg {
  marketId: Address;
  isUp: boolean;
}

export interface QuoteInput {
  marketId: Address;
  bidTicks: number;
  askTicks: number;
  lots: bigint;
}

export interface OpenRangeInput {
  marketId: Address;
  /** Half-width of the band as a fraction of the opening print, in basis points. */
  widthBps: bigint;
  maxPayoutBase: bigint;
  isInside: boolean;
}

export type AuthoritiesChange = {
  vaultSeat: boolean;
  queue: Address | null;
  minOracles: number | null;
};

export type AuthoritiesPlan = {
  config: Address;
  treasury: Address;
  admin: Address;
  vaultSeat: Address;
  diffs: string[];
};

// Venue registration.
export const ensureSeries = notLive;
export const ensureBooks = notLive;
export const seriesAddress = notLive;
export const planAuthorities = notLive;
export const setAuthorities = notLive;
export const programDataAddress = notLive;
// Trading Balance vault.
export const initVault = notLive;
export const registerVaultSeat = notLive;
export const vaultAddresses = notLive;
// Private desk.
export const initPrivateDesk = notLive;
export const privateAddresses = notLive;
export const registerPrivateSeat = notLive;
export const depositAndAllowPrivate = notLive;
export const rawChargeAsPayer = notLive;
export const readPrivateBudget = notLive;
export const readPrivateDesk = notLive;
export const revokePrivate = notLive;
export const withdrawPrivate = notLive;
// Parlay.
export const initParlayReserve = notLive;
export const parlayAddresses = notLive;
export const openParlayTicket = notLive;
export const probeParlayLeg = notLive;
export const readParlayReserve = notLive;
export const settleParlayTicket = notLive;
export const supplyParlay = notLive;
export const ticketAddressOf = notLive;
export const voidStaleParlay = notLive;
// Strategy registry.
export const initStrategyRegistry = notLive;
export const strategyAddresses = notLive;
// Range and moonshot.
export const initRangeReserve = notLive;
export const rangeAddresses = notLive;
export const expiryBookAddressOf = notLive;
export const liveWindowFor = notLive;
export const markWindow = notLive;
export const probeWindow = notLive;
export const openRangeRound = notLive;
export const roundAddressOf = notLive;
export const settleRangeRound = notLive;
export const supplyRange = notLive;
// Owned drive windows.
export const openOwnedWindow = notLive;
export const ownedWindowOf = notLive;
export const quoteOwnedWindow = notLive;
export const closeOwnedWindow = notLive;
// Arena and season pool.
export const initArena = notLive;
export const arenaAddresses = notLive;
export const registerArenaSeat = notLive;
export const createSeasonPool = notLive;
export const depositSeasonPool = notLive;
export const withdrawSeasonRemainder = notLive;
// Leverage (Boost).
export const initLeverageReserve = notLive;
export const leverageAddresses = notLive;
export const registerLeverageSeat = notLive;
export const claimLeverage = notLive;
export const exitLeverage = notLive;
export const openLeverage = notLive;
export const probeLeverage = notLive;
export const readLeveragePosition = notLive;
export const readLeverageReserve = notLive;
export const supplyLeverage = notLive;
export const withdrawLeverage = notLive;
// Maker vault.
export const initMakerVault = notLive;
export const makerAddresses = notLive;
export const registerMakerSeat = notLive;
export const mergeMaker = notLive;
export const pullMaker = notLive;
export const quoteMaker = notLive;
export const settleMaker = notLive;
export const supplyMaker = notLive;
export const withdrawMaker = notLive;
export const windowBookOf = notLive;
