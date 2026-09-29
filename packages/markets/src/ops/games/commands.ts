/**
 * Ledger commands for `abu-pm-games`, one builder per choice. The venue's (bootstrap, reveal, lock, score, finalize,
 * refunds, the season pool) are what ops submits; the players' (open, join, record a pick, cancel) are what the web's
 * server half submits as the leased seat's party only. Same Daml-LF JSON encoding as `../canton/commands.ts`.
 */
import { GAMES_TEMPLATE_IDS } from "@agari/daml";
import { assertCommandId, toDamlInt, type Command, type ContractId, type Party } from "@agari/ledger";
import { isoOfSec } from "../canton/decode";
import { digest } from "../canton/ids";
import type { ArenaParamsC, TierC } from "./decode";

const G = GAMES_TEMPLATE_IDS;
const exercise = (templateId: string, contractId: ContractId, choice: string, choiceArgument: unknown): Command => ({
  ExerciseCommand: { templateId, contractId, choice, choiceArgument },
});
const create = (templateId: string, createArguments: unknown): Command => ({ CreateCommand: { templateId, createArguments } });
const int = (v: bigint | number) => toDamlInt(BigInt(v));

/** The tag a duel pick's leg carries in `beneficiaryRef` (`PM.Games.Arena.duelRef`). */
export const duelRef = (arenaId: string, matchId: string): string => `duel:${arenaId}:${matchId}`;

const tier = (t: TierC) => ({ tierId: t.tierId, potEach: int(t.potEach), perCardCap: int(t.perCardCap), ranked: t.ranked, enabled: t.enabled });
const params = (p: ArenaParamsC) => ({
  joinWindowSec: int(p.joinWindowSec), revealWindowSec: int(p.revealWindowSec), pickWindowSec: int(p.pickWindowSec),
  minDeckSize: int(p.minDeckSize), maxDeckSize: int(p.maxDeckSize),
});

// ---- the arena (venue) ----------------------------------------------------------------------------------

export const createArenaTerms = (o: { venue: Party; arenaId: string; policyVersion: number; params: ArenaParamsC; tiers: readonly TierC[] }): Command =>
  create(G.ArenaTerms, { venue: o.venue, arenaId: o.arenaId, policyVersion: int(o.policyVersion), params: params(o.params), tiers: o.tiers.map(tier) });

export const updateArena = (arenaCid: ContractId, p: ArenaParamsC, tiers: readonly TierC[]): Command =>
  exercise(G.ArenaTerms, arenaCid, "Arena_Update", { newParams: params(p), newTiers: tiers.map(tier) });

// ---- the players (seat) -----------------------------------------------------------------------------------

export interface OpenDuelInput {
  creator: Party;
  challenger: Party;
  matchId: string;
  tierId: string;
  /** 64 lowercase hex, no `0x` (`PM.Games.Deck.isCommitment`). */
  deckHash: string;
  deckSize: number;
  clientSeeds: readonly string[];
  joinDeadlineSec: number;
  cash: readonly ContractId[];
}

export const openDuel = (arenaCid: ContractId, o: OpenDuelInput): Command =>
  exercise(G.ArenaTerms, arenaCid, "Arena_OpenDuel", {
    creator: o.creator, challenger: o.challenger, matchId: o.matchId, tierId: o.tierId, deckHash: o.deckHash, deckSize: int(o.deckSize),
    clientSeeds: [...o.clientSeeds], joinDeadline: isoOfSec(o.joinDeadlineSec), cash: [...o.cash],
  });

export const joinDuel = (openCid: ContractId, cash: readonly ContractId[], revealDeadlineSec: number): Command =>
  exercise(G.DuelOpen, openCid, "Open_Join", { cash: [...cash], revealDeadline: isoOfSec(revealDeadlineSec) });

export const cancelDuel = (openCid: ContractId): Command => exercise(G.DuelOpen, openCid, "Open_Cancel", {});

