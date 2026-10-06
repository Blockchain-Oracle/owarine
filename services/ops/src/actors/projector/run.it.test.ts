/**
 * The projector loop against a real Postgres and a scripted `/v2/updates` socket: replay idempotence across a reconnect,
 * checkpoints, and the pruned-participant ACS bootstrap (which a local sandbox cannot produce). Skipped unless
 * PROJECTOR_IT=1 and DATABASE_URL name a scratch database; it truncates the projection tables.
 *
 *   PROJECTOR_IT=1 DATABASE_URL=postgres://localhost/pm_c3a_test pnpm vitest run services/ops/src/actors/projector/run.it.test.ts
 */
import { readFileSync } from "node:fs";
import { ensureSchema, getDb, indexWriter } from "@agari/db";
import { noAuth, type CreatedEvent, type JsTransaction, type LedgerClient, type WebSocketLike } from "@agari/ledger";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { startProjectorLoop } from "./run";

const RUN = process.env.PROJECTOR_IT === "1" && Boolean(process.env.DATABASE_URL);
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/lifecycle.json", import.meta.url), "utf8")) as Record<string, JsTransaction>;
const txs = Object.values(fixtures).sort((a, b) => a.offset - b.offset);
const VENUE = "venue::1220";
const PRUNED_BELOW = 10_000;

