/**
 * When the maker vault's book takes a quote (`MAKER_MODE=vault`). The reference's vault rests post-only quotes with
 * its providers' money inside `MakerParams`; on Canton the venue's issuer prices every quote off its ladder, and the
 * book is the counterparty for the ones that fall inside the vault's own bounds (`agari-maker` `maker_quote`'s guards):
 *
 *   lanes        the actor's assets and cadences (`MM_ASSETS`, `MM_INTERVALS`)
 *   band         the book's YES price inside [minPrice, maxPrice]
 *   spread       the ladder's quoted spread at least `minSpread` (a quote tighter than that is a gift)
 *   size         the quote's contracts at most `maxQuantity`
 *   time         at least `minTimeLeftSec` before the Window locks
 *   windows      a Window the book is not on yet only while it is on fewer than `maxOpenWindows`
 *   per Window   what the book has out on the Window plus this stake at most `maxWindowDeployedBase`
 *   exposure     everything out plus this stake at most `maxExposureBps` of the book's statement
 *   cash         a book shard covers the stake (the pool's lease; checked by the caller)
 *
 * Anything outside them is the venue desk's, exactly as before 0.5.0. Pure.
 */
import type { MakerParams } from "@agari/core/maker";

/** The reference's deployed defaults (`web/src/app/dev/earn/fixtures.ts` VAULT.params), in 6-decimal base units. */
export const DEFAULT_MAKER_PARAMS: MakerParams = {
  maxExposureBps: 6_000,
  minSpreadRaw: 20_000n,
  minPriceRaw: 50_000n,
  maxPriceRaw: 950_000n,
  maxQuantityRaw: 20_000_000n,
  maxWindowDeployedBase: 200_000_000n,
  maxOpenWindows: 8,
  minTimeLeftSec: 45,
};

/** One whole contract (a pair's payout) in base units: 1000 ticks × cashUnit per lot, cashUnit 1000 on the venue. */
const TICK_RAW = 1_000n;

export interface BookQuoteInput {
  params: MakerParams;
  /** Lanes the book quotes (upper-case assets; cadences in seconds); empty assets = every asset. */
  assets: readonly string[];
  intervals: readonly number[];
  asset: string;
  intervalSec: number;
  /** The user's side and price in ticks (1..999) as the ladder walked it. */
  side: "up" | "down";
  priceTicks: number;
  lots: bigint;
  cashUnit: bigint;
  /** The venue stake this quote locks. */
  stakeBase: bigint;
  /** The ladder's best Up and Down ticks: their sum less 1000 is the quoted spread. */
  bestUpTicks: number | null;
  bestDownTicks: number | null;
  lockAtSec: number;
  nowSec: number;
  /** The book on this Window and in all (the statement's rule), and its published assets. */
  windowDeployedBase: bigint;
  windowOpen: boolean;
  openWindows: number;
  deployedBase: bigint;
  assetsBase: bigint;
}

export type BookDecision = { take: true } | { take: false; why: string };

export function bookTakes(i: BookQuoteInput): BookDecision {
  const p = i.params;
  const no = (why: string): BookDecision => ({ take: false, why });
  if (i.assets.length > 0 && !i.assets.includes(i.asset.toUpperCase())) return no(`${i.asset} is not a maker lane`);
  if (!i.intervals.includes(i.intervalSec)) return no(`the maker does not quote ${i.intervalSec} s Windows`);
  // The book's YES price: selling Up at p is its ask at p; selling Down at p is its bid at 1000 − p.
  const yesRaw = BigInt(i.side === "up" ? i.priceTicks : 1000 - i.priceTicks) * TICK_RAW;
  if (yesRaw < p.minPriceRaw || yesRaw > p.maxPriceRaw) return no("price outside the vault's band");
  if (i.bestUpTicks === null || i.bestDownTicks === null) return no("a one-sided ladder has no spread");
  const spreadRaw = BigInt(i.bestUpTicks + i.bestDownTicks - 1000) * TICK_RAW;
  if (spreadRaw < p.minSpreadRaw) return no("spread tighter than the vault's minimum");
  if (i.lots * 1000n * i.cashUnit > p.maxQuantityRaw) return no("quote larger than the vault's per-quote cap");
  if (i.lockAtSec - i.nowSec < p.minTimeLeftSec) return no("too close to lock");
  if (!i.windowOpen && i.openWindows >= p.maxOpenWindows) return no("the vault is on its most Windows");
  if (i.windowDeployedBase + i.stakeBase > p.maxWindowDeployedBase) return no("the vault's per-Window cap");
  if ((i.deployedBase + i.stakeBase) * 10_000n > i.assetsBase * BigInt(p.maxExposureBps)) return no("the vault's exposure cap");
  return { take: true };
}
