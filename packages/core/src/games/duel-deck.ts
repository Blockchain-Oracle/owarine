/**
 * The duel deck's commitment preimage on Canton: the exact text `PM.Games.Deck.deckPreimage` hashes with
 * `DA.Text.sha256` when a reveal is exercised on the ledger (`abu-pm-games`).
 *
 * The Solana arena hashed fixed 32-byte words with keccak (`deckCommitmentPreimage`, kept for Lucky's word layout).
 * The ledger has sha256 over UTF-8 text and no byte packing, so the Canton deck is a sequence of length-prefixed
 * fields with an explicit count before each list: no two different decks encode to the same text, even when an element
 * moves from the seeds to the cards.
 *
 *   field t  = <number of code points of t> ":" t ","
 *   preimage = field "abu-pm/duel-deck/v1" · field arenaId · field matchId · field policyVersion · field serverSeed
 *              · field |clientSeeds| · field each seed · field |cards| · field each card
 *
 * A card is the Window's Daml `marketId` (`<seriesKey>:<index>`, the text on `MarketTerms`), never the app's derived
 * base58 id and never a contract id (which does not exist yet when the deck is committed). Core carries no hash; the
 * markets package takes sha256 of this text, and `duel-deck.test.ts` there pins it to the Daml script's golden vector.
 */

export const DUEL_DECK_DOMAIN = "abu-pm/duel-deck/v1";

export interface DuelDeckInput {
  /** The `ArenaTerms.arenaId` the match is opened under. */
  arenaId: string;
  /** The match id exactly as it is written on the ledger (the room's `0x…` hash, as text). */
  matchId: string;
  policyVersion: number;
  serverSeed: string;
  /** Both players', in seat order. */
  clientSeeds: readonly string[];
  /** Daml market ids, in deck order. */
  cards: readonly string[];
}

/** Daml's `T.length` counts code points, which is what spreading a string counts in JS. */
const codePoints = (t: string): number => [...t].length;

/** One length-prefixed field. */
export function duelDeckField(t: string): string {
  return `${codePoints(t)}:${t},`;
}

/** The text `PM.Games.Deck.deckPreimage` builds for the same deck, byte for byte. */
export function duelDeckPreimage(input: DuelDeckInput): string {
  if (!Number.isInteger(input.policyVersion) || input.policyVersion < 0) throw new Error(`policy version must be a non-negative integer, got ${input.policyVersion}`);
  return [
    duelDeckField(DUEL_DECK_DOMAIN),
    duelDeckField(input.arenaId),
    duelDeckField(input.matchId),
    duelDeckField(String(input.policyVersion)),
    duelDeckField(input.serverSeed),
    duelDeckField(String(input.clientSeeds.length)),
    ...input.clientSeeds.map(duelDeckField),
    duelDeckField(String(input.cards.length)),
    ...input.cards.map(duelDeckField),
  ].join("");
}

/** A commitment as the ledger stores it: 64 lowercase hex characters, no `0x` (`PM.Games.Deck.isCommitment`). */
export function isDuelCommitment(h: unknown): h is string {
  return typeof h === "string" && /^[0-9a-f]{64}$/.test(h);
}

/** A `0x…` app hash ↔ the ledger's bare lowercase hex. */
export function toLedgerCommitment(hash: string): string {
  const bare = hash.replace(/^0x/i, "").toLowerCase();
  if (!isDuelCommitment(bare)) throw new Error(`not a 32-byte hex commitment: ${hash}`);
  return bare;
}
