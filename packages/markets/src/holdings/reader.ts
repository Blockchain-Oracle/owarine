/**
 * The holdings read: one owner's verified tokenised share holdings, read-only, sized in integers. The reference read a
 * Solana wallet's mainnet Token-2022 accounts through Helius; a Canton seat holds none. Until C7b reads CIP-56 holdings
 * of Canton-native assets, `readHoldings` answers with an honest read error (never an empty list, which would read as
 * "you hold nothing"). The wire shapes are kept for `/api/holdings` and the cover cards. Server-only.
 */
import type { Cluster } from "@agari/core/constants";
import type { ShareToken, TickerSymbol } from "@agari/core/market";
import { cantonNotLive } from "../stub/not-deployed";

export interface Holding {
  mint: string;
  symbol: ShareToken["symbol"];
  issuer: ShareToken["issuer"];
  underlying: TickerSymbol;
  /** Integers as decimal strings: the wire carries no bigint. */
  rawAmount: string;
  decimals: number;
  multiplierE12: string;
  sharesE8: string;
  /** The newest quote for the token or its underlying, fresh or not; null when there is none. */
  priceE8: string | null;
  /** How old that quote was when read, in seconds; null without a quote. The exposure is sized only from a fresh one. */
  priceAgeSec: number | null;
  priceSource: string | null;
  pricedAs: string | null;
  exposureUsdE6: string | null;
}

export interface HoldingsBody {
  owner: string;
  cluster: Cluster;
  asOfSec: number;
  holdings: Holding[];
}

export interface HoldingsInput {
  owner: string;
  /** The holdings source URL (a secret when it carries a key). */
  rpcUrl: string;
  /** The ops HTTP base; null leaves every price and exposure null. */
  priceFeedUrl: string | null;
  nowSec: number;
}

/** A holdings failure with a message that never contains the source URL. */
export class HoldingsReadError extends Error {}

/** Not live on Canton until C7b (CIP-56 holdings): always a read error, never a fabricated or empty list. */
export async function readHoldings(_input: HoldingsInput): Promise<HoldingsBody> {
  throw new HoldingsReadError(cantonNotLive("holdings"));
}
