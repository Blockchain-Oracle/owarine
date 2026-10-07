/**
 * Runs the Canton venue actors together against a LOCAL sandbox, the way `services/ops/src/main.ts` wires them: the
 * spot feeds (crypto always; with the Alpaca keys in the environment also the equity and PreStocks feeds, so stock,
 * pre-IPO and basket Windows quote and Lucky can deal them, C4c), every C3 actor over one ledger client and one shard pool, and the ops HTTP server with
 * `/ladders/*`, `/reserve` and `POST /internal/*`; with `ROOM_TOKEN_SECRET` the duel room and matchmaker, and with
 * `DATABASE_URL` the projector and its duel projection (C9b). Every venue event is appended to `OPS_EVENTS_FILE` (JSONL) for the
 * drive report. Kill it at any moment and start it again: every actor reconciles from the ledger, and every write
 * carries a stable command id.
 *
 *   LEDGER_JSON_API_URL=http://localhost:7575 OWARINE_PARTIES_FILE=… DRY_RUN=0 OPS_INTERNAL_SECRET=… \
 *     pnpm --filter @owarine/scripts exec tsx drive/ops-local.ts
 */
// C6e: ops' env files (services/ops/.env.local, then the root .env.local) load first, never over an explicit variable.
import { loadedEnvFiles } from "../../services/ops/src/runtime/load-env";
import "../../services/ops/src/actors/venue/quiet-codegen";
import { appendFileSync } from "node:fs";
import { startCantonVenue } from "../../services/ops/src/actors/venue";
import { attachDuelRoom, createDuelProjection } from "../../services/ops/src/actors/duel-projector";
import { startGameRoom } from "../../services/ops/src/actors/game-room";
import { startProjector } from "../../services/ops/src/actors/projector";
import { onVenueEvent } from "../../services/ops/src/actors/venue/events";
import { createSessionService } from "../../services/ops/src/calendar/session-service";
import { startOpsHttp } from "../../services/ops/src/http/server";
import { createLocalSpot } from "../../services/ops/src/prices/local-spot";
import { createHaltBoard, createPythEntitlementStore, createSessionEvents, heartbeats, readOpsEnv } from "../../services/ops/src/runtime";

const env = readOpsEnv();
for (const f of loadedEnvFiles) console.log(`env file ${f.path}: ${f.taken.length} variable(s) taken (explicit env wins)`);
const stamp = () => new Date().toISOString().slice(11, 23);
const log = (actor: string) => (why: string) => console.log(`${stamp()} [${actor}] ${why}`);
const eventsFile = process.env.OPS_EVENTS_FILE;
if (eventsFile) onVenueEvent((e) => appendFileSync(eventsFile, `${JSON.stringify({ ...e, pid: process.pid })}\n`));

const local = createLocalSpot({ log });
log("ops")(local.summary);
const spot = local.spot;
const deps = {
  env, log: log("ops"), sessions: createSessionService(), spot, halts: createHaltBoard(), events: createSessionEvents(),
  pythIndex: createPythEntitlementStore({ key: undefined, log: log("pyth-entitlement") }),
};
const venue = await startCantonVenue({ deps, spot, log });
await startOpsHttp({ port: env.httpPort, spot, prestocks: local.prestocks, ladders: venue.board, internal: venue.internal, reserve: venue.reserve, env, log: log("http") });
// C9b: the duel room with its matchmaker (only with ROOM_TOKEN_SECRET), and the projector carrying the duel projection
// (only with DATABASE_URL), wired as main.ts wires them.
if (process.env.DATABASE_URL) await startProjector({ log: log("projector") }, process.env, { onApplied: createDuelProjection(log("duel-projector")) });
if (process.env.ROOM_TOKEN_SECRET) attachDuelRoom(await startGameRoom(log("game-room")));
log("ops")(`boot pid ${process.pid}: ${env.dryRun ? "DRY RUN" : "live"}, http :${env.httpPort}${eventsFile ? `, events → ${eventsFile}` : ""}`);

const stop = (signal: string) => {
  log("ops")(`${signal}: stopping`);
  venue.stop();
  local.stop();
  process.exit(0);
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
setInterval(() => {
  const failing = heartbeats().filter((b) => b.failures >= 3).map((b) => `${b.actor}: ${b.lastWhy}`);
  if (failing.length) log("ops")(`failing: ${failing.join(" | ")}`);
}, 30_000);
