/**
 * Duels and the season pool: `abu-pm-games` on Canton (C9). Commit-reveal stays (it proves deck fairness), so the
 * commitment hash is live; every ledger read and write answers not-live until the package is on the participant.
 */
export { deckCommitment, keccak256 } from "./commitment";
export { seasonVaultAddress } from "./deployment";
export {
  arenaHeadBlock, getArenaCredit, getArenaMatch, getArenaState, getSeasonPool, listArenaEvents, quoteArenaPick, readArenaAgent, resolveArenaDeployment,
  type ArenaMatchView, type ArenaState, type SeasonPoolState,
} from "./read";
export { submitArenaPickWrite, submitArenaTx, type ArenaPickOutcome } from "./write";
export { distributeSeasonPrizes, type DistributeSeasonInput } from "./admin-write";
