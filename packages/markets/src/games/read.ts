/**
 * Duels and the season pool (`abu-pm-games`, C9). Until that package is on the participant every read answers
 * honestly: no arena (null), zero credit, and not-live for anything only the arena could compute (D-015).
 */
import type { ArenaAgent, ArenaMatch, ArenaParams, ArenaPick, ArenaQuote, ArenaTier, Pick } from "@agari/core/games";
import type { Reading } from "@agari/core/schemas";
import type { Address, Hash32, MarketId } from "@agari/core/types";
import { absent, unavailableFor } from "../stub/product";
import { ARENA_NOT_LIVE } from "./deployment";

export { arenaHeadBlock, listArenaEvents } from "./events";
export { resolveArenaDeployment } from "./deployment";

/** One match as the ledger holds it: the record, the revealed deck, both seats' picks and the running PnL. */
export interface ArenaMatchView {
  match: ArenaMatch;
  cards: readonly MarketId[];
  picks: readonly ArenaPick[];
  creatorPnlBase: bigint;
  challengerPnlBase: bigint;
}

/** The arena's tunables, its priced tiers and whether it is taking new matches. */
export interface ArenaState {
  address: Address;
  params: ArenaParams;
  tiers: readonly ArenaTier[];
  paused: boolean;
  escrowedBase: bigint;
  creditedBase: bigint;
  agentEscrowBase: bigint;
  custodyBase: bigint;
}

/** The season pool: what it escrows, what it was ever given, and whether it has paid. */
export interface SeasonPoolState {
  address: Address;
  seasonId: string;
  endsAtSec: number;
  admin: Address;
  balanceBase: bigint;
  depositedBase: bigint;
  distributed: boolean;
}

/** `null`, not an error, when there is no arena on this participant. */
export const getArenaState = (): Promise<Reading<ArenaState | null>> => absent(null);

export const getArenaMatch = (_matchId: Hash32): Promise<Reading<ArenaMatchView | null>> => absent(null);

/** A pick's price needs the arena and the venue ladder together. */
export const quoteArenaPick = (_marketId: MarketId, _pick: Pick, _stakeBase: bigint): Promise<Reading<ArenaQuote | null>> => unavailableFor(ARENA_NOT_LIVE);

/** No arena, so nobody holds arena credit. */
export const getArenaCredit = (_wallet: Address): Promise<Reading<bigint>> => absent(0n);

export const readArenaAgent = (_matchId: Hash32, _player: Address): Promise<Reading<ArenaAgent | null>> => absent(null);

export const getSeasonPool = (_seasonId?: string): Promise<Reading<SeasonPoolState | null>> => absent(null);
