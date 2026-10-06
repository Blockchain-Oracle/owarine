/**
 * C8d part, products against the oracle quorum (C-OPS-09, C-DAML-03): seat C opens two 3x boosts on one BTC-5m Window
 * (the cheap side, whose barrier sits near the price, and the dear side) and a range ticket on it. The projection
 * counts the three as the Window's dependents; the leverage keeper reports the book; the venue's ticket keeper knocks
 * out a boost whose barrier the quorum crossed and settles the rest at the Window's resolution; every dependent closes
 * with the choice that ended it.
 */
import postgres from "postgres";
import { appMarketId } from "@agari/markets/server";
import { quotingWindow, randomUUID, seat, sleep, type Ctx } from "./common";

type Sql = postgres.Sql;
interface DepRow { product_cid: string; product: string; how: string | null; opened_update_id: string; closed_update_id: string | null }

const rowsFor = (sql: Sql, termsCid: string) =>
  sql<DepRow[]>`SELECT product_cid, product, how, opened_update_id, closed_update_id FROM idx_dependents WHERE terms_cid = ${termsCid} ORDER BY opened_offset`;

export async function runProducts(ctx: Ctx): Promise<void> {
  const { step, web } = ctx;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (the projection) is not set in the drive's environment");
  const sql = postgres(url, { max: 2 });
  const C = await seat(ctx, "C");
  let termsCid = "";
  let expirySec = 0;
  try {
    await step("products: seat C opens two 3x boosts (cheap and dear side) and a range ticket on one BTC-5m Window", async () => {
      let win = await quotingWindow(ctx, "BTC-5m", 200);
      for (let i = 0; !win && i < 40; i++) (await sleep(5_000), (win = await quotingWindow(ctx, "BTC-5m", 200)));
      if (!win) return { outcome: "fail", detail: "no BTC-5m Window with 200 s left" };
      termsCid = win.cid;
      expirySec = win.data.expirySec;
      const marketId = appMarketId(win.data.marketId);
      const preview = async (side: "up" | "down") => (await web.call(C, "POST", "/api/ledger/tickets/boost", { op: "preview", marketId, side, stakeBase: 4_000_000n, leverageBps: 30_000 })).json;
      const [up, down] = await Promise.all([preview("up"), preview("down")]);
      const price = (p: Record<string, any>) => (p.kind === "preview" ? BigInt(p.quote.priceRaw) : 10n ** 9n);
      const cheap: "up" | "down" = price(up) <= price(down) ? "up" : "down";
      const notes: string[] = [];
      for (const side of [cheap, cheap === "up" ? "down" : "up"] as const) {
        const issue = await web.call(C, "POST", "/api/ledger/tickets/boost", { op: "issue", marketId, side, stakeBase: 4_000_000n, leverageBps: 30_000, minQuantityRaw: 0n });
        if (issue.json.kind !== "quote") return { outcome: "fail", detail: `boost ${side} issue: ${issue.status} ${JSON.stringify(issue.json).slice(0, 180)}` };
        const acc = await web.call(C, "POST", "/api/ledger/tickets/boost/accept", { commandId: randomUUID(), quoteCid: issue.json.quoteCid });
        if (acc.status !== 200) return { outcome: "fail", detail: `boost ${side} accept: ${acc.status} ${JSON.stringify(acc.json).slice(0, 180)}` };
        notes.push(`${side} 3x at ${(Number(issue.json.quote.priceRaw) / 1e6).toFixed(2)} (front ${(Number(issue.json.quote.frontedBase) / 1e6).toFixed(2)})`);
      }
      const basis = (await web.call(C, "POST", "/api/ledger/tickets/range", { op: "basis", marketId })).json;
      const open = BigInt(basis.openingPrint ?? 0);
      const r = await web.call(C, "POST", "/api/ledger/tickets/range", { op: "issue", marketId, side: "inside", lowE8: (open * 999n) / 1000n, highE8: (open * 1001n) / 1000n, maxPayoutBase: 4_000_000n, maxStakeBase: 4_000_000n, moonshot: false });
      if (r.json.kind === "quote") {
        const acc = await web.call(C, "POST", "/api/ledger/tickets/range/accept", { commandId: randomUUID(), quoteCid: r.json.quoteCid });
        notes.push(`range inside ±0.1% (${acc.status === 200 ? "accepted" : `accept ${acc.status}`})`);
      } else notes.push(`range: ${r.json.kind ?? r.status} ${String(r.json.diagnosis?.technical ?? "").slice(0, 80)}`);
      return { outcome: "pass", detail: `${win.data.marketId}: ${notes.join("; ")}`, evidence: `POST /api/ledger/tickets/{boost,range} + accept as ${C.party!.split("::")[0]}` };
    });
    if (!termsCid) return;

    await step("dependents: the projection counts the Window's open products (C-DAML-03)", async () => {
      let rows: DepRow[] = [];
      for (let i = 0; i < 20 && rows.filter((r) => !r.how).length < 2; i++) (await sleep(3_000), (rows = await rowsFor(sql, termsCid)));
      const open = rows.filter((r) => !r.how);
      return { outcome: open.length >= 2 ? "pass" : "fail", detail: `${open.length} open on terms ${termsCid.slice(0, 12)}…: ${open.map((r) => r.product).join(", ")}`, evidence: open[0] ? `update ${open[0].opened_update_id} (idx_dependents)` : "—" };
    });

    await step("leverage keeper: reports the Boost book against the quorum (ops /health)", async () => {
      await sleep(25_000);
      const health = (await (await fetch(`${ctx.opsUrl}/health`)).json()) as { actors: { actor: string; lastWhy: string }[] };
      const why = health.actors.find((a) => a.actor === "leverage-keeper")?.lastWhy ?? "";
      return { outcome: /live boost/.test(why) ? "pass" : "fail", detail: why.slice(0, 220), evidence: "GET ops /health (leverage-keeper)" };
    });

    await step("boosts end on the quorum: knocked out past the barrier, or settled at resolution; every dependent closes", async () => {
      const until = (expirySec + 240) * 1000;
      let rows: DepRow[] = [];
      while (Date.now() < until) {
        rows = await rowsFor(sql, termsCid);
        if (rows.length && rows.every((r) => r.how)) break;
        await sleep(10_000);
      }
      const ended = rows.map((r) => `${r.product} ${r.how ?? "still open"}`);
      const knock = rows.find((r) => r.how === "Boost_KnockOut");
      const settled = rows.find((r) => r.how === "Boost_Settle" || r.how === "Round_Settle");
      const allClosed = rows.length > 0 && rows.every((r) => r.how);
      return {
        outcome: allClosed ? "pass" : "fail",
        detail: ended.join("; "),
        evidence: [knock ? `knock-out update ${knock.closed_update_id}` : null, settled ? `settle update ${settled.closed_update_id}` : null].filter(Boolean).join(" · ") || "—",
      };
    });
  } finally {
    await sql.end();
  }
}

