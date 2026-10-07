/**
 * The ticket reserves' parameters (C8c): one reserve per product, as the reference keeps them (range, parlay, boost),
 * each a `PM.Reserve` statement with its own `RiskBook`. Pricing stays here, off the ledger (K-029: the ledger only
 * bounds a quote); the ledger's own caps (`RiskParams`) are derived from the same numbers, so the book refuses what
 * the pricer would never quote.
 *
 * All amounts are base units of demo credits (6 decimals, as `CASH_DECIMALS`).
 */
import type { LeverageParams } from "@owarine/core/leverage";
import type { ParlayParams } from "@owarine/core/parlay";
import type { RangeParams } from "@owarine/core/range";

export const TICKET_RESERVES = ["range", "parlay", "boost"] as const;
export type TicketReserveId = (typeof TICKET_RESERVES)[number];
export const isTicketReserve = (v: unknown): v is TicketReserveId => typeof v === "string" && (TICKET_RESERVES as readonly string[]).includes(v);
/** Every reserve a provider supplies through Earn: the ticket reserves and the maker vault (abu-pm-main 0.5.0, K-200). */
export const EARN_RESERVES = [...TICKET_RESERVES, "maker"] as const;
export type EarnReserveId = (typeof EARN_RESERVES)[number];
export const isEarnReserve = (v: unknown): v is EarnReserveId => typeof v === "string" && (EARN_RESERVES as readonly string[]).includes(v);

/** Collateral decimals and one whole unit (1 credit, 1 contract's payout). */
export const TICKET_DECIMALS = 6;
export const TICKET_ONE = 1_000_000n;
const C = TICKET_ONE;

/** The house σ per √second (× 1e8) the range reserve prices on, per symbol; a lane without its own uses the default. */
export const SIGMA_E8: Readonly<Record<string, bigint>> = { BTC: 9_000n, ETH: 12_000n };
export const DEFAULT_SIGMA_E8 = 10_000n;
export const sigmaFor = (symbol: string): bigint => SIGMA_E8[symbol] ?? DEFAULT_SIGMA_E8;

/**
 * Seconds a ticket quote stays firm (the venue quote's 20 s). A ticket's quote must also expire before its Window
 * locks (the ledger's `validUntil <= lockAt`), so the pricers refuse once fewer than `minTimeLeftSec` remain.
 */
export const TICKET_QUOTE_LIFE_SEC = 20;

export function rangeParams(): RangeParams {
  return {
    marginBps: 1_200,
    maxExposureBps: 6_000,
    minCenterQE6: 30_000,
    maxCenterQE6: 970_000,
    minProbRaw: 20_000n,
    maxProbRaw: 970_000n,
    minTimeLeftSec: 25,
    maxHorizonSec: 172_800,
    staleAfterSec: 21_600,
    maxPayoutCapBase: 500n * C,
    sigmaE8: DEFAULT_SIGMA_E8,
    maxExpiryLockedBase: 2_000n * C,
  };
}

export function parlayParams(): ParlayParams {
  return {
    marginBps: 1_500,
    maxExposureBps: 6_000,
    correlationBps: 5_000,
    maxLegs: 3,
    maxPayoutCapBase: 500n * C,
    maxExpiryLockedBase: 2_000n * C,
    minCombinedProbRaw: 10_000n,
    priceDepthRaw: 10n * C,
    maxSpreadTicks: 0,
    minRestSlots: 0,
    minTimeLeftSec: 25,
  };
}

export function leverageParams(): LeverageParams {
  return {
    maxLeverageBps: 30_000,
    premiumBps: 200,
    maintenanceBps: 11_000,
    maxExposureBps: 6_000,
    minEntryPriceRaw: 50_000n,
    maxEntryPriceRaw: 950_000n,
    maxFrontedPerPositionBase: 300n * C,
    maxWindowFrontedBase: 2_000n * C,
    maxOpenPositions: 200,
    minTimeLeftSec: 25,
  };
}

/** The ledger's `RiskParams` for a reserve: the same caps the pricer applies, so neither side is looser. */
export function riskParamsFor(reserve: TicketReserveId): { maxExposureBps: number; maxPerTicket: bigint; maxPerExpiry: bigint; maxLeverageBps: number } {
  if (reserve === "range") {
    const p = rangeParams();
    return { maxExposureBps: p.maxExposureBps, maxPerTicket: p.maxPayoutCapBase, maxPerExpiry: p.maxExpiryLockedBase, maxLeverageBps: 10_000 };
  }
  if (reserve === "parlay") {
    const p = parlayParams();
    return { maxExposureBps: p.maxExposureBps, maxPerTicket: p.maxPayoutCapBase, maxPerExpiry: p.maxExpiryLockedBase, maxLeverageBps: 10_000 };
  }
  const p = leverageParams();
  return { maxExposureBps: p.maxExposureBps, maxPerTicket: p.maxFrontedPerPositionBase, maxPerExpiry: p.maxWindowFrontedBase, maxLeverageBps: p.maxLeverageBps };
}

export const productOf = (reserve: TicketReserveId) => ({ range: "RangeProduct", parlay: "ParlayProduct", boost: "BoostProduct" } as const)[reserve];
