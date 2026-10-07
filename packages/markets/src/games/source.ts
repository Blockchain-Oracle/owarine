/**
 * Where the arena's reads come from. The browser and the phone read our own routes (`/api/ledger/games/*`); a server
 * process with ledger access (ops, which runs the arena desk, and the web's server half through ops) registers a
 * source of its own at boot, so the room, the projector and the settler read the same `ArenaMatchView` the screens do
 * without an HTTP hop to themselves. One registry, so every export keeps the reference's name and shape.
 */
import { err, ok, type Reading } from "@owarine/core/schemas";
import type { Hash32 } from "@owarine/core/types";
import { ledgerRequest } from "../provider/ledger-api";
import { nowMs } from "../provider/clock";
import { arenaMatchViewWire, arenaStateWire, seasonPoolWire, type ArenaMatchViewReply, type ArenaStateReply, type SeasonPoolReply } from "../provider/games-wire";

export type ArenaMatchViewWire = NonNullable<ArenaMatchViewReply["view"]>;
export type SeasonPoolWire = NonNullable<SeasonPoolReply["pool"]>;

export interface ArenaSource {
  state(): Promise<Reading<ArenaStateReply>>;
  match(matchId: Hash32): Promise<Reading<ArenaMatchViewWire | null>>;
  season(seasonId?: string): Promise<Reading<SeasonPoolWire | null>>;
}

let registered: ArenaSource | null = null;

/** A server process's own source (ops' arena desk; the web server through ops). `null` restores the routes. */
export function registerArenaSource(source: ArenaSource | null): void {
  registered = source;
  stateCache = null;
}

const STATE_CACHE_MS = 3_000;
let stateCache: { atMs: number; value: Promise<Reading<ArenaStateReply>> } | null = null;

const routes: ArenaSource = {
  state() {
    if (stateCache && Date.now() - stateCache.atMs < STATE_CACHE_MS) return stateCache.value;
    const value = ledgerRequest("/games/state", { method: "GET", wire: arenaStateWire, seat: false }).then((r) => (r.ok ? ok(r.value, nowMs()) : err(r.diagnosis)));
    const entry = { atMs: Date.now(), value };
    stateCache = entry;
    value.then((r) => !r.ok && stateCache === entry && (stateCache = null)).catch(() => undefined);
    return value;
  },
  async match(matchId) {
    const r = await ledgerRequest(`/games/match/${matchId.toLowerCase()}`, { method: "GET", wire: arenaMatchViewWire, seat: false });
    return r.ok ? ok(r.value.view, nowMs()) : err(r.diagnosis);
  },
  async season(seasonId) {
    const r = await ledgerRequest("/games/season", { method: "GET", wire: seasonPoolWire, seat: false, ...(seasonId ? { query: { seasonId } } : {}) });
    return r.ok ? ok(r.value.pool, nowMs()) : err(r.diagnosis);
  },
};

export function arenaSource(): ArenaSource {
  return registered ?? routes;
}

/** After a write: the next state read goes to the source. */
export function forgetArenaReads(): void {
  stateCache = null;
}
