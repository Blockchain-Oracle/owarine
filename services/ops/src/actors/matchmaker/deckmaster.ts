import { randomBytes } from "node:crypto";
import { nextDealableSec, selectDeck, type ArenaParams, type DeckCandidate, type DeckCard, type DeckLane } from "@agari/core/games";
import type { Hash32, MarketId } from "@agari/core/types";
import { putDeck } from "@agari/db";
import { duelDeckHash, keccak256 } from "@agari/markets/games";
import { arenaAddressOf } from "@agari/markets/ops/games";
import { currentLadderBoard } from "../arena-desk";
import { DECK_KEY_ENV, deckKey, journal, seal, type RevealMaterial } from "./seal";

/**
 * Dealing a deck, and making its reveal durable before anyone can be asked to pay for it.
 *
 * The order here is the whole point. Cards are chosen, the material is written to disk and to Postgres,
 * and only then is a commitment handed back for a player to put on the ledger. A commitment published before
 * its preimage is durable is a match that can only refund, and the player who paid for it will have been
 * told a duel was about to start.
 *
 * On Canton (C9b) the commitment is `PM.Games.Deck.deckCommitment`: sha256 over a length-prefixed text preimage whose
 * cards are the Windows' Daml market ids, recomputed by `Duel_Reveal` on the ledger. The policy version is in it, so a
 * deck dealt under one set of rules can never claim another's guarantees, and it is bumped here, beside the rules it
 * names.
 */

/**
 * Bumped whenever the selection rules change. Version 3 (2026-09-03) is the owner-approved floor of two
 * cards, every eligible Window taken rather than one cadence preferred, and headroom sized against the
 * arena's own deadlines instead of a guessed margin.
 */
/** 4 since 2026-09-04: the headroom holds the arena's card-life floor for the whole pick window (rule D). 5 since
 * 2026-09-23 (S23): a card comes only from a Book quoting both sides, and no series is projected past its close. 6 since
 * 2026-09-29 (C9b): the commitment is the ledger's sha256 text preimage over Daml market ids, and a card must still
 * trade when the pick window closes (`Duel_Reveal`'s own rule). */
export const DECK_POLICY_VERSION = 6;

/** A duel should finish inside an hour: every card must settle within it, or the match outlives its players. */
const HORIZON_SEC = Number(process.env.GAME_DECK_HORIZON_SEC ?? 60 * 60);

/**
 * Time between dealing a deck and the creator's `createMatch` landing — human signing plus a block.
 *
 * It is a real term in the headroom budget, not a fudge: the arena's join and reveal windows are counted
 * from creation, so anything spent before creation is spent on top of them.
 */
const CREATE_LATENCY_SEC = Number(process.env.GAME_DECK_CREATE_LATENCY_SEC ?? 45);

export interface DealtDeck {
  cards: readonly DeckCard[];
  lane: DeckLane;
  deckHash: Hash32;
  policyVersion: number;
}

/**
 * `retry` separates "the venue has nothing open this minute" from "this deployment cannot deal decks".
 *
 * Measured on Shannon on 2026-09-03: the 5m, 15m and 1h Windows roll on aligned boundaries and lock
 * together, so for the last couple of minutes of every cycle the only trading Windows are the 4h and 1d
 * pair — outside a duel's horizon, and a deck is briefly impossible. That is a wait, not a failure, and
 * two players who have already been paired should not be thrown out of the queue for it.
 */
export type DealOutcome = { ok: true; deck: DealtDeck } | { ok: false; why: string; retry: boolean; nextDeckInSec?: number | null };

const bytes32 = (): Hash32 => `0x${randomBytes(32).toString("hex")}`;

/** A fresh match id. Random rather than derived: two players must not be able to predict one another's. */
export function newMatchId(): Hash32 {
  return bytes32();
}

/** The commitment a client publishes when it queues, and what the deckmaster checks its reveal against. */
export function seedCommitment(seed: Hash32): Hash32 {
  return keccak256(seed);
}

/**
 * Every Window the venue is quoting now, from this process's own price ladders (the pricer's board): the app's id for
 * selection, the Daml id for the commitment. A card is dealt only from a ladder quoting both Up and Down (S23): a deck
 * of one-sided Books fails its picks. Null when no pricer runs in this process.
 */
function candidates(): { pool: readonly DeckCandidate[]; damlIds: ReadonlyMap<MarketId, string> } | null {
  const board = currentLadderBoard();
  if (!board) return null;
  const nowSec = Math.floor(Date.now() / 1_000);
  const damlIds = new Map<MarketId, string>();
  const pool = board.all().filter((l) => l.state === "quoting").map((l): DeckCandidate => {
    damlIds.set(l.marketId as MarketId, l.damlMarketId);
    return {
      marketId: l.marketId as MarketId,
      asset: l.symbol,
      intervalSec: Math.max(1, l.expirySec - l.tradingStartSec),
      expirySec: l.expirySec,
      trading: nowSec >= l.tradingStartSec && nowSec < l.lockAtSec,
      tradingStartSec: l.tradingStartSec,
      spreadRaw: 0n,
      depthRaw: l.up.length > 0 && l.down.length > 0 ? 1n : 0n,
    };
  });
  return { pool, damlIds };
}

/**
 * Seconds until the venue can next supply a deck, 0 when it already can, or null when it is unreadable
 * or further out than the projection looks. The queue's countdown, and nothing else's.
 */
export async function deckSupply(params: DealInput["params"]): Promise<number | null> {
  const headroomSec = dealHeadroomSec(params);
  const pool = candidates()?.pool;
  if (!pool) return null;
  const nowSec = Math.floor(Date.now() / 1_000);
  const policy = {
    supportedAssets: [...new Set(pool.map((c) => c.asset))],
    maxSpreadRaw: 2n ** 128n,
    minDepthRaw: 1n,
    horizonSec: HORIZON_SEC,
    minHeadroomSec: headroomSec,
  };
  if (selectDeck(pool, policy, nowSec).ok) return 0;
  return nextDealableSec(pool, policy, nowSec);
}

