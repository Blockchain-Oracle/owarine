/**
 * The spot a local run quotes from (`scripts/drive/ops-local.ts`, C4c). It had only the crypto feed, so every stock
 * Window's pricer said "no fresh spot" and Lucky, which draws stock names in session (and OPENAI and the baskets all day,
 * `LUCKY_ASSETS`), could deal nothing on a local stack (C9d). With the Alpaca keys in the environment
 * (`ALPACA_KEY_ID`, `ALPACA_SECRET_KEY`, read from `services/ops/.env.local` by `load-env`), it now runs the same stock
 * feeds `main.ts` joins: the equity spot (RedStone, Alpaca for the tickers RedStone lacks, Pyth with a key) and the
 * PreStocks catalogue for the pre-IPO names and the baskets. Without the keys it stays crypto only, and says so. There
 * is no crypto stand-in for a stock: the reference has none.
 */
import { loadRelaySources } from "../actors/price-relay/sources";
import { alpacaKeys } from "../actors/price-relay";
import { createCryptoAssetSpotFeed } from "./bybit";
import { joinCryptoSpot } from "./crypto-spot";
import { createPreStocksSpotFeed, joinPreStocksSpot, type PreStocksSpotHandle } from "./prestocks-spot";
import type { SpotFeed } from "./spot";
import { createSpotFeed } from "./spot-feed";

type Log = (actor: string) => (why: string) => void;
interface Feed extends SpotFeed {
  start(): void;
  stop(): void;
}

/** The feeds a local run can start; a test hands in fakes. */
export interface LocalSpotMakers {
  crypto(log: (why: string) => void): Feed;
  equity(alpaca: NonNullable<ReturnType<typeof alpacaKeys>>, log: (why: string) => void): Feed;
  prestocks(log: (why: string) => void): PreStocksSpotHandle;
}

const REAL: LocalSpotMakers = {
  crypto: (log) => createCryptoAssetSpotFeed(log),
  equity: (alpaca, log) => createSpotFeed({ sources: loadRelaySources(), pythKey: process.env.PYTH_API_KEY || undefined, alpaca, log }),
  prestocks: (log) => createPreStocksSpotFeed({ log }),
};

export interface LocalSpot {
  spot: SpotFeed;
  /** The PreStocks feed when stocks run (for `/prestocks/latest`), else null. */
  prestocks: PreStocksSpotHandle | null;
  stocks: boolean;
  summary: string;
  stop(): void;
}

export function createLocalSpot(input: { log: Log; env?: NodeJS.ProcessEnv; make?: LocalSpotMakers }): LocalSpot {
  const make = input.make ?? REAL;
  const crypto = make.crypto(input.log("crypto-spot"));
  crypto.start();
  const alpaca = alpacaKeys(input.env ?? process.env);
  if (!alpaca) {
    return {
      spot: crypto, prestocks: null, stocks: false, stop: () => crypto.stop(),
      summary: "crypto spot only: ALPACA_KEY_ID / ALPACA_SECRET_KEY are not set, so stock, pre-IPO and basket Windows get no spot here",
    };
  }
  const equity = make.equity(alpaca, input.log("spot"));
  equity.start();
  const prestocks = make.prestocks(input.log("prestocks-spot"));
  prestocks.start();
  return {
    spot: joinPreStocksSpot(joinCryptoSpot(equity, crypto), prestocks),
    prestocks,
    stocks: true,
    stop: () => [crypto, equity, prestocks].forEach((feed) => feed.stop()),
    summary: "crypto, equity (RedStone, Alpaca) and PreStocks spot, as main.ts joins them",
  };
}
