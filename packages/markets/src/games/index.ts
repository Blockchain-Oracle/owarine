/**
 * Duels and the season pool: `abu-pm-games` on Canton (C9b). Commit-reveal stays (it proves deck fairness) and the
 * ledger checks the reveal with sha256; reads come from `./source` (our routes in a browser, the arena desk in ops),
 * writes go through the seat's own routes (`./write`).
 */
export { deckCommitment, duelDeckHash, keccak256, sha256Text } from "./commitment";
export { seasonVaultAddress } from "./deployment";
export {
  arenaHeadBlock, getArenaCredit, getArenaMatch, getArenaState, getSeasonPool, listArenaEvents, quoteArenaPick, readArenaAgent, resolveArenaDeployment,
  type ArenaMatchView, type ArenaState, type SeasonPoolState,
} from "./read";
export { submitArenaPickWrite, submitArenaTx, type ArenaPickOutcome } from "./write";
export { distributeSeasonPrizes, type DistributeSeasonInput } from "./admin-write";
export { arenaSource, forgetArenaReads, registerArenaSource, type ArenaMatchViewWire, type ArenaSource, type SeasonPoolWire } from "./source";
