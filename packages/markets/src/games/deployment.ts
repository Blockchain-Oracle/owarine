import type { ArenaDeployment } from "@agari/core/games";
import { seriesIdFromDaml } from "@agari/core/market";
import type { Address } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { cantonNotLive } from "../stub/not-deployed";
import { arenaSource } from "./source";

/** The reason the arena's not-live states give where no `ArenaTerms` is on the participant (bootstrap creates it). */
export const ARENA_NOT_LIVE = cantonNotLive("games");

/**
 * The arena on this participant, or null (every arena surface then renders its not-live state). `gameArena` keeps the
 * reference's name and holds the arena's address-shaped id, derived from its `arenaId`; `fromBlock` is 0 because the
 * duel projection rides the main projector's stream from its own cursor.
 */
export async function resolveArenaDeployment(_env?: Partial<MarketsEnv>): Promise<ArenaDeployment | null> {
  const state = await arenaSource().state();
  if (!state.ok || !state.value.deployed) return null;
  return { chainId: state.value.chainId, gameArena: state.value.address, fromBlock: 0n };
}

/**
 * The season pool's address-shaped id. There is no vault account on Canton: the pool is a `SeasonPool` contract whose
 * balance is its own field, so this is a stable derived id a page can key on.
 */
export async function seasonVaultAddress(season: Address): Promise<Address> {
  return seriesIdFromDaml(`agari-season:${season}`);
}
