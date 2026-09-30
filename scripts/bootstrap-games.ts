/**
 * C9b: the duel arena and the season pool on a LOCAL sandbox (called by `bootstrap-local.ts`; `--no-games` skips it).
 * Idempotent: an arena or a pool that already exists is left as it is.
 *
 *   1. uploads abu-pm-games (the same DAR twice is one package),
 *   2. creates the venue's `ArenaTerms` (`--arena-id`, default `arena-1`) with the reference's stake tiers (core
 *      `STAKE_TIERS`: free, t1, t5, t10; each a side pot and a per-card cap, in whole credits) and its phase windows
 *      (`--join-sec 120 --reveal-sec 60 --pick-sec 240`, deck 2–8 cards), under the deckmaster's policy version,
 *   3. creates the season's `SeasonPool` (`--season-id`, default `SEASON_ID` or `s1`, ending `--season-days` from now)
 *      and funds it from a venue shard (`--season-seed` credits): the prize is money on the ledger before anyone plays.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STAKE_TIERS } from "@agari/core/games";
import { GAMES_TEMPLATE_IDS } from "@agari/daml";
import type { Command, CreatedEvent, LedgerClient } from "@agari/ledger";
import { cmd, decodeVenueCash, pick, readActive, type RoleSession } from "@agari/markets/ops/canton";
import { decodeArenaTerms, decodeSeasonPool, gcmd } from "@agari/markets/ops/games";
import { DECK_POLICY_VERSION } from "../services/ops/src/actors/matchmaker/deckmaster";
import { arg } from "./drive/cli";

const GAMES_DAR = resolve(import.meta.dirname, "..", arg("--games-dar", "daml/abu-pm-games/.daml/dist/abu-pm-games-0.1.1.dar"));
const CREDIT = 1_000_000n;

export async function bootstrapGames(o: { client: LedgerClient; venue: RoleSession; run: string; log: (s: string) => void }): Promise<void> {
  const { client, venue, run, log } = o;
  const submitAs = async (party: string, commandId: string, commands: Command[]): Promise<CreatedEvent[]> => {
    const r = await client.submitAndWaitForTransaction({ actAs: [party], commandId, commands });
    return r.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));
  };
  if (!existsSync(GAMES_DAR)) throw new Error(`${GAMES_DAR} is missing: run \`dpm build --all\` in daml/ first`);
  await client.uploadDar(readFileSync(GAMES_DAR));
  log(`uploaded ${GAMES_DAR.split("/").slice(-1)[0]}`);

  const acs = await readActive(venue, [GAMES_TEMPLATE_IDS.ArenaTerms, GAMES_TEMPLATE_IDS.SeasonPool]);
  const arenaId = arg("--arena-id", process.env.GAME_ARENA_ID ?? "arena-1");
  const arenas = pick(acs, GAMES_TEMPLATE_IDS.ArenaTerms, decodeArenaTerms).filter((a) => a.data.venue === venue.party);
  if (arenas.length === 0) {
    const params = {
      joinWindowSec: Number(arg("--join-sec", "120")),
      revealWindowSec: Number(arg("--reveal-sec", "60")),
      pickWindowSec: Number(arg("--pick-sec", "240")),
      minDeckSize: 2,
      maxDeckSize: 8,
    };
    // The reference's tiers (core STAKE_TIERS): free carries no pot and is unranked; each tier caps one card's order.
    const tiers = STAKE_TIERS.map((t) => ({ tierId: t.id, potEach: BigInt(t.potUnits) * CREDIT, perCardCap: BigInt(t.perCardCapUnits) * CREDIT, ranked: t.mode === "ranked", enabled: true }));
    await submitAs(venue.party, `bootstrap:arena:${arenaId}:${run}`, [gcmd.createArenaTerms({ venue: venue.party, arenaId, policyVersion: DECK_POLICY_VERSION, params, tiers })]);
    log(`created ArenaTerms ${arenaId} (policy ${DECK_POLICY_VERSION}; join ${params.joinWindowSec} s, reveal ${params.revealWindowSec} s, pick ${params.pickWindowSec} s; tiers ${tiers.map((t) => t.tierId).join(",")})`);
  } else {
    log(`ArenaTerms ${arenas.map((a) => a.data.arenaId).join(",")} already on the ledger`);
  }

  const seasonId = arg("--season-id", process.env.SEASON_ID ?? "s1");
  const pools = pick(acs, GAMES_TEMPLATE_IDS.SeasonPool, decodeSeasonPool).filter((p) => p.data.venue === venue.party && p.data.seasonId === seasonId);
  if (pools.length > 0) {
    log(`SeasonPool ${seasonId} already on the ledger (holds ${pools[0]!.data.amount})`);
    return;
  }
  const endsAtSec = Math.floor(Date.now() / 1000) + Number(arg("--season-days", "7")) * 86_400;
  const created = await submitAs(venue.party, `bootstrap:season:${seasonId}:${run}`, [gcmd.createSeasonPool({ venue: venue.party, seasonId, endsAtSec })]);
  const poolCid = created.find((e) => e.templateId.endsWith(":PM.Games.Season:SeasonPool"))?.contractId;
  const seed = BigInt(arg("--season-seed", "500")) * CREDIT;
  if (!poolCid || seed === 0n) return log(`created SeasonPool ${seasonId} (unfunded)`);
  const shard = await submitAs(venue.party, `bootstrap:season-shard:${seasonId}:${run}`, [cmd.createShard(venue.party, seed, "season-seed")]);
  const cash = shard.filter((e) => e.templateId.endsWith(":PM.Money:VenueCash") && decodeVenueCash(e.createArgument).bucket === "season-seed").map((e) => e.contractId);
  await submitAs(venue.party, `bootstrap:season-fund:${seasonId}:${run}`, [gcmd.fundSeason(poolCid, cash)]);
  log(`created SeasonPool ${seasonId} ending ${new Date(endsAtSec * 1000).toISOString()}, funded ${seed} base units`);
}
