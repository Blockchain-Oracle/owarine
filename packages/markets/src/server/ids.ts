import { encodeBase58, toAddress, type MarketId } from "@agari/core/types";
import { sha256 } from "@noble/hashes/sha2";

/**
 * The app's `MarketId` for a Daml market (plan §2): base58 of SHA-256 over a domain tag and the terms' `marketId`
 * (`<seriesKey>:<index>`), so it passes `isMarketId` like every other id the app keys on. Deterministic and one-way:
 * ops, the projector and these routes derive the same id from the same terms, and nobody needs a lookup table.
 */
export const MARKET_ID_DOMAIN = "agari/market-id/v1:";

const encoder = new TextEncoder();

export function appMarketId(damlMarketId: string): MarketId {
  if (damlMarketId.length === 0) throw new Error("empty Daml marketId");
  return toAddress(encodeBase58(sha256(encoder.encode(MARKET_ID_DOMAIN + damlMarketId)))) as MarketId;
}

/** A client journal id (a UUID) as the ledger `commandId` of one logical action: `<intent>:<uuid>`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SeatIntent = "accept" | "claim" | "refund";

export function isJournalId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function seatCommandId(intent: SeatIntent, journalId: string): string {
  if (!isJournalId(journalId)) throw new Error("journal id must be a UUID");
  return `${intent}:${journalId.toLowerCase()}`;
}
