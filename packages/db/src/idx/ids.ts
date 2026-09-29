/**
 * The app's ids for ledger facts (plan, Architecture §2): the web validates a Window and a Series as base58 of 32 bytes
 * (`isAddress`), and Daml names them with text (`MarketTerms.marketId = "<seriesKey>:<index>"`, `Series.seriesKey`).
 * The projection keys both by base58(sha256(utf-8 text)) and keeps the text beside it (`market_key`, `series_key`).
 * Deterministic, so any lane (roller, issuer, web) derives the same id from the same Daml text.
 */
import { createHash } from "node:crypto";
import { encodeBase58 } from "@agari/core/types";

export function ledgerTextId(text: string): string {
  return encodeBase58(new Uint8Array(createHash("sha256").update(text, "utf8").digest()));
}

/** A Window's `MarketId` from `MarketTerms.marketId` (the Daml text `<seriesKey>:<index>`). */
export const marketIdOfKey = (marketKey: string): string => ledgerTextId(marketKey);

/** A Series' address-shaped id from `Series.seriesKey`. */
export const seriesIdOfKey = (seriesKey: string): string => ledgerTextId(seriesKey);