export const refundUnjoined = (openCid: ContractId, actor: Party): Command => exercise(G.DuelOpen, openCid, "Open_RefundUnjoined", { actor });

export const recordPick = (matchCid: ContractId, player: Party, cardIndex: number, legCid: ContractId): Command =>
  exercise(G.DuelMatch, matchCid, "Duel_RecordPick", { player, cardIndex: int(cardIndex), legCid });

// ---- the match (venue, or any named player) -----------------------------------------------------------------

export const revealDuel = (matchCid: ContractId, o: { actor: Party; seed: string; cardCids: readonly ContractId[]; newPickDeadlineSec: number }): Command =>
  exercise(G.DuelMatch, matchCid, "Duel_Reveal", { actor: o.actor, seed: o.seed, cardCids: [...o.cardCids], newPickDeadline: isoOfSec(o.newPickDeadlineSec) });

export const lockDuel = (matchCid: ContractId, actor: Party): Command => exercise(G.DuelMatch, matchCid, "Duel_Lock", { actor });

export interface ScoreItemInput {
  seat: 0 | 1;
  cardIndex: number;
  resolutionCid: ContractId;
}

export const scoreDuel = (matchCid: ContractId, actor: Party, items: readonly ScoreItemInput[]): Command =>
  exercise(G.DuelMatch, matchCid, "Duel_Score", { actor, items: items.map((i) => ({ seat: int(i.seat), cardIndex: int(i.cardIndex), resolutionCid: i.resolutionCid })) });

export const finalizeDuel = (matchCid: ContractId, actor: Party): Command => exercise(G.DuelMatch, matchCid, "Duel_Finalize", { actor });

export const refundUnrevealed = (matchCid: ContractId, actor: Party): Command => exercise(G.DuelMatch, matchCid, "Duel_RefundUnrevealed", { actor });

export const refundStale = (matchCid: ContractId, actor: Party): Command => exercise(G.DuelMatch, matchCid, "Duel_RefundStale", { actor });

// ---- the season pool (venue) ------------------------------------------------------------------------------------

export const createSeasonPool = (o: { venue: Party; seasonId: string; endsAtSec: number }): Command =>
  create(G.SeasonPool, { venue: o.venue, seasonId: o.seasonId, endsAt: isoOfSec(o.endsAtSec), amount: int(0), deposited: int(0), distributed: false });

export const fundSeason = (poolCid: ContractId, cash: readonly ContractId[]): Command => exercise(G.SeasonPool, poolCid, "Season_Fund", { cash: [...cash] });

export const distributeSeason = (poolCid: ContractId, payouts: readonly { account: ContractId; amount: bigint }[]): Command =>
  exercise(G.SeasonPool, poolCid, "Season_Distribute", { payouts: payouts.map((p) => ({ account: p.account, amount: int(p.amount) })) });

export const withdrawSeasonRemainder = (poolCid: ContractId): Command => exercise(G.SeasonPool, poolCid, "Season_WithdrawRemainder", {});

// ---- command ids ------------------------------------------------------------------------------------------------

/**
 * `duel:<step>:<digest>`: stable per logical venue action on one match, so a crash-retry is deduplicated by the
 * participant. The digest takes the match id and whatever makes the step unique (a card, a deadline).
 */
export const duelCommandId = (step: "reveal" | "lock" | "score" | "finalize" | "refund-unjoined" | "refund-unrevealed" | "refund-stale", matchId: string, ...extra: readonly string[]) =>
  assertCommandId(`duel:${step}:${digest(matchId, ...extra)}`);

/** `season:<step>:<digest>`: one pool's creation, funding, distribution and withdrawal. */
export const seasonCommandId = (step: "create" | "fund" | "distribute" | "withdraw", seasonId: string, ...extra: readonly string[]) =>
  assertCommandId(`season:${step}:${digest(seasonId, ...extra)}`);