/** A scripted socket: answers each request with every fixture after `beginExclusive`, then a checkpoint. */
class ScriptedWs implements WebSocketLike {
  static opened: number[] = [];
  static pruned = false;
  readyState = 1;
  onopen: WebSocketLike["onopen"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  onerror: WebSocketLike["onerror"] = null;
  onclose: WebSocketLike["onclose"] = null;
  constructor() {
    setTimeout(() => this.onopen?.({}), 0);
  }
  send(data: string): void {
    const begin = (JSON.parse(data) as { beginExclusive: number }).beginExclusive;
    ScriptedWs.opened.push(begin);
    const emit = (m: unknown) => setTimeout(() => this.onmessage?.({ data: JSON.stringify(m) }), 0);
    if (ScriptedWs.pruned && begin < PRUNED_BELOW) {
      emit({ code: "PARTICIPANT_PRUNED_DATA_ACCESSED", cause: `Transactions request from ${begin} to end precedes pruned offset ${PRUNED_BELOW}`, errorCategory: 9 });
      return;
    }
    for (const tx of txs) if (tx.offset > begin) emit({ update: { Transaction: { value: tx } } });
    const last = Math.max(begin, ...txs.map((t) => t.offset));
    emit({ update: { OffsetCheckpoint: { value: { offset: last + 5, synchronizerTimes: [] } } } });
  }
  close(): void {
    this.readyState = 3;
  }
}

describe.skipIf(!RUN)("projector loop (Postgres + scripted socket)", () => {
  const db = getDb()!;
  beforeEach(async () => {
    await ensureSchema();
    await indexWriter(db).truncate();
    ScriptedWs.opened = [];
    ScriptedWs.pruned = false;
    snapshots.length = 0;
  });
  afterAll(async () => {
    await db.end();
  });

  /** `prunedAt`: what `/v2/state/latest-pruned-offsets` answers (an Error when it cannot be read). */
  const snapshots: number[] = [];
  const ledger = (acs: CreatedEvent[] = [], prunedAt: number | Error = PRUNED_BELOW) =>
    ({
      auth: noAuth(),
      ledgerEnd: async () => PRUNED_BELOW + 7,
      latestPrunedOffset: async () => {
        if (prunedAt instanceof Error) throw prunedAt;
        return prunedAt;
      },
      async *iterateActiveContracts(o: { activeAtOffset: number }) {
        snapshots.push(o.activeAtOffset);
        yield { contracts: acs.map((createdEvent) => ({ createdEvent, synchronizerId: "s" })), activeAtOffset: o.activeAtOffset, nextPageToken: undefined };
      },
    }) as unknown as LedgerClient;

  it("applies every update once, advances on the checkpoint, and a second run from the cursor re-applies nothing", async () => {
    const p = startProjectorLoop({ db, ledger: ledger(), baseUrl: "http://sandbox", auth: noAuth(), party: VENUE, log: () => {}, WebSocket: ScriptedWs });
    const last = txs[txs.length - 1]!.offset;
    await p.waitFor(last + 5, 10_000);
    await p.stop();
    expect(p.stats.applied).toBe(txs.length);
    const [updates] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM idx_updates`;
    expect(updates?.n).toBe(txs.length);

    // Replay the same stream from 0 over the populated projection: every update is at or below the cursor.
    await db`UPDATE idx_cursor SET ledger_offset = 0`;
    const again = startProjectorLoop({ db, ledger: ledger(), baseUrl: "http://sandbox", auth: noAuth(), party: VENUE, log: () => {}, WebSocket: ScriptedWs });
    await again.waitFor(last + 5, 10_000);
    await again.stop();
    expect(again.stats.applied).toBe(0);
    expect(again.stats.skipped).toBe(txs.length);
    const [f] = await db<{ fills: number }[]>`SELECT count(*)::int AS fills FROM idx_fills`;
    // One accept; the sale is skipped because the sold leg's own accept is not among the fixtures (no row to sell).
    expect(f?.fills).toBe(1);
  });

  it("on a pruned participant, snapshots the ACS at the pruning offset and streams every later update from there", async () => {
    ScriptedWs.pruned = true;
    const acs = fixtures.accept!.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));
    const logs: string[] = [];
    const p = startProjectorLoop({ db, ledger: ledger(acs), baseUrl: "http://sandbox", auth: noAuth(), party: VENUE, log: (l) => logs.push(l), WebSocket: ScriptedWs, restartMs: 10 });
    await p.waitFor(PRUNED_BELOW + 5, 10_000);
    await p.stop();
    const cursor = await indexWriter(db).cursor("venue");
    expect(cursor).toMatchObject({ bootstrap: "acs", historyFromOffset: PRUNED_BELOW });
    // The snapshot is taken at the pruning offset, not at the ledger end, and the stream resumes from that same offset.
    expect(snapshots).toEqual([PRUNED_BELOW]);
    expect(ScriptedWs.opened).toEqual([0, PRUNED_BELOW]);
    const legs = await db<{ origin: string }[]>`SELECT origin FROM idx_legs`;
    expect(legs.length).toBe(2);
    expect(legs.every((l) => l.origin === "snapshot")).toBe(true);
    const [g] = await db<{ fills: number }[]>`SELECT count(*)::int AS fills FROM idx_fills`;
    expect(g?.fills).toBe(0);
    expect(logs.some((l) => l.includes(`at offset ${PRUNED_BELOW} (the pruning offset)`) && l.includes("earlier history is not indexed"))).toBe(true);
  });

  it("falls back to the ledger end when the pruning offset cannot be read", async () => {
    ScriptedWs.pruned = true;
    const logs: string[] = [];
    const p = startProjectorLoop({ db, ledger: ledger([], new Error("503")), baseUrl: "http://sandbox", auth: noAuth(), party: VENUE, log: (l) => logs.push(l), WebSocket: ScriptedWs, restartMs: 10 });
    await p.waitFor(PRUNED_BELOW + 7, 10_000);
    await p.stop();
    expect(await indexWriter(db).cursor("venue")).toMatchObject({ bootstrap: "acs", historyFromOffset: PRUNED_BELOW + 7 });
    expect(snapshots).toEqual([PRUNED_BELOW + 7]);
    expect(ScriptedWs.opened).toEqual([0, PRUNED_BELOW + 7]);
    expect(logs.some((l) => l.includes("pruning offset unreadable"))).toBe(true);
  });
});
