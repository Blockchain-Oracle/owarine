import { marketIdFromDaml, MARKET_ID_DOMAIN } from "@owarine/core/market";
import type { MarketId } from "@owarine/core/types";

/**
 * The app's `MarketId` for a Daml market (plan §2): base58 of SHA-256 over a domain tag and the terms' `marketId`
 * (`<seriesKey>:<index>`), so it passes `isMarketId` like every other id the app keys on. One canonical, pure
 * implementation lives in `@owarine/core/market` (`marketIdFromDaml`); ops, the projector, these routes and the phone
 * all derive the same id from the same terms.
 */
export { MARKET_ID_DOMAIN };

export function appMarketId(damlMarketId: string): MarketId {
  return marketIdFromDaml(damlMarketId);
}

/** A client journal id (a UUID) as the ledger `commandId` of one logical action: `<intent>:<uuid>`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `rest`: the seat places the venue's offer to hold a pre-open call; `rest-cancel`: it cancels its resting calls (C7c). `duel`: a seat's own choice on a duel (open, join, record a pick, a crank), C9b. `agent`: the seat's own grant,
 * registry and desk writes (C8f). `ccdeposit` and `ccwithdraw`: the seat's Canton Coin deposit instruction and withdrawal
 * request (C7b), two intents so one UUID cannot be answered as the other; `cctap`: the seat's DevNet coin tap (revamp 2b). */
export type SeatIntent = "accept" | "sell" | "claim" | "refund" | "duel" | "agent" | "rest" | "rest-cancel" | "ccdeposit" | "ccwithdraw" | "cctap" | "ccreceive";

export function isJournalId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function seatCommandId(intent: SeatIntent, journalId: string): string {
  if (!isJournalId(journalId)) throw new Error("journal id must be a UUID");
  return `${intent}:${journalId.toLowerCase()}`;
}
