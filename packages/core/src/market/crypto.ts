import type { Hash32 } from "../types/primitives";
import type { Ticker } from "./tickers";

/**
 * Crypto assets listed on Canton's cadence lanes. They trade around the clock, so like a pre-IPO
 * name they have no exchange session and list only on the 24/7 lane (`basis: "token"`, `isTokenOnlyKind`). The Canton
 * lane settles on the oracle parties' attested one-minute exchange candles (`printSource: "attested"`), so the row's
 * `pythFeedId` and `redstoneFeedId` stay null: ops' Pyth trial list, spot stream and halt watch key on those fields,
 * and a crypto id there would put these assets on the equity trial key's path.
 *
 * This module never imports `tickers.ts` at runtime (`tickers.ts` imports it); only types cross the other way.
 */

export const CRYPTO_SYMBOLS = ["BTC", "ETH", "SOL"] as const;
export type CryptoSymbol = (typeof CRYPTO_SYMBOLS)[number];
/**
 * The crypto lanes' cadences: the 2-minute short lane (it replaced the 1-minute demo lane, 7 Oct 2026), the
 * reference's 5 m, 15 m and 1 h, and Masayume's 4 h and 1 d. All 24/7, on the UTC clock.
 */
export const CRYPTO_CADENCES_SEC = [120, 300, 900, 3_600, 14_400, 86_400] as const;

/**
 * Staggered Series per cadence (anchor offsets, whole minutes): two Series on one lane, half a Window apart, keep a
 * quoted Window open at every moment — a Window is priced from ~T+14 s to its cut-off, so one Series alone leaves a gap
 * each Window (context/13-revamp/AVAILABILITY-LATENCY-2026-10-07.md). Unlisted cadences run one Series at phase 0.
 */
export const CRYPTO_PHASES_SEC: Readonly<Record<number, readonly number[]>> = { 120: [0, 60], 300: [0, 180] };

/** A Canton adaptation: 24/7 variance accrues every second of a 365-day year, not over 252 × 6.5 exchange hours. */
export const CALENDAR_YEAR_SEC = 365 * 86_400;

/**
 * Canton Coin, the network's own asset (revamp 2b). Coinbase does not list it and Kraken's API does not answer from the
 * venue's host, so it cannot settle on the three exchanges' candles: its Windows settle on RedStone's `CC` feed
 * (`attested:redstone:CC`, the stock lanes' path), which tracked Bybit's CC/USDT × Coinbase's USDT-USD within ~3 bps
 * when measured (7 Oct 2026). Its live spot, candles and day figures come from Bybit, the deepest CC book
 * (`services/ops/src/prices/bybit.ts`). It is a crypto ticker (24/7, the crypto shelf) outside `CRYPTO_SYMBOLS`, which
 * keeps meaning "settles on the exchange candles".
 */
export const CANTON_COIN = "CC" as const;
export type CantonCoinSymbol = typeof CANTON_COIN;

/** Every crypto asset the venue lists: the exchange-candle assets and Canton Coin. */
export const CRYPTO_ASSET_SYMBOLS = [...CRYPTO_SYMBOLS, CANTON_COIN] as const;
export type CryptoAssetSymbol = (typeof CRYPTO_ASSET_SYMBOLS)[number];

/** The crypto rows of the registry, in listing order (every one is 24/7, token lane only). */
export const CRYPTO_TICKERS: readonly CryptoAssetSymbol[] = CRYPTO_ASSET_SYMBOLS;

/**
 * Pyth `Crypto.<T>/USD` price feed ids, kept as a named cross-check source for the attested print (a receipt may name
 * it); wired into no feed list.
 */
export const CRYPTO_PYTH_FEEDS: Readonly<Record<CryptoSymbol, Hash32>> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

/** Series ids 940–943; the brand is the asset's own mark colour (`icons.css` gains the matching `--brand-*` in the UI lane). */
export const CRYPTO_ROWS: Readonly<Record<CryptoAssetSymbol, Ticker>> = {
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
  SOL: {
    symbol: "SOL", seriesId: 943, name: "Solana", kind: "crypto", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: null, basket: null, pythIndexFeedId: null, valuationOf: null,
    monogram: "S", brand: { slug: "solana", hex: "#9945FF" },
  },
  // RedStone carries `CC` (its settlement feed); the Canton brand kit's black under a typed monogram (no glyph vendored).
  CC: {
    symbol: "CC", seriesId: 942, name: "Canton Coin", kind: "crypto", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: "CC", launch: false,
    xstock: null, ondo: null, preIpo: null, basket: null, pythIndexFeedId: null, valuationOf: null,
    monogram: "C", brand: { slug: "canton", hex: "#030206" },
  },
};
