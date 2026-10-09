/**
 * The projector (plan "Venue operations and the projector"): the venue party's ledger view mirrored into Postgres for
 * `/api/index/*`. Replaces the Solana indexer. Read-only on the ledger (it never submits), so DRY_RUN changes nothing.
 *
 * Env: `DATABASE_URL`; the `@owarine/ledger` variables (`LEDGER_JSON_API_URL`, `LEDGER_AUTH_MODE`, …); `VENUE_PARTY` (the
 * projected party); optional `PROJECTOR_STREAM` (cursor row, default `venue`) and `PROJECTOR_HEARTBEAT_MS`.
 */
import { roleParty } from "../../runtime/keys";
import { ensureSchema, getDb, indexReader, type Db } from "@owarine/db";
import { ledgerClientFromEnv, parseLedgerEnv, type LedgerClient, type WebSocketCtor } from "@owarine/ledger";
import { runActor, type VenueDeps } from "../../runtime";
import { startProjectorLoop, type Projector } from "./run";

export { decodeTransaction } from "./decode";
export { startProjectorLoop, type Projector, type ProjectorConfig, type ProjectorStats } from "./run";

const DEFAULT_HEARTBEAT_MS = 10_000;

export interface ProjectorOverrides {
  db?: Db;
  ledger?: LedgerClient;
  baseUrl?: string;
  party?: string;
  stream?: string;
  WebSocket?: WebSocketCtor;
  /** Heartbeat name on `/health` (default `projector`; the `indexer` shim keeps the name web's /status row reads today). */
  heartbeatName?: string;
  /** Per applied transaction (C9b: the duel projection). */
  onApplied?: (tx: import("@owarine/ledger").JsTransaction) => Promise<void>;
}

/** Starts the projector actor; null (with a logged reason) when there is no database or no venue party. */
export async function startProjector(
  deps: Pick<VenueDeps, "log">,
  env: NodeJS.ProcessEnv = process.env,
  o: ProjectorOverrides = {},
): Promise<{ stop: () => Promise<void>; projector: Projector } | null> {
  const db = o.db ?? getDb();
  if (!db) {
    deps.log("DATABASE_URL is not set: the projector has nowhere to write; idle");
    return null;
  }
  // The venue party from VENUE_PARTY, else the same parties file every other ops actor reads (K-026).
  const party = o.party ?? env.VENUE_PARTY ?? roleParty("venue", env) ?? undefined;
  if (!party) {
    deps.log("VENUE_PARTY is not set: the projector has no party to project; idle");
    return null;
  }
  await ensureSchema();
  const ledgerEnv = parseLedgerEnv(env);
  const ledger = o.ledger ?? ledgerClientFromEnv(ledgerEnv);
  const stream = o.stream ?? env.PROJECTOR_STREAM ?? "venue";
  const projector = startProjectorLoop({
    db,
    ledger,
    baseUrl: o.baseUrl ?? ledgerEnv.LEDGER_JSON_API_URL,
    auth: ledger.auth,
    party,
    stream,
    log: deps.log,
    ...(o.WebSocket ? { WebSocket: o.WebSocket } : {}),
    ...(o.onApplied ? { onApplied: o.onApplied } : {}),
  });
  const reader = indexReader(db);
  const everyMs = Number(env.PROJECTOR_HEARTBEAT_MS) >= 1_000 ? Number(env.PROJECTOR_HEARTBEAT_MS) : DEFAULT_HEARTBEAT_MS;
  const actor = runActor({
    name: o.heartbeatName ?? "projector",
    log: deps.log,
    dryRun: false,
    everyMs,
    pass: async () => {
      const [status, end] = await Promise.all([reader.status(stream), ledger.ledgerEnd().catch(() => null)]);
      const s = projector.stats;
      const cursor = (status.cursor ?? null) as { offset: string; bootstrap: string; history_from_offset: string } | null;
      const cursorOffset = cursor ? Number(cursor.offset) : null;
      const progressAgeSec = Math.round((Date.now() - s.lastProgressMs) / 1_000);
      const projectionStalled = end !== null && end > (cursorOffset ?? 0) && progressAgeSec >= 120;
      if (end !== null && projectionStalled) await projector.restartIfStalled(end);
      const lastEffective = Number(status.last_block_time_sec ?? 0);
      const detail = {
        stream,
        subscription: s.state,
        cursorOffset,
        ledgerEnd: end,
        behindOffsets: end !== null && cursorOffset !== null ? Math.max(0, end - cursorOffset) : null,
        progressAgeSec,
        projectionStalled,
        lastLagSec: s.lastLagSec,
        maxLagSec: s.maxLagSec,
        headAgeSec: lastEffective ? Math.round(Date.now() / 1000 - lastEffective) : null,
        updates: status.updates,
        events: status.events,
        fills: status.fills,
        windowsOpened: status.windows_opened,
        windowsResolved: status.windows_resolved,
        openLegs: status.open_legs,
        // Alarms: a terminal Window still holding user legs, and a resolved one that paid a stale refund (venue risk).
        resolvedWithOpenLegs: status.resolved_with_open_legs,
        resolvedWithStaleRefunds: status.resolved_with_stale_refunds,
        // The reference indexer's names, which web's /status row reads (`txs`, `cursorSlot`, `gapsOpen`).
        txs: status.updates,
        cursorSlot: cursorOffset,
        gapsOpen: 0,
        applied: s.applied,
        skipped: s.skipped,
        checkpoints: s.checkpoints,
        reconnects: s.reconnects,
        errors: s.errors,
        lastError: s.lastError,
        bootstrap: cursor?.bootstrap ?? null,
        historyFromOffset: cursor ? Number(cursor.history_from_offset) : null,
      };
      const behind = detail.behindOffsets === null ? "?" : detail.behindOffsets;
      const why = `${s.state} · cursor ${cursorOffset ?? "none"} (end ${end ?? "?"}, behind ${behind}) · ${status.updates} updates ${status.fills} fills · ${status.windows_opened} windows (${status.windows_resolved} terminal) · lag ${s.lastLagSec ?? "-"} s${s.errors ? ` · ${s.errors} error(s): ${s.lastError}` : ""}${cursor?.bootstrap === "acs" ? ` · history from ${cursor.history_from_offset}` : ""}`;
      return { why, detail };
    },
  });
  return {
    projector,
    stop: async () => {
      actor.stop();
      await projector.stop();
    },
  };
}