/**
 * A knock-out on purpose: on each BTC-5m Window with time left, take the cheap side at 3x (when it is priced at or
 * under `--knockout-max`, default 0.60) and watch the ticket keeper post `Boost_KnockOut` at the first quorum print
 * past its barrier. Tries Window after Window for up to `--knockout-min` minutes (default 30).
 */
export async function runKnockout(ctx: Ctx): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (the projection) is not set in the drive's environment");
  const sql = postgres(url, { max: 2 });
  const C = await seat(ctx, "C");
  const minutes = Number(process.argv[process.argv.indexOf("--knockout-min") + 1]) || 30;
  // The cheap side's price ceiling: a 3x boost's barrier sits where its side has lost about a quarter of its price, so
  // any side under 0.6 can be knocked out by an ordinary five-minute move; lower ceilings wait longer for a Window.
  const ceiling = Number(process.argv[process.argv.indexOf("--knockout-max") + 1]) || 0.6;
  const until = Date.now() + minutes * 60_000;
  const tried: string[] = [];
  try {
    await ctx.step("knock-out: a 3x boost on the cheap side is knocked out at a quorum print past its barrier", async () => {
      while (Date.now() < until) {
        const win = await quotingWindow(ctx, "BTC-5m", 150);
        if (!win || tried.includes(win.cid)) {
          await sleep(5_000);
          continue;
        }
        const marketId = appMarketId(win.data.marketId);
        const look = async (side: "up" | "down") => (await ctx.web.call(C, "POST", "/api/ledger/tickets/boost", { op: "preview", marketId, side, stakeBase: 4_000_000n, leverageBps: 30_000 })).json;
        const [up, down] = await Promise.all([look("up"), look("down")]);
        const pick = [["up", up], ["down", down]].map(([s, p]) => ({ side: s as "up" | "down", price: (p as Record<string, any>).kind === "preview" ? Number((p as Record<string, any>).quote.priceRaw) / 1e6 : 1 })).sort((a, b) => a.price - b.price)[0]!;
        if (pick.price > ceiling || pick.price < 0.06) {
          await sleep(5_000);
          continue;
        }
        tried.push(win.cid);
        const issue = await ctx.web.call(C, "POST", "/api/ledger/tickets/boost", { op: "issue", marketId, side: pick.side, stakeBase: 4_000_000n, leverageBps: 30_000, minQuantityRaw: 0n });
        if (issue.json.kind !== "quote") continue;
        const acc = await ctx.web.call(C, "POST", "/api/ledger/tickets/boost/accept", { commandId: randomUUID(), quoteCid: issue.json.quoteCid });
        if (acc.status !== 200) continue;
        ctx.log(`boost ${pick.side} 3x at ${pick.price.toFixed(2)} on ${win.data.marketId}; waiting for its end`);
        let row: DepRow | undefined;
        while (Date.now() < (win.data.expirySec + 200) * 1000) {
          row = (await rowsFor(sql, win.cid)).find((r) => r.product === (pick.side === "up" ? "boost" : "short") && r.how);
          if (row) break;
          await sleep(5_000);
        }
        if (row?.how === "Boost_KnockOut") {
          return { outcome: "pass", detail: `${win.data.marketId}: ${pick.side} 3x bought at ${pick.price.toFixed(2)}, knocked out by the venue's keeper (tries: ${tried.length})`, evidence: `update ${row.closed_update_id} (Boost_KnockOut)` };
        }
        ctx.log(`${win.data.marketId}: ended ${row?.how ?? "not yet"}; trying the next Window`);
      }
      return { outcome: "fail", detail: `no knock-out in ${minutes} min over ${tried.length} Window(s)` };
    });
  } finally {
    await sql.end();
  }
}