export interface DealInput {
  matchId: Hash32;
  chainId: number;
  /** The `ArenaTerms.arenaId` the match will be opened under: part of the commitment. */
  arenaId: string;
  clientSeeds: readonly Hash32[];
  /** The arena's own deadlines. Headroom is derived from all four, never from `minCardLifeSec` alone. */
  params: Pick<ArenaParams, "minCardLifeSec" | "joinWindowSec" | "revealWindowSec" | "pickWindowSec">;
}

/**
 * How much life a card must have when the deck is DEALT.
 *
 * The arena checks `minCardLifeSec` at **reveal**, and a reveal may legally land after the whole join
 * window and the whole reveal window have elapsed since creation. So a deck sized only to
 * `minCardLifeSec` can be dealt on a Window that is perfectly legal now and dead by the time anyone can
 * open it — `revealDeck` reverts, nobody can open the deck, and the match refunds at its reveal
 * deadline. That is a silent bug in the happy path, because two players who sign in seconds never see
 * it; it appears exactly when one of them is slow, which is what those windows exist for.
 *
 * And the pick window is counted too (rule D, context/54 §5; the owner's decision of 2026-09-04): the
 * arena's floor is checked again at every pick, so a card revealed at exactly the floor is `TooLate`
 * long before a slow player's clock runs out. Holding the floor for the whole pick window costs deck
 * supply — measured 89.2% → 84.2% dealable on the live venue — and buys a rule that is true for every
 * second a player is allowed to swipe.
 */
export function dealHeadroomSec(params: DealInput["params"]): number {
  return params.minCardLifeSec + params.joinWindowSec + params.revealWindowSec + params.pickWindowSec + CREATE_LATENCY_SEC;
}

/**
 * Deals a deck for one match: choose, seal, persist, commit.
 *
 * Every failure returns a reason rather than throwing, because the caller's answer to all of them is the
 * same and it is a product decision: tell both players the queue could not deal, and put them back.
 */
export async function dealDeck(input: DealInput, onWarning?: (why: string) => void): Promise<DealOutcome> {
  const key = deckKey();
  if (!key) return { ok: false, why: `no ${DECK_KEY_ENV}, so a deck's reveal could not be kept`, retry: false };

  const headroomSec = dealHeadroomSec(input.params);
  const found = candidates();
  if (!found) return { ok: false, why: "no venue price ladders in this process (the pricer is off)", retry: true };
  const { pool, damlIds } = found;

  const nowSec = Math.floor(Date.now() / 1_000);
  const policy = {
    supportedAssets: [...new Set(pool.map((c) => c.asset))],
    maxSpreadRaw: 2n ** 128n,
    minDepthRaw: 1n,
    horizonSec: HORIZON_SEC,
    minHeadroomSec: headroomSec,
  };
  const selection = selectDeck(pool, policy, nowSec);
  if (!selection.ok) {
    // The count of live Windows rides along: "0 of 3" from an empty venue and "0 of 3" from a venue whose
    // Windows are all locked are different operational problems, and the log has to tell them apart.
    const trading = pool.filter((c) => c.trading).length;
    const inSec = nextDealableSec(pool, policy, nowSec);
    return {
      ok: false,
      retry: true,
      nextDeckInSec: inSec,
      why: `only ${selection.refusal.eligible} of ${selection.refusal.needed} Windows qualify (${trading} trading of ${pool.length} live, horizon ${HORIZON_SEC}s, headroom ${headroomSec}s)${inSec === null ? "" : `; the next deck is dealable in ${inSec}s`}`,
    };
  }

  // The commitment names the Windows as the ledger does: their Daml market ids, in deck order.
  const cards = selection.cards.map((card) => damlIds.get(card.marketId));
  if (cards.some((c) => !c)) return { ok: false, retry: true, why: "a dealt card has no Daml market id on the board" };
  const serverSeed = bytes32();
  const material: RevealMaterial = {
    matchId: input.matchId,
    serverSeed,
    clientSeeds: input.clientSeeds,
    cards: cards as string[],
    policyVersion: DECK_POLICY_VERSION,
  };
  const ledgerHash = duelDeckHash({ arenaId: input.arenaId, matchId: input.matchId, policyVersion: DECK_POLICY_VERSION, serverSeed, clientSeeds: input.clientSeeds, cards: material.cards });
  const deckHash = `0x${ledgerHash}` as Hash32;
  const sealed = seal(material, key);

  try {
    // The journal is the durable record and is written first; a failure here refuses the deal outright,
    // because a commitment whose preimage is not on disk is a match that can only ever refund.
    journal(input.matchId, sealed);
  } catch (error) {
    return { ok: false, retry: false, why: `the deck's reveal could not be written: ${error instanceof Error ? error.message : String(error)}` };
  }

  try {
    await putDeck({
      matchId: input.matchId,
      chainId: input.chainId,
      arena: arenaAddressOf(input.arenaId),
      policyVersion: DECK_POLICY_VERSION,
      lane: selection.lane,
      cards: selection.cards.map((card) => card.marketId),
      sealed,
    });
  } catch (error) {
    // The row is the queryable copy, not the durable one. Losing it costs a query, not a match — the
    // settler reads the journal when the database cannot answer.
    onWarning?.(`${input.matchId}: the deck row was not written (${error instanceof Error ? error.message : String(error)}); the journal has it`);
  }

  return { ok: true, deck: { cards: selection.cards, lane: selection.lane, deckHash, policyVersion: DECK_POLICY_VERSION } };
}
