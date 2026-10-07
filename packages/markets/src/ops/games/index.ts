/**
 * `@owarine/markets/ops/games`: the Canton surface of the duel arena and the season pool (`abu-pm-games`, C9). Server-only;
 * never re-exported from the package root. Decoders, choice builders and command ids for ops (the arena desk, the
 * settler, the duel projection) and for the web's seat half; the match → app view mapping lives in `./view`.
 */
export * as gcmd from "./commands";
export { duelCommandId, duelRef, seasonCommandId, type OpenDuelInput, type ScoreItemInput } from "./commands";
export * from "./decode";
export * from "./view";
