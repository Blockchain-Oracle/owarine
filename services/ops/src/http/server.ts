/**
 * The ops HTTP server (venue-ops.md §2.3, §6.5): `/health`, `/session`, `/prices/latest`, `/prices/stream`,
 * `/prestocks/latest`, `/pyth-index/latest`, and on Canton (C3) `/ladders/latest`, `/ladders/stream` and `/reserve`:
 * GET only, CORS `*`. `POST /internal/*` (quotes, seat funding) is HMAC-authenticated and carries no CORS (`internal.ts`).
 */
import { createServer } from "node:http";
import type { SessionService } from "../calendar/session-service";
import type { SpotFeed } from "../prices/spot";
import type { OpsEnv } from "../runtime/env";
import type { HaltBoardStore } from "../runtime/halt-board";
import type { SessionEvents } from "../runtime/session-events";
import { healthBody, jsonText } from "./health";
import { sessionBody } from "./session";
import type { SourceHealthStore } from "../runtime/source-health";
import type { PreStocksSpotFeed } from "../prices/prestocks-spot";
import { preStocksLatestBody } from "./prestocks-latest";
import type { PythIndexSpotFeed } from "../prices/pyth-index-spot";
import type { PythEntitlementStore } from "../runtime/pyth-entitlement";
import { pythIndexLatestBody } from "./pyth-index-latest";
import { latestBody, streamSpot } from "./spot-sse";
import { createRecentRing, type RecentRing } from "../prices/recent-ring";
import { createDayStats } from "../prices/day-stats";
import type { LadderBoard } from "../actors/market-maker/seat/ladder-board";
import { handleInternal, type InternalRoutes } from "./internal";
import { ladderLatestBody, streamLadders } from "./ladder-sse";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };

export interface OpsHttp {
  port: number;
  close(): Promise<void>;
}

export function startOpsHttp(input: {
  port: number;
  spot: SpotFeed | null;
  /** The PreStocks catalogue feed (plan Step 1); absent in a process without the maker or http actors. */
  prestocks?: PreStocksSpotFeed | null;
  /** The valuation indices' entitlement store and spot (S20); absent in a process without them. */
  pythIndex?: { store: PythEntitlementStore; spot: PythIndexSpotFeed | null } | null;
  /** C6: each attested lane source's health (`source-probe`), served on `/session.sources.attested`. */
  attested?: SourceHealthStore | null;
  sessions?: SessionService;
  halts?: HaltBoardStore;
  events?: SessionEvents;
  env?: OpsEnv;
  log?: (why: string) => void;
  /** The venue price ladders (C3 pricer); absent in a process without the pricer. */
  ladders?: LadderBoard | null;
  /** The HMAC-authenticated venue calls (quote issuer, seat funding); absent = every `/internal/*` is 404. */
  internal?: InternalRoutes | null;
  /** The reserve reporter's latest snapshot. */
  reserve?: (() => unknown) | null;
  /** Revamp step 2: the last half hour of spot per symbol (`/prices/recent`), built here from `spot` when absent. */
  recent?: RecentRing | null;
}): Promise<OpsHttp> {
  const recent = input.recent ?? (input.spot ? createRecentRing(input.spot) : null);
  const dayStats = createDayStats();
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://ops").pathname;
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { ...CORS, "content-type": "application/json" });
      res.end(jsonText(body));
    };
    if (path.startsWith("/internal/")) return void handleInternal(req, res, path, input.internal);
    if (req.method === "OPTIONS") return void res.writeHead(204, CORS).end();
    if (req.method !== "GET") return json(405, { error: "GET only" });
    if (path === "/health") {
      const body = healthBody(input.env);
      return json(body.ok ? 200 : 503, body);
    }
    if (path === "/session") return json(200, sessionBody({ sessions: input.sessions ?? null, halts: input.halts ?? null, events: input.events ?? null, pythIndex: input.pythIndex?.store ?? null, attested: input.attested ?? null }));
    if (path === "/prices/latest") {
      if (!input.spot) return json(503, { error: "no spot feed in this process" });
      return void latestBody(input.spot).then((body) => json(200, body), (error: unknown) => json(503, { error: `prices unavailable: ${error instanceof Error ? error.message : String(error)}` }));
    }
    if (path === "/prices/recent") {
      const symbol = new URL(req.url ?? "/", "http://ops").searchParams.get("symbol") ?? "";
      if (!recent) return json(503, { error: "no spot feed in this process" });
      if (!/^[A-Za-z0-9.]{1,16}$/.test(symbol)) return json(400, { error: "symbol must be a ticker" });
      return json(200, { symbol, points: recent.points(symbol) });
    }
    if (path === "/prices/day") return void dayStats().then((body) => json(200, body), () => json(503, { error: "day stats unavailable" }));
    if (path === "/prices/stream") return input.spot ? void streamSpot(req, res, input.spot, CORS) : json(503, { error: "no spot feed in this process" });
    if (path === "/prestocks/latest") return input.prestocks ? json(200, preStocksLatestBody(input.prestocks)) : json(503, { error: "no PreStocks feed in this process" });
    if (path === "/pyth-index/latest") return input.pythIndex ? json(200, pythIndexLatestBody(input.pythIndex.store, input.pythIndex.spot, input.prestocks ?? null)) : json(503, { error: "no Pyth index store in this process" });
    if (path === "/ladders/latest") return input.ladders ? json(200, ladderLatestBody(input.ladders)) : json(503, { error: "no pricer in this process" });
    if (path === "/ladders/stream") return input.ladders ? void streamLadders(req, res, input.ladders, CORS) : json(503, { error: "no pricer in this process" });
    if (path === "/reserve") return input.reserve ? json(200, input.reserve()) : json(503, { error: "no reserve reporter in this process" });
    return json(404, { error: "not found" });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port, () => {
      input.log?.(`http on :${input.port} (/health, /session, /prices/*, /prestocks/latest, /pyth-index/latest${input.ladders ? ", /ladders/*" : ""}${input.internal ? ", POST /internal/*" : ""})`);
      resolve({ port: input.port, close: () => new Promise((done) => (recent?.stop(), server.close(() => done()))) });
    });
  });
}
