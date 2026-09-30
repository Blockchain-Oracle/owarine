/**
 * Going live starts the desk's figures afresh (C8i), against a real Postgres (`DATABASE_URL`); skipped without one.
 * C8g's live desk read "+$47.50 since your money went in" and "−95.0% since the first check" after a 50-credit deposit:
 * the runner compared the live desk with the last PRACTICE snapshot ($1,000 of paper), read the paper as money that
 * had left, and scaled the loss baseline down to 2.50; the chart ran on from the practice series. What is in doubt here
 * is the database's part: which snapshots a live desk's reads count from, and the baseline a discovered desk keeps.
 */
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { sslFor } from "./client";
import { deskQueries, type DeskQueries } from "./desk-queries";

const url = process.env.DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("a desk's live figures count from going live (real Postgres)", () => {
  const db = postgres(url ?? "postgres://unused", { max: 2, ssl: url ? sslFor(url) : false, onnotice: () => undefined });
  const q: DeskQueries = deskQueries(db);
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const made: string[] = [];
  const t0 = 1_800_000_000;
  const snap = (deskId: string, atSec: number, totalE6: string) => q.saveSnapshot({ deskId, takenAtSec: atSec, totalE6, usdcE6: totalE6, holdings: [], unpriced: [] });
  const practice = async (owner: string) => {
    const desk = await q.createPracticeDesk({ owner, cluster: "localnet", mandateBody: { preset: "ailabs" }, fingerprint: `0x${"ab".repeat(32)}`, signer: owner, signature: "sig", nowSec: t0 });
    made.push(desk.id);
    await snap(desk.id, t0 + 3_600, "1000000000");
    await snap(desk.id, t0 + 7_200, "1012500000");
    await q.setDrawdownBaseline({ deskId: desk.id, baselineE6: "1000000000", nowSec: t0 + 7_200 });
    return desk;
  };

  afterAll(async () => {
    for (const id of made) {
      for (const table of ["desk_events", "desk_wakes", "desk_snapshots", "desk_paper", "desk_mandates"]) await db.unsafe(`DELETE FROM ${table} WHERE desk_id = '${id}'`);
      await db`DELETE FROM desks WHERE id = ${id}::uuid`;
    }
    await db.end();
  });

  it("a practice desk reads its whole paper series", async () => {
    const desk = await practice(`golive-p${tag}`);
    expect((await q.latestSnapshot(desk.id))?.totalE6).toBe("1012500000");
    expect((await q.snapshotSeries(desk.id)).map((p) => p.totalE6)).toEqual(["1000000000", "1012500000"]);
  });

  it("Go live (attach) drops the practice paper from the live desk's value, baseline and chart", async () => {
    const desk = await practice(`golive-a${tag}`);
    await q.attachLiveDesk({ deskId: desk.id, address: `addr-${tag}`, operator: `op-${tag}`, mode: "ask_first", nowSec: t0 + 8_000 });
    // Nothing before going live: the runner sees no previous snapshot, so a first deposit is not an "outside change".
    expect(await q.latestSnapshot(desk.id)).toBeNull();
    expect(await q.snapshotSeries(desk.id)).toEqual([]);
    expect((await q.getDeskById(desk.id))?.drawdownBaselineE6).toBeNull();
    await snap(desk.id, t0 + 8_060, "50000000");
    expect((await q.latestSnapshot(desk.id))?.totalE6).toBe("50000000");
    expect((await q.snapshotSeries(desk.id)).map((p) => p.totalE6)).toEqual(["50000000"]);
  });

  it("a practice row the runner discovers live starts afresh the same way, once", async () => {
    const owner = `golive-d${tag}`;
    const desk = await practice(owner);
    const live = await q.registerLiveDesk({ owner, cluster: "localnet", address: `addr-d${tag}`, operator: `op-${tag}`, mode: "ask_first", nowSec: t0 + 9_000 });
    expect(live.id).toBe(desk.id);
    expect(live.drawdownBaselineE6).toBeNull();
    expect(await q.latestSnapshot(desk.id)).toBeNull();
    await snap(desk.id, t0 + 9_060, "50000000");
    await q.setDrawdownBaseline({ deskId: desk.id, baselineE6: "50000000", nowSec: t0 + 9_060 });
    // Registered again (a later discovery pass): an already-live desk keeps its baseline and its series.
    await q.registerLiveDesk({ owner, cluster: "localnet", address: `addr-d${tag}`, operator: `op-${tag}`, mode: "ask_first", nowSec: t0 + 9_600 });
    expect((await q.getDeskById(desk.id))?.drawdownBaselineE6).toBe("50000000");
    expect((await q.snapshotSeries(desk.id)).map((p) => p.totalE6)).toEqual(["50000000"]);
  });
});
