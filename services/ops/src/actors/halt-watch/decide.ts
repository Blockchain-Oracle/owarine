/**
 * halt-watch's pure step (session-lanes.md §3.1): what each asset's sources say now, then the confirmed board after
 * this observation. A lane is judged on the signed price it settles on (C6f): `primary` names that source for each
 * asset, and only its health counts. Stock lanes are watched in regular hours only; outside them every stock halt clears
 * at once. The 24/7 lanes (an xStock, a pre-IPO name, a basket) trade every hour, so their reads always count. The token
 * lane (an xStock) is halted by the issuer's flag and by Jupiter quote failures, whatever else its source does.
 */
import {
  confirmHalt,
  HALT_ASSETS,
  haltWatchOf,
  sourceHaltReason,
  tokenHaltReason,
  XSTOCK_SYMBOLS,
  type AttestedSource,
  type HaltAsset,
  type HaltStreak,
  type PythTick,
  type TickerSymbol,
  type XStockSymbol,
} from "@owarine/core/market";
import type { HaltReason } from "@owarine/core/types";

export interface Observations {
  nowSec: number;
  /** Stock lanes are watched (regular hours, after the boot grace). */
  inRegularHours: boolean;
  /** Pre-IPO and basket lanes are watched (this process reads the PreStocks catalogue, after the boot grace). */
  watchingPrestocks: boolean;
  /** Each asset's primary source now (its lane's newest valid version); absent or null = no signed source. */
  primary: Partial<Record<HaltAsset, AttestedSource | null>>;
  /** The newest Pyth tick seen per ticker (kept across failed reads, so a gap in reads ages it honestly). Read only for a lane whose primary is Pyth. */
  pyth: Partial<Record<TickerSymbol, PythTick>>;
  /** The newest RedStone package time per ticker. */
  redstoneNewestSec: Partial<Record<TickerSymbol, number>>;
  /** The newest Alpaca IEX trade time per ticker (QQQ, VOO). */
  alpacaNewestSec: Partial<Record<TickerSymbol, number>>;
  /** The newest PreStocks read that priced each pre-IPO name, or every member of each basket. */
  prestocksNewestSec: Partial<Record<TickerSymbol, number>>;
  /** The xStocks `isMarketTradingHalted` flag; absent = not read yet. */
  issuer: Partial<Record<XStockSymbol, boolean>>;
  /** Consecutive failed Jupiter quotes per xStock. */
  quoteFailures: Partial<Record<XStockSymbol, number>>;
}

export type ObservedHalts = Record<HaltAsset, HaltReason | null>;

/** The Hermes feeds worth reading now: those of the lanes whose primary is Pyth. None today, so halt-watch makes no Pyth call. */
export function pythFeedsToRead<F extends { symbol: TickerSymbol }>(feeds: readonly F[], primary: Observations["primary"]): F[] {
  return feeds.filter((feed) => primary[feed.symbol] === "pyth");
}

export function observeHalts(o: Observations): ObservedHalts {
  const out = Object.fromEntries(HALT_ASSETS.map((asset) => [asset, null])) as ObservedHalts;
  for (const asset of HALT_ASSETS) {
    const primary = o.primary[asset] ?? null;
    const watch = haltWatchOf(asset);
    if (watch === "session") {
      if (!o.inRegularHours) continue;
      const ticker = asset as TickerSymbol;
      out[asset] = sourceHaltReason(primary, { pyth: o.pyth[ticker] ?? null, redstoneNewestSec: o.redstoneNewestSec[ticker] ?? null, alpacaNewestSec: o.alpacaNewestSec[ticker] ?? null, prestocksNewestSec: null }, o.nowSec);
    } else if (isXStock(asset)) {
      // Jupiter's failed quotes only count while the lane settles on Jupiter (the failure streak is its poll's).
      out[asset] = tokenHaltReason(o.issuer[asset] ?? null, primary === "jupiter" ? (o.quoteFailures[asset] ?? 0) : 0);
    } else if (o.watchingPrestocks) {
      const ticker = asset as TickerSymbol;
      out[asset] = sourceHaltReason(primary, { pyth: null, redstoneNewestSec: null, alpacaNewestSec: null, prestocksNewestSec: o.prestocksNewestSec[ticker] ?? null }, o.nowSec);
    }
  }
  return out;
}

const isXStock = (asset: HaltAsset): asset is XStockSymbol => (XSTOCK_SYMBOLS as readonly string[]).includes(asset);

export interface HaltState {
  confirmed: Map<HaltAsset, HaltReason | null>;
  streaks: Map<HaltAsset, HaltStreak | null>;
}

export const emptyHaltState = (): HaltState => ({ confirmed: new Map(), streaks: new Map() });

/** Folds one observation into the state (mutated) and returns the confirmed reasons. */
export function stepHalts(state: HaltState, observed: ObservedHalts, inRegularHours: boolean): Map<HaltAsset, HaltReason | null> {
  for (const asset of HALT_ASSETS) {
    if (!inRegularHours && haltWatchOf(asset) === "session") {
      state.confirmed.set(asset, null);
      state.streaks.set(asset, null);
      continue;
    }
    const next = confirmHalt(state.confirmed.get(asset) ?? null, state.streaks.get(asset) ?? null, observed[asset]);
    state.confirmed.set(asset, next.confirmed);
    state.streaks.set(asset, next.streak);
  }
  return state.confirmed;
}
