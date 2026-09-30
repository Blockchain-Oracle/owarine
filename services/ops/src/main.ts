/**
 * The single long-running ops service (AD-8). Each actor is a single writer over its own key and
 * registers here; every cycle logs a structured why-string, and idle is a heartbeat, never silence.
 *
 * S3 venue actors (venue-ops.md §2.5) share one session calendar and price-relay's spot feed; S6 adds the halt board
 * and the session events (session-lanes.md §3). `OPS_ACTORS` names
 * what runs: the default is the venue set; `all` adds the Masayume-era actors, which idle until their stages deploy
 * the programs they drive. DRY_RUN stays on unless `DRY_RUN=0` (nothing signs by default).
 */
// C6e: the local env files load before any module reads process.env (the reference's `--env-file-if-exists`).
import { loadedEnvFiles } from "./runtime/load-env";
import "./actors/venue/quiet-codegen";
import { attachDuelRoom, createDuelProjection } from "./actors/duel-projector";
import { startDeskRunner } from "./actors/desk-runner";
import { startPushClock } from "./actors/push-clock";
import { startGameRoom } from "./actors/game-room";
import { startHaltWatch } from "./actors/halt-watch";
import { startProjector } from "./actors/projector";
import { CANTON_ACTORS, startCantonVenue } from "./actors/venue";
import { createVenueContext } from "./actors/venue/context";
import { onVenueEvent } from "./actors/venue/events";
import { appendFileSync } from "node:fs";
import { startLeverageKeeper } from "./actors/leverage-keeper";
import { startPriceRelay } from "./actors/price-relay";
import { startPythEntitlement } from "./actors/pyth-entitlement";
import { startStrategyRunner } from "./actors/strategy-runner";
import { startXRelay } from "./actors/x-relay";
import { startEarnings } from "./calendar/earnings";
import { createSessionService } from "./calendar/session-service";
import { startOpsHttp } from "./http/server";
import type { SpotFeed } from "./prices/spot";
import { createXStockSpotFeed, joinXStockSpot } from "./prices/xstock-spot";
import { createSwitchboardSpotFeed, joinSwitchboardSpot } from "./prices/switchboard-spot";
import { createPreStocksSpotFeed, joinPreStocksSpot, PRESTOCKS_BOOT_SPREAD_MS, PRESTOCKS_SPOT_EVERY_MS, type PreStocksSpotHandle } from "./prices/prestocks-spot";
import { createPythIndexSpotFeed, joinPythIndexSpot, type PythIndexSpotHandle } from "./prices/pyth-index-spot";
import { createHaltBoard, createPythEntitlementStore, createSessionEvents, errorText, heartbeats, readOpsEnv, redact, type VenueDeps } from "./runtime";
import { createSourceHealthStore } from "./runtime/source-health";
import { startSourceProbe } from "./actors/source-probe";
import { loadRelaySources, loadSwitchboardFeeds, loadXStockMints } from "./actors/price-relay/sources";
import { alpacaKeys } from "./actors/price-relay";

const HEARTBEAT_MS = 30_000;
/** A pass running longer than this is stuck (no send outlives its 120 s timeout): exit and let the supervisor restart. */
const STUCK_PASS_MS = Number(process.env.OPS_STUCK_PASS_MS) || 10 * 60_000;
/** Canton (C3): "venue" runs the roller, resolver, pricer, issuer, sweeper, rebalancer, netting, settler, seat funding and
 * drain, and the reserve reporter; "relay" runs the three oracle feeders; "projector" replaces the Solana indexer. */
/** C9b: the duel room (with its matchmaker) is a venue actor; the duel settler runs inside "venue" (the arena desk) and
 * the duel projection inside "projector". The room idles, saying why, without `ROOM_TOKEN_SECRET`. */
const VENUE_ACTORS = ["relay", "venue", "projector", "http", "halts", "earnings", "push-clock", "game-room"] as const;
const LEGACY_ACTORS = ["strategy-runner", "x-relay", "leverage-keeper"] as const;
/** Opt-in actors that never ride on `all`: the desk trades real PreStocks on mainnet and is named on purpose (S21, D-126). */
const OPT_IN_ACTORS = ["desk-runner"] as const;

function whyString(actor: string, why: string): string {
  return JSON.stringify({ tsMs: Date.now(), actor, why: redact(why) });
}

const log = (actor: string) => (why: string) => console.log(whyString(actor, why));

function selectedActors(raw: string | undefined): Set<string> {
  const names = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return new Set(VENUE_ACTORS);
  // "all" is the venue and the legacy actors; an opt-in actor named beside it ("all,desk-runner") joins rather than being dropped.
  if (names.includes("all")) return new Set([...VENUE_ACTORS, ...LEGACY_ACTORS, ...names.filter((n) => n !== "all" && (OPT_IN_ACTORS as readonly string[]).includes(n))]);
  return new Set(names);
}

