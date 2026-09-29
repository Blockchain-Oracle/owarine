import type { ArenaDeployment } from "@agari/core/games";
import type { Address } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";

/** The reason every arena read and write states until the games package is on the participant (C9). */
export const ARENA_NOT_LIVE = cantonNotLive("games");

/** No arena package on the participant yet: null, so every arena surface renders its not-live state. */
export async function resolveArenaDeployment(_env?: Partial<MarketsEnv>): Promise<ArenaDeployment | null> {
  return null;
}

/** The season pool's escrow. There is no Solana vault PDA on Canton; the season's escrow arrives with `SeasonPool` (C9). */
export async function seasonVaultAddress(_season: Address): Promise<Address> {
  throw notDeployedError(ARENA_NOT_LIVE);
}
