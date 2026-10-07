/**
 * The projector's stream loop, independent of the actor runtime so the dev runner, the rebuild and the tests drive it
 * directly. One `/v2/updates` WebSocket as the venue party with LEDGER_EFFECTS; each transaction is decoded and written
 * with the cursor in one DB transaction; `OffsetCheckpoint`s advance the cursor while idle; a token re-grant or a
 * dropped socket resumes from the cursor (`@owarine/ledger` streamUpdates does both).
 *
 * Bootstrap: with no cursor it replays from offset 0 (a fresh sandbox, or a participant that keeps its history). If the
 * participant has pruned below the requested offset, the stream fails fatally; the loop then reads the participant's
 * pruning offset (`/v2/state/latest-pruned-offsets`), pages the venue's ACS at that offset, writes it as one
 * `acs:<offset>` update (legs with origin `snapshot`, no fills), marks the cursor `bootstrap = 'acs'` with
 * `history_from_offset`, and streams from there: every update the participant still keeps is indexed (C4g, Noders DevNet
 * pruned up to an offset two million below its end, before our parties existed). Only when that offset cannot be read
 * does it fall back to the ledger end. `/status` shows that earlier history is absent.
 */
import { indexWriter, type Db } from "@owarine/db";
import { streamUpdates, type JsTransaction, type LedgerClient, type LedgerError, type StreamState, type TokenSource, type WebSocketCtor } from "@owarine/ledger";
import { decodeTransaction } from "./decode";

export interface ProjectorConfig {
  db: Db;
  ledger: LedgerClient;
  baseUrl: string;
  auth: TokenSource;
  /** The projected party: the venue. */
  party: string;
  /** Cursor row name (default `venue`). Sandbox and DevNet use separate databases, never separate streams. */
  stream?: string;
  log: (why: string) => void;
  WebSocket?: WebSocketCtor;
  /** Wait between a fatal stream error and the next attempt. */
  restartMs?: number;
  /**
   * Called once per transaction the writer applied, after it is written (C9b: the duel projection rides here). A
   * failure is logged and never stops the stream: the rows the index keeps are already committed.
   */
  onApplied?: (tx: JsTransaction) => Promise<void>;
}

export interface ProjectorStats {
  state: StreamState | "bootstrapping";
  applied: number;
  skipped: number;
  checkpoints: number;
  reconnects: number;
  errors: number;
  lastError: string | null;
  lastLagSec: number | null;
  maxLagSec: number;
  lastAppliedMs: number | null;
  cursor: number | null;
}

export interface Projector {
  stats: ProjectorStats;
  /** Resolves once the cursor is at or past `offset` (a checkpoint counts). */
  waitFor(offset: number, timeoutMs?: number): Promise<void>;
  stop(): Promise<void>;
}

const PRUNED = /prun/i;

