/**
 * Duels and the season pool (`abu-pm-games`, C9b), read through `./source`: our routes in a browser or on the phone,
 * the arena desk in ops. Every shape is the reference's: the screens, the room and the projection keep their types.
 */
import type { ArenaAgent, ArenaMatch, ArenaParams, ArenaPick, ArenaQuote, ArenaTier, Pick } from "@agari/core/games";
import { ok, type Reading } from "@agari/core/schemas";
import type { Address, Hash32, MarketId } from "@agari/core/types";
import { nowMs } from "../provider/clock";
import { freshQuoteStake, getMarket } from "../provider/reads";
import { absent } from "../stub/product";
import { arenaSource } from "./source";

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
export async function getArenaState(): Promise<Reading<ArenaState | null>> {
  const r = await arenaSource().state();
  if (!r.ok) return r.error.kind === "not-deployed" ? ok(null, nowMs()) : r;
  const s = r.value;
  if (!s.deployed) return ok(null, r.asOfMs);
  return ok(
    {
      address: s.address,
      params: s.params,
      tiers: s.tiers.map(({ tier, potBase, perCardCapBase, enabled }) => ({ tier, potBase, perCardCapBase, enabled })),
      paused: s.paused,
      escrowedBase: s.escrowedBase,
      // Canton pays a decided pot straight into each player's cash: there is no arena credit to hold or claim.
      creditedBase: 0n,
      agentEscrowBase: 0n,
      custodyBase: s.escrowedBase,
    },
    r.asOfMs,
  );
}

export async function getArenaMatch(matchId: Hash32): Promise<Reading<ArenaMatchView | null>> {
  const r = await arenaSource().match(matchId);
  if (!r.ok) return r;
  if (!r.value) return ok(null, r.asOfMs);
  const { match, cards, picks, creatorPnlBase, challengerPnlBase } = r.value;
  return ok({ match, cards, picks, creatorPnlBase, challengerPnlBase }, r.asOfMs);
}

/**
 * A pick's size for a stake, off the venue's live ladder (the same quote the order ticket shows). The firm quote the
 * pick accepts is issued server-side at send time and is never larger than the tier's per-card cap.
 */
export async function quoteArenaPick(marketId: MarketId, pick: Pick, stakeBase: bigint): Promise<Reading<ArenaQuote | null>> {
  const market = await getMarket(marketId);
  if (!market.ok) return market;
  if (!market.value) return ok(null, nowMs());
  const q = await freshQuoteStake({ marketId, poolAddress: market.value.poolAddress, decimals: market.value.decimals, intervalSec: market.value.intervalSec }, pick, stakeBase);
  if (!q.ok) return q;
  if (!q.value) return ok(null, q.asOfMs);
  return ok({ quantityRaw: q.value.contractsRaw, costRaw: q.value.expectedCostBase, limitYesRaw: q.value.limitPriceRaw, priceRaw: q.value.limitPriceRaw }, q.asOfMs);
}

/** Canton pays pots into cash at once, so nobody holds arena credit. */
export const getArenaCredit = (_wallet: Address): Promise<Reading<bigint>> => absent(0n);

/** No agent keys on Canton: the seat's own server acts for the seat, under its lease. */
export const readArenaAgent = (_matchId: Hash32, _player: Address): Promise<Reading<ArenaAgent | null>> => absent(null);

export async function getSeasonPool(seasonId?: string): Promise<Reading<SeasonPoolState | null>> {
  const r = await arenaSource().season(seasonId);
  if (!r.ok) return r.error.kind === "not-deployed" ? ok(null, nowMs()) : r;
  return ok(r.value, r.asOfMs);
}
