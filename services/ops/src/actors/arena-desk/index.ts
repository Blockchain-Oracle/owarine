/**
 * The arena desk (C9b): the venue's side of `abu-pm-games` in one ops process.
 *
 *   reads      ArenaTerms, DuelOpen, DuelMatch, DuelResult, SeasonPool, Resolution, as the venue; registered as this
 *              process's `@owarine/markets/games` source, so the room, the matchmaker and the duel projection read the
 *              same `ArenaMatchView` the screens do
 *   routes     POST /internal/games/{state, match, season, open, season/distribute, season/withdraw} (`routes.ts`)
 *   settler    reveal · lock · score · finalize · the three refunds (`duel-settler`), one pass every few seconds
 *   deals      the matchmaker's sealed decks, held here until each creator's open lands
 *
 * Every seat's own choice (open, join, pick, cancel, a player's crank) goes through the web, as that seat's party.
 */
import { ok } from "@owarine/core/schemas";
import { getDb } from "@owarine/db";
import { registerArenaSource, type ArenaSource } from "@owarine/markets/games";
import { runActor } from "../../runtime/actor";
import { opsMarketsEnv } from "../../runtime/markets-env";
import type { LadderBoard } from "../market-maker/seat/ladder-board";
import type { VenueContext } from "../venue/context";
import { settlerPass } from "../duel-settler";
import { createArenaDesk, type ArenaDesk } from "./desk";
import { arenaRoutes } from "./routes";
import { createSeatDirectory } from "./seats";

type Handler = (body: unknown) => Promise<{ status: number; body: unknown }>;

export interface ArenaDeskHandle {
  desk: ArenaDesk;
  routes: Record<string, Handler>;
  stop: () => void;
}

let current: { desk: ArenaDesk; board: LadderBoard | null } | null = null;

/** The desk this process runs, for the matchmaker and the room (null where the games actor is off). */
export function currentArenaDesk(): ArenaDesk | null {
  return current?.desk ?? null;
}

/** The venue's live ladders, for the deckmaster's candidates (null where no pricer runs in this process). */
export function currentLadderBoard(): LadderBoard | null {
  return current?.board ?? null;
}

export async function startArenaDesk(input: { venue: VenueContext; board: LadderBoard | null; log: (why: string) => void; everyMs?: number }): Promise<ArenaDeskHandle | null> {
  const session = input.venue.session("venue");
  if (!session) {
    input.log("VENUE_PARTY and the parties file are missing: no arena desk");
    return null;
  }
  const seats = createSeatDirectory(getDb(), input.log);
  const desk = createArenaDesk({ venue: session, seats, chainId: opsMarketsEnv().chainId, log: input.log });
  const source: ArenaSource = {
    state: async () => ok(await desk.state(), Date.now()),
    match: async (matchId) => ok(await desk.match(matchId), Date.now()),
    season: async (seasonId) => ok(await desk.season(seasonId), Date.now()),
  };
  registerArenaSource(source);
  current = { desk, board: input.board };
  const s = await desk.state().catch(() => null);
  input.log(s?.deployed ? `arena ${s.arenaId} (policy ${s.policyVersion}): tiers ${s.tiers.map((t) => t.tierId).join(",")}` : "no ArenaTerms on this participant yet (the bootstrap creates it); the desk idles");
  const settler = runActor({ name: "duel-settler", log: input.log, dryRun: session.dryRun, everyMs: input.everyMs ?? Number(process.env.GAME_SETTLER_REFRESH_MS ?? 4_000), pass: () => settlerPass(desk, input.log) });
  return {
    desk,
    routes: arenaRoutes(desk),
    stop: () => {
      settler.stop();
      registerArenaSource(null);
      current = null;
    },
  };
}
