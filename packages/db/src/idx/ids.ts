/**
 * The projection's ids for ledger text: the canonical derivation in `@owarine/core/market` (`marketIdFromDaml`,
 * `seriesIdFromDaml`), which `@owarine/markets/server` `appMarketId` also uses, so `/api/index/*` rows carry the same
 * `MarketId` the seat routes return. The Daml text is kept beside it (`market_key`, `series_key`).
 */
import { marketIdFromDaml, seriesIdFromDaml } from "@owarine/core/market";

/** A Window's `MarketId` from `MarketTerms.marketId` (the Daml text `<seriesKey>:<index>`). */
export const marketIdOfKey = (marketKey: string): string => marketIdFromDaml(marketKey);

/** A Series' address-shaped id from `Series.seriesKey`. */
export const seriesIdOfKey = (seriesKey: string): string => seriesIdFromDaml(seriesKey);