export function startProjectorLoop(cfg: ProjectorConfig): Projector {
  const stream = cfg.stream ?? "venue";
  const writer = indexWriter(cfg.db);
  const stats: ProjectorStats = {
    state: "connecting", applied: 0, skipped: 0, checkpoints: 0, reconnects: 0, errors: 0, lastError: null, lastLagSec: null, maxLagSec: 0,
    lastAppliedMs: null, cursor: null,
  };
  let stopped = false;
  let current: { close(): Promise<void>; done: Promise<void> } | null = null;
  const waiters = new Set<{ offset: number; resolve: () => void }>();
  const notify = () => {
    for (const w of waiters) if (stats.cursor !== null && stats.cursor >= w.offset) (waiters.delete(w), w.resolve());
  };

  async function onTransaction(tx: JsTransaction): Promise<void> {
    const u = decodeTransaction(tx);
    const result = await writer.applyUpdate(stream, cfg.party, u);
    if (result === "applied") stats.applied += 1;
    else stats.skipped += 1;
    if (result === "applied" && cfg.onApplied) await cfg.onApplied(tx).catch((e: unknown) => cfg.log(`after-apply hook failed at offset ${u.offset}: ${String(e)}`));
    if (u.recordTimeMs !== null) {
      stats.lastLagSec = Math.max(0, Math.round((Date.now() - u.recordTimeMs) / 100) / 10);
      stats.maxLagSec = Math.max(stats.maxLagSec, stats.lastLagSec);
    }
    stats.lastAppliedMs = Date.now();
    stats.cursor = u.offset;
    notify();
  }

  /** The earliest offset the participant still serves: its pruning offset, else (unreadable or 0) the ledger end. */
  async function snapshotOffset(): Promise<{ offset: number; from: "pruning offset" | "ledger end" }> {
    const pruned = await cfg.ledger.latestPrunedOffset().catch((e: unknown) => {
      cfg.log(`pruning offset unreadable (${String(e)}); snapshotting at the ledger end`);
      return 0;
    });
    return pruned > 0 ? { offset: pruned, from: "pruning offset" } : { offset: await cfg.ledger.ledgerEnd(), from: "ledger end" };
  }

  async function bootstrapFromAcs(): Promise<number> {
    stats.state = "bootstrapping";
    const { offset: end, from } = await snapshotOffset();
    const created: JsTransaction["events"] = [];
    let nodeId = 0;
    // One synchronizer per participant here; the snapshot carries the first contract's (a Resolution's disclosure needs it).
    let synchronizerId = "";
    for await (const page of cfg.ledger.iterateActiveContracts({ parties: [cfg.party], activeAtOffset: end, maxPageSize: 500, includeCreatedEventBlob: true })) {
      for (const c of page.contracts) {
        created.push({ CreatedEvent: { ...c.createdEvent, nodeId: nodeId++ } });
        synchronizerId ||= c.synchronizerId;
      }
    }
    const snapshot: JsTransaction = { updateId: `acs:${end}`, offset: end, effectiveAt: new Date().toISOString(), recordTime: new Date().toISOString(), synchronizerId, events: created };
    await writer.applyUpdate(stream, cfg.party, decodeTransaction(snapshot, { snapshot: true }));
    await writer.markAcsBootstrap(stream, cfg.party, end);
    cfg.log(`participant pruned below the requested offset: bootstrapped ${created.length} active contracts at offset ${end} (the ${from}), streaming from there; earlier history is not indexed`);
    return end;
  }

  async function loop(): Promise<void> {
    while (!stopped) {
      const cursor = await writer.cursor(stream).catch((e: unknown) => {
        stats.errors += 1;
        stats.lastError = String(e);
        return undefined;
      });
      if (cursor === undefined) {
        await sleep(cfg.restartMs ?? 5_000);
        continue;
      }
      if (cursor && cursor.party !== cfg.party) throw new Error(`the projection holds party ${cursor.party}, not ${cfg.party}: use a fresh database`);
      const begin = cursor?.offset ?? 0;
      stats.cursor = cursor?.offset ?? null;
      let fatal: LedgerError | null = null;
      const s = streamUpdates({
        baseUrl: cfg.baseUrl,
        auth: cfg.auth,
        parties: [cfg.party],
        beginExclusive: begin,
        // The Resolution's blob is what a seat's Leg_Claim discloses; the projection keeps it (resolutionsByMarket).
        includeCreatedEventBlob: true,
        ...(cfg.WebSocket ? { WebSocket: cfg.WebSocket } : {}),
        onTransaction,
        onCheckpoint: async (cp) => {
          await writer.applyCheckpoint(stream, cfg.party, cp.offset, cp.synchronizerTimes?.[0] ? Date.parse(cp.synchronizerTimes[0].recordTime) : null);
          stats.checkpoints += 1;
          stats.cursor = cp.offset;
          notify();
        },
        onState: (state, detail) => {
          if (state === "reconnecting") stats.reconnects += 1;
          stats.state = state;
          if (state === "reconnecting") cfg.log(`stream reconnecting from offset ${stats.cursor ?? begin}: ${detail ?? ""}`);
        },
        onError: (err, isFatal) => {
          stats.errors += 1;
          stats.lastError = err.message;
          if (isFatal) fatal = err;
        },
      });
      current = s;
      await s.done;
      current = null;
      if (stopped) break;
      const err = fatal as LedgerError | null;
      if (err && PRUNED.test(err.message) && begin === (cursor?.offset ?? 0)) {
        await bootstrapFromAcs();
        continue;
      }
      cfg.log(`stream stopped${err ? `: ${err.message}` : ""}; restarting from the cursor`);
      await sleep(cfg.restartMs ?? 5_000);
    }
  }

  const running = loop().catch((e: unknown) => {
    stats.errors += 1;
    stats.lastError = String(e);
    stats.state = "closed";
    cfg.log(`projector stopped: ${String(e)}`);
  });

  return {
    stats,
    waitFor(offset, timeoutMs = 60_000) {
      if (stats.cursor !== null && stats.cursor >= offset) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const w = { offset, resolve };
        waiters.add(w);
        setTimeout(() => {
          if (waiters.delete(w)) reject(new Error(`projector did not reach offset ${offset} within ${timeoutMs} ms (cursor ${stats.cursor})`));
        }, timeoutMs).unref?.();
      });
    },
    async stop() {
      stopped = true;
      await current?.close();
      await running;
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
