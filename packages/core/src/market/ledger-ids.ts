import { sha256 } from "@noble/hashes/sha2";
import { utf8ToBytes } from "@noble/hashes/utils";
import { encodeBase58 } from "../types/base58";
import { toMarketId, type MarketId } from "../types/ids";
import { toAddress, type Address } from "../types/primitives";

/**
 * The app's ids for Daml ledger text (plan, Architecture §2). The app keys Windows and Series by base58-of-32-bytes
 * (`isMarketId`, `isAddress`); Daml names them with text (`MarketTerms.marketId = "<seriesKey>:<index>"`,
 * `Series.seriesKey`). Each id is base58(sha256(domain tag ‖ utf-8 text)): deterministic, one-way, and the same in ops,
 * the projector, the web routes and the phone, so nobody needs a lookup table. Pure (no `node:crypto`).
 */
export const MARKET_ID_DOMAIN = "agari/market-id/v1:";
export const SERIES_ID_DOMAIN = "agari/series-id/v1:";

const digest = (domain: string, text: string): string => encodeBase58(sha256(utf8ToBytes(domain + text)));

/** A Window's `MarketId` from `MarketTerms.marketId`. */
export function marketIdFromDaml(damlMarketId: string): MarketId {
  if (damlMarketId.length === 0) throw new Error("empty Daml marketId");
  return toMarketId(digest(MARKET_ID_DOMAIN, damlMarketId));
}

/** A Series' address-shaped id from `Series.seriesKey`. */
export function seriesIdFromDaml(seriesKey: string): Address {
  if (seriesKey.length === 0) throw new Error("empty Daml seriesKey");
  return toAddress(digest(SERIES_ID_DOMAIN, seriesKey));
}
