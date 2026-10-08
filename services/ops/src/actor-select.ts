/**
 * Which ops actors this process runs, from `OPS_ACTORS` (moved out of main.ts so it can be tested).
 *
 * Canton (C3): "venue" runs the roller, resolver, pricer, issuer, sweeper, rebalancer, netting, settler, seat funding and
 * drain, and the reserve reporter; "relay" runs the three oracle feeders; "projector" replaces the Solana indexer.
 * C9b: the duel room (with its matchmaker) is a venue actor; the duel settler runs inside "venue" (the arena desk) and
 * the duel projection inside "projector". The room idles, saying why, without `ROOM_TOKEN_SECRET`.
 */
export const VENUE_ACTORS = ["relay", "venue", "projector", "http", "halts", "earnings", "push-clock", "game-room"] as const;
export const LEGACY_ACTORS = ["strategy-runner", "x-relay", "leverage-keeper"] as const;
/** Opt-in actors that never ride on `all`: the desk trades real PreStocks on mainnet and is named on purpose (S21, D-126);
 * the Canton Coin rail (C7b) moves real value through the token standard and stays off until DevNet proves it (`not-live`). */
export const OPT_IN_ACTORS = ["desk-runner", "cc-rail"] as const;

const NAMED = new Set<string>([...OPT_IN_ACTORS, ...LEGACY_ACTORS]);

/**
 * Empty: the venue set. "all": the venue and the legacy actors, plus any opt-in actor named beside it. "default": the
 * venue set plus any opt-in OR legacy actor named beside it — "default,x-relay" used to drop the relay without a word
 * (integration review, 8 Oct). Otherwise exactly the names given.
 */
export function selectedActors(raw: string | undefined): Set<string> {
  const names = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return new Set(VENUE_ACTORS);
  if (names.includes("all")) return new Set([...VENUE_ACTORS, ...LEGACY_ACTORS, ...names.filter((n) => n !== "all" && (OPT_IN_ACTORS as readonly string[]).includes(n))]);
  if (names.includes("default")) return new Set([...VENUE_ACTORS, ...names.filter((n) => n !== "default" && NAMED.has(n))]);
  return new Set(names);
}
