/**
 * Runs the Canton venue actors together against a LOCAL sandbox, the way `services/ops/src/main.ts` wires them: the
 * crypto spot feed, every C3 actor over one ledger client and one shard pool, and the ops HTTP server with
 * `/ladders/*`, `/reserve` and `POST /internal/*`. Every venue event is appended to `OPS_EVENTS_FILE` (JSONL) for the
 * drive report. Kill it at any moment and start it again: every actor reconciles from the ledger, and every write
 * carries a stable command id.
 *
 *   LEDGER_JSON_API_URL=http://localhost:7575 AGARI_PARTIES_FILE=… DRY_RUN=0 OPS_INTERNAL_SECRET=… \
 *     pnpm --filter @agari/scripts exec tsx drive/ops-local.ts
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { appendFileSync } from "node:fs";
import { startCantonVenue } from "../../services/ops/src/actors/venue";
import { onVenueEvent } from "../../services/ops/src/actors/venue/events";
import { createSessionService } from "../../services/ops/src/calendar/session-service";
import { startOpsHttp } from "../../services/ops/src/http/server";
import { createCryptoSpotFeed } from "../../services/ops/src/prices/crypto-spot";
import { createHaltBoard, createPythEntitlementStore, createSessionEvents, heartbeats, readOpsEnv } from "../../services/ops/src/runtime";

const env = readOpsEnv();
const stamp = () => new Date().toISOString().slice(11, 23);
const log = (actor: string) => (why: string) => console.log(`${stamp()} [${actor}] ${why}`);
const eventsFile = process.env.OPS_EVENTS_FILE;
if (eventsFile) onVenueEvent((e) => appendFileSync(eventsFile, `${JSON.stringify({ ...e, pid: process.pid })}\n`));

const spot = createCryptoSpotFeed({ log: log("crypto-spot") });
spot.start();
const deps = {
  env, log: log("ops"), sessions: createSessionService(), spot, halts: createHaltBoard(), events: createSessionEvents(),
  pythIndex: createPythEntitlementStore({ key: undefined, log: log("pyth-entitlement") }),
};
const venue = await startCantonVenue({ deps, spot, log });
await startOpsHttp({ port: env.httpPort, spot, ladders: venue.board, internal: venue.internal, reserve: venue.reserve, env, log: log("http") });
log("ops")(`boot pid ${process.pid}: ${env.dryRun ? "DRY RUN" : "live"}, http :${env.httpPort}${eventsFile ? `, events → ${eventsFile}` : ""}`);

const stop = (signal: string) => {
  log("ops")(`${signal}: stopping`);
  venue.stop();
  spot.stop();
  process.exit(0);
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
setInterval(() => {
  const failing = heartbeats().filter((b) => b.failures >= 3).map((b) => `${b.actor}: ${b.lastWhy}`);
  if (failing.length) log("ops")(`failing: ${failing.join(" | ")}`);
}, 30_000);
