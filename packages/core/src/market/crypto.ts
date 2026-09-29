import type { Hash32 } from "../types/primitives";
import type { Ticker } from "./tickers";

/**
 * Crypto assets: Masayume's BTC/ETH cadence lanes, carried onto Canton. They trade around the clock, so like a pre-IPO
 * name they have no exchange session and list only on the 24/7 lane (`basis: "token"`, `isTokenOnlyKind`). The Canton
 * lane settles on the oracle parties' attested one-minute exchange candles (`printSource: "attested"`), so the row's
 * `pythFeedId` and `redstoneFeedId` stay null: ops' Pyth trial list, spot stream and halt watch key on those fields,
 * and a crypto id there would put these assets on the equity trial key's path.
 *
 * This module never imports `tickers.ts` at runtime (`tickers.ts` imports it); only types cross the other way.
 */

export const CRYPTO_SYMBOLS = ["BTC", "ETH"] as const;
export type CryptoSymbol = (typeof CRYPTO_SYMBOLS)[number];
/**
 * The crypto lanes' cadences: the 1-minute demo lane (an Addition, C3), the reference's 5 m, 15 m and 1 h, and
 * Masayume's 4 h and 1 d (its DreamDEX BTC/ETH set was 1m/5m/15m/1h/4h/1d). All 24/7, on the UTC clock.
 */
export const CRYPTO_CADENCES_SEC = [60, 300, 900, 3_600, 14_400, 86_400] as const;

/** A Canton adaptation: 24/7 variance accrues every second of a 365-day year, not over 252 × 6.5 exchange hours. */
export const CALENDAR_YEAR_SEC = 365 * 86_400;

/** The crypto rows of the registry, in listing order (every one is 24/7, token lane only). */
export const CRYPTO_TICKERS: readonly CryptoSymbol[] = CRYPTO_SYMBOLS;

/**
 * Pyth `Crypto.<T>/USD` price feed ids, kept as a named cross-check source for the attested print (a receipt may name
 * it); wired into no feed list.
 */
export const CRYPTO_PYTH_FEEDS: Readonly<Record<CryptoSymbol, Hash32>> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
};

/** Series ids 940–941; the brand is the asset's own mark colour (`icons.css` gains the matching `--brand-*` in the UI lane). */
export const CRYPTO_ROWS: Readonly<Record<CryptoSymbol, Ticker>> = {
  BTC: {
    symbol: "BTC", seriesId: 940, name: "Bitcoin", kind: "crypto", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: null, basket: null, pythIndexFeedId: null, valuationOf: null,
    monogram: "B", brand: { slug: "bitcoin", hex: "#F7931A" },
  },
  ETH: {
    symbol: "ETH", seriesId: 941, name: "Ethereum", kind: "crypto", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: null, basket: null, pythIndexFeedId: null, valuationOf: null,
    monogram: "E", brand: { slug: "ethereum", hex: "#627EEA" },
  },
};