/** The exit code for an actor that failed to start (D-098); the watchdog's stuck-pass exit is 70. */
const EXIT_START_FAILED = 78;

/**
 * Starts one actor. A start failure is fatal (D-098): ops logs it and exits non-zero so the supervisor restarts the
 * whole process after its 10 s sleep. Before this, one actor could die at boot (`getaddrinfo ENOTFOUND`, a Postgres
 * `CONNECT_TIMEOUT`) while the others kept the process alive, and the venue ran without a roller or an indexer for
 * up to 98 minutes until someone noticed.
 */
function boot<T>(actor: string, start: () => Promise<T>): Promise<T> {
  return start().catch((error: unknown): never => {
    log(actor)(`failed to start: ${errorText(error)} · exiting ${EXIT_START_FAILED} so the supervisor restarts ops (D-098)`);
    process.exit(EXIT_START_FAILED);
  });
}

const env = readOpsEnv();
const actors = selectedActors(process.env.OPS_ACTORS);
console.log(whyString("ops", `boot: ${env.cluster}, ${env.dryRun ? "DRY RUN" : "live"}, actors ${[...actors].join(",")}`));
for (const f of loadedEnvFiles) console.log(whyString("ops", `env file ${f.path}: ${f.taken.length} variable(s) taken (explicit env wins)`));

// C3 drive evidence: every venue event as one JSONL line (with this pid) for `scripts/drive/ops-report.ts`. Off unless set.
const eventsFile = process.env.OPS_EVENTS_FILE;
if (eventsFile) onVenueEvent((e) => appendFileSync(eventsFile, `${JSON.stringify({ ...e, pid: process.pid })}\n`));

const sessions = createSessionService();
// S6 (session-lanes.md §3): halt-watch is the halt board's only writer; the events reader serves corporate actions and earnings.
const halts = createHaltBoard();
const events = createSessionEvents();
// S20 (D-125): one entitlement store per process; `pyth-entitlement` writes it, the relay, roller, maker and `/session` read it.
const pythIndex = createPythEntitlementStore({ key: process.env.PYTH_API_KEY || undefined, log: log("pyth-entitlement") });
// C6: whether each attested lane's original source can sign now; `source-probe` writes it, the roller lists by it.
const sources = createSourceHealthStore();
const deps = (actor: string, spot: VenueDeps["spot"] = null): VenueDeps => ({ env, log: log(actor), sessions, spot, halts, events, pythIndex, sources });
if (actors.has("relay") || actors.has("venue")) void boot("pyth-entitlement", () => startPythEntitlement(deps("pyth-entitlement")));
if (actors.has("relay") || actors.has("venue"))
  void boot("source-probe", async () =>
    startSourceProbe(
      sources,
      { sources: loadRelaySources(), pythKey: process.env.PYTH_API_KEY || undefined, pythIndex, switchboardFeeds: loadSwitchboardFeeds(), alpaca: alpacaKeys(), xstockMints: loadXStockMints() },
      log("source-probe"),
    ),
  );

// The relay owns the spot feed, so it starts first and hands the feed to the maker and the HTTP server.
// One venue context for the whole process: the relay's oracle feeders and the venue actors share its ledger sessions.
const venueCtx = createVenueContext();
const relay = actors.has("relay") ? await boot("price-relay", () => startPriceRelay(deps("price-relay"), venueCtx)) : null;
const spot = relay?.spot ?? null;
// S6 token lane (session-lanes.md §2.4): the Jupiter xStock spot runs only for the maker and HTTP, joined under the xStock
// symbols; halt-watch keeps the relay's own feed. Keyless lite-api (0.5 RPS) serves the 5 s poll when no key is set.
let marketSpot: SpotFeed | null = spot;
let prestocksSpot: PreStocksSpotHandle | null = null;
let pythIndexSpot: PythIndexSpotHandle | null = null;
if (actors.has("venue") || actors.has("http") || actors.has("desk-runner")) {
  if (!process.env.JUPITER_API_KEY) log("xstock-spot")("JUPITER_API_KEY not set: polling keyless lite-api.jup.ag; the token maker pulls while Jupiter fails");
  const xstockSpot = createXStockSpotFeed({ log: log("xstock-spot"), apiKey: process.env.JUPITER_API_KEY || undefined });
  xstockSpot.start();
  // Plan Step 1 (D-100): the PreStocks catalogue prices the pre-IPO names for the holdings card, the maker and /prestocks/latest.
  prestocksSpot = createPreStocksSpotFeed({ log: log("prestocks-spot") });
  prestocksSpot.start();
  log("prestocks-spot")(`polling the PreStocks catalogue every ${PRESTOCKS_SPOT_EVERY_MS / 1000} s for ${prestocksSpot.symbols().join(",")} (first read within ${PRESTOCKS_BOOT_SPREAD_MS / 1000} s; a 429 waits its Retry-After, else a jittered backoff)`);
  // S20: the valuation indices, polled only while entitled, joined under the valuation lanes' symbols (OPENAIV, ANTHROPICV).
  pythIndexSpot = createPythIndexSpotFeed({ store: pythIndex, key: process.env.PYTH_API_KEY || undefined, log: log("pyth-index-spot") });
  pythIndexSpot.start();
  marketSpot = joinPythIndexSpot(joinPreStocksSpot(joinXStockSpot(spot, xstockSpot), prestocksSpot), pythIndexSpot);
}
// What web shows: a 24/7 Window's live price is its Switchboard Surge value, the one its print signs (the maker keeps Jupiter).
let displaySpot: SpotFeed | null = marketSpot;
if (actors.has("http")) {
  const switchboardSpot = createSwitchboardSpotFeed({ log: log("switchboard-spot") });
  switchboardSpot.start();
  displaySpot = joinSwitchboardSpot(marketSpot, switchboardSpot);
}
const canton = actors.has("venue")
  ? await boot("canton-venue", () =>
      startCantonVenue({
        deps: deps("venue", marketSpot),
        spot: marketSpot,
        log,
        venue: venueCtx,
        // The relay runs the oracle feeders when it is on; the venue runs them only in a process without it.
        actors: new Set(CANTON_ACTORS.filter((a) => a !== "oracles" || !actors.has("relay"))),
        internalSecret: process.env.OPS_INTERNAL_SECRET || null,
      }),
    )
  : null;
