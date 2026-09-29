/** `GET /health` (venue-ops.md §2.3): every actor heartbeat; `ok` is false when one is failing or silent for max(5 min, 3 × its loop interval). */
import { heartbeats } from "../runtime/heartbeat";
import type { OpsEnv } from "../runtime/env";

const SILENT_MS = 5 * 60_000;
const FAILING = 3;

/**
 * Display-only price feeds from third parties (K-027). They show a stock's or pre-IPO name's live price on screen and
 * never price, resolve or settle anything on the venue, so their outages are listed but never turn `ok` false. A 429
 * from PreStocks must not tell a supervisor or a judge that the venue is down.
 */
export const OPTIONAL_ACTORS: ReadonlySet<string> = new Set(["prestocks-spot", "xstock-spot", "pyth-index-spot", "switchboard-spot"]);

export function healthBody(env: OpsEnv | undefined, nowMs = Date.now()) {
  const actors = heartbeats();
  const healthy = (a: (typeof actors)[number]) => a.failures < FAILING && nowMs - (a.lastOkMs ?? a.startedMs) <= Math.max(SILENT_MS, 3 * a.everyMs);
  const ok = actors.every((a) => OPTIONAL_ACTORS.has(a.actor) || healthy(a));
  const degraded = actors.filter((a) => OPTIONAL_ACTORS.has(a.actor) && !healthy(a)).map((a) => a.actor);
  return { ok, degraded, cluster: env?.cluster ?? null, dryRun: env?.dryRun ?? null, nowMs, actors };
}

/** JSON with bigints as decimal strings. */
export const jsonText = (value: unknown) => JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
