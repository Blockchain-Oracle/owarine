/**
 * C8d part, the strategy runner rests while no Window trades (C-S24b): the operator pauses the venue (K-264), the roller
 * holds every new Window, and once the last trading Window has closed the runner records "resting" for its strategies
 * (no price read, no model call, a heartbeat every five minutes) instead of scanning; then the venue opens again and
 * the runner scans again. Waits up to `--rest-min` minutes (default 70) for the last hourly Window to close.
 */
import postgres from "postgres";
import { sleep, type Ctx } from "./common";
import { admin } from "./venue-mode";

const RESTING = "resting: no Window is trading on any lane";

export async function runRest(ctx: Ctx): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (the runner's heartbeats) is not set in the drive's environment");
  const sql = postgres(url, { max: 1 });
  const minutes = Number(process.argv[process.argv.indexOf("--rest-min") + 1]) || 70;
  try {
    const set = await admin(ctx, { mode: "paused", reason: "C8d runner rest", by: "c8d-drive" });
    const since = Math.floor(Date.now() / 1000);
    await ctx.step("C-S24b: with the venue paused and no Window trading, the runner rests", async () => {
      if (set.json.mode !== "paused") return { outcome: "fail", detail: `admin answered ${set.status} ${JSON.stringify(set.json).slice(0, 120)}` };
      const until = Date.now() + minutes * 60_000;
      while (Date.now() < until) {
        const rows = await sql<{ strategy_id: string; why: string; tick_at: Date }[]>`SELECT strategy_id, why, tick_at FROM runner_heartbeats WHERE why LIKE ${`${RESTING}%`} AND tick_at >= to_timestamp(${since}) ORDER BY tick_at DESC LIMIT 5`;
        if (rows.length) {
          const session = (await (await fetch(`${ctx.opsUrl}/session`)).json()) as { lanes?: Record<string, string> };
          const held = Object.values(session.lanes ?? {}).filter((x) => x.startsWith("paused: venue paused")).length;
          return { outcome: "pass", detail: `${rows.length} strategy heartbeat(s) "${rows[0]!.why}" at ${rows[0]!.tick_at.toISOString().slice(11, 19)}Z; ${held} lane(s) held "paused: venue paused"`, evidence: "runner_heartbeats · ops /session.lanes" };
        }
        await sleep(20_000);
      }
      return { outcome: "fail", detail: `no resting heartbeat in ${minutes} min` };
    });
  } finally {
    const open = await admin(ctx, { mode: "open", reason: "C8d runner rest done", by: "c8d-drive" }).catch(() => null);
    ctx.log(`venue mode back to ${open?.json.mode ?? "unknown"}`);
    await sql.end();
  }
}