if (actors.has("http"))
  void boot("http", () =>
    startOpsHttp({
      port: env.httpPort,
      spot: displaySpot,
      prestocks: prestocksSpot,
      pythIndex: { store: pythIndex, spot: pythIndexSpot },
      attested: sources,
      sessions,
      halts,
      events,
      env,
      log: log("http"),
      ladders: canton?.board ?? null,
      internal: canton?.internal ?? null,
      reserve: canton?.reserve ?? null,
    }),
  );
if (actors.has("halts")) void boot("halt-watch", () => startHaltWatch(deps("halt-watch", spot)));
if (actors.has("earnings")) void boot("earnings", () => startEarnings(deps("earnings")));
// "indexer" is the pre-Canton name for the projector; either starts it.
if (actors.has("projector") || actors.has("indexer"))
  void boot("projector", () => startProjector(deps("projector"), process.env, { onApplied: createDuelProjection(log("duel-projector")) }));
// The Earn vault's market maker (MAKER_MODE=vault, C2d): on Canton the vault is a book inside the venue (abu-pm-main
// 0.5.0), so the venue's issuer quotes for it from `reserve:maker` shards; "venue" runs it (`actors/maker-vault`).

// S21 (D-126): the desk reads the in-process PreStocks feed, so it starts after the feed; on Canton (C8f) its live leg
// uses this process's ledger sessions, and the venue's ladder and issuer when the venue runs here.
if (actors.has("desk-runner")) void boot(OPT_IN_ACTORS[0], () => startDeskRunner({ log: log("desk-runner"), prestocks: prestocksSpot, venue: venueCtx, board: canton?.board ?? null, internal: canton?.internal ?? null }));
// C8f: the runner and the X relay act as the agent-runner party through owners' grants; with the venue in this process
// they take quotes from its issuer directly, otherwise from ops over the signed internal route.
const issuerRoutes = (() => {
  const r = canton?.internal.routes;
  const quotes = r?.["/internal/quotes"];
  const exitQuotes = r?.["/internal/exit-quotes"];
  return quotes && exitQuotes ? { quotes, exitQuotes } : null;
})();
if (actors.has("strategy-runner")) void startStrategyRunner(log("strategy-runner"), { venue: venueCtx, routes: issuerRoutes });
if (actors.has("x-relay")) void startXRelay(log("x-relay"), { venue: venueCtx, routes: issuerRoutes });
if (actors.has("leverage-keeper")) void startLeverageKeeper(log("leverage-keeper"));
// The duel room and its matchmaker (C9b): after the venue, whose arena desk is the room's source and the matchmaker's
// dealer. The projector's duel projection broadcasts into the room once it listens; without one it still writes rows.
if (actors.has("game-room")) void startGameRoom(log("game-room")).then(attachDuelRoom);
// S26.4: the phone push drain's clock; web chooses and words each notification.
if (actors.has("push-clock")) void boot("push-clock", () => startPushClock(log("push-clock")));
setInterval(() => {
  const stuck = heartbeats().filter((b) => b.passStartedMs !== null && Date.now() - b.passStartedMs > STUCK_PASS_MS);
  if (stuck.length === 0) return console.log(whyString("ops", "idle heartbeat"));
  // Crash-only recovery: every actor reconciles from chain state on boot, so a restart is always safe.
  console.log(whyString("ops", `exiting: pass stuck over ${STUCK_PASS_MS / 60_000} min in ${stuck.map((b) => b.actor).join(", ")}`));
  process.exit(70);
}, HEARTBEAT_MS);
