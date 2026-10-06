import { CRYPTO_TICKERS } from "../market/crypto";
import { LAUNCH_TICKERS, type TickerSymbol } from "../market/tickers";

/**
 * The names the "Make your call" builder offers (web and phone): the launch stocks, then BTC and ETH, which the X
 * grammar accepts (`parse.ts`, C13a) and which trade around the clock on their own 24/7 lane (C9e). A builder that
 * offered only stocks left a visitor nothing to post while the stock market is shut.
 */
export const X_BUILDER_ASSETS: readonly TickerSymbol[] = [...LAUNCH_TICKERS, ...CRYPTO_TICKERS];
