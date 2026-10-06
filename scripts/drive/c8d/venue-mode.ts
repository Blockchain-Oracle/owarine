/**
 * C8d part, venue mode (C-DAML-02): the operator sets reduce-only through ops' admin route; new risk is refused with
 * the venue's words (a firm quote, a range ticket, Earn supply), a seat's way out is not (an exit sells its leg back),
 * the roller holds new Windows, `/session`, `/api/venue` and `/status` say so; then open again and a quote lands.
 */
import { appMarketId, opsNonce, opsSignature, OPS_NONCE_HEADER, OPS_SIG_HEADER, OPS_TS_HEADER } from "@agari/markets/server";
import { decodeLeg } from "@agari/markets/ops/canton";
import { firmQuote, quotingWindow, randomUUID, seat, sleep, TEMPLATE_IDS, type Ctx } from "./common";

const MODE_PATH = "/internal/admin/venue-mode";

/** One admin call, signed with OPS_ADMIN_SECRET as ops' internal server checks it. */
export async function admin(ctx: Ctx, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, any> }> {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret) throw new Error("OPS_ADMIN_SECRET is not set in the drive's environment");
  const text = JSON.stringify(body);
  const ts = Date.now();
  const nonce = opsNonce();
  const res = await fetch(`${ctx.opsUrl}${MODE_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", [OPS_TS_HEADER]: String(ts), [OPS_NONCE_HEADER]: nonce, [OPS_SIG_HEADER]: opsSignature(secret, ts, nonce, "POST", MODE_PATH, text) },
    body: text,
  });
  return { status: res.status, json: ((await res.json().catch(() => ({}))) ?? {}) as Record<string, any> };
}

const words = (j: Record<string, any>) => `${j.diagnosis?.kind ?? j.kind ?? "?"}: ${String(j.diagnosis?.technical ?? "").slice(0, 150)}`;

export async function runVenueMode(ctx: Ctx): Promise<void> {
  const { step, web, kit } = ctx;
  const B = await seat(ctx, "B");
  let legMarket = "";
  await step("venue mode: open, seat B buys a BTC-5m leg to exit later", async () => {
    const now = await admin(ctx, {});
    if (now.json.mode !== "open") return { outcome: "fail", detail: `mode read ${now.status} ${JSON.stringify(now.json).slice(0, 120)}` };
    const { win, q } = await firmQuote(ctx, B, "BTC-5m", "up", 3_000_000n);
    const acc = await web.call(B, "POST", `/api/ledger/quotes/${q.cid}/accept`, { commandId: randomUUID() });
    if (acc.status !== 200) return { outcome: "fail", detail: `accept ${acc.status} ${words(acc.json)}` };
    legMarket = win.data.marketId;
    const leg = (await kit.acs(B.party!, TEMPLATE_IDS.Leg, decodeLeg)).find((l) => l.data.marketId === legMarket && l.data.owner === B.party);
    return { outcome: leg ? "pass" : "fail", detail: `mode open (from ${now.json.source}); ${legMarket}: ${q.data.lots} lots Up`, evidence: leg ? `update ${await kit.updateIdAt(B.party!, leg.offset)} (Quote_Accept)` : "—" };
  });

  await step("venue mode: the operator sets reduce-only (admin route, audit log)", async () => {
    const set = await admin(ctx, { mode: "reduce-only", reason: "C8d drive", by: "c8d-drive" });
    const session = (await (await fetch(`${ctx.opsUrl}/session`)).json()) as { venueMode?: { mode: string; reason: string | null } };
    const venue = await web.call(null, "GET", "/api/venue/facts");
    const ok = set.json.mode === "reduce-only" && set.json.source === "log" && session.venueMode?.mode === "reduce-only";
    return { outcome: ok ? "pass" : "fail", detail: `admin → ${set.json.mode} (${set.json.source}); /session.venueMode ${session.venueMode?.mode} (${session.venueMode?.reason}); /api/venue/facts mode ${venue.json.venue?.mode ?? venue.json.value?.venue?.mode ?? "?"}`, evidence: `POST ops ${MODE_PATH} (OPS_ADMIN_SECRET) · venue_mode_log` };
  });

  await step("venue mode: reduce-only refuses new risk — a firm quote, a range ticket, Earn supply", async () => {
    const win = await quotingWindow(ctx, "BTC-5m");
    if (!win) return { outcome: "fail", detail: "no BTC-5m Window quoting" };
    const marketId = appMarketId(win.data.marketId);
    const q = await web.call(B, "POST", "/api/ledger/quotes", { marketId, side: "down", stakeBase: 2_000_000n, displayedMaxCostBase: 3_000_000n });
    const r = await web.call(B, "POST", "/api/ledger/tickets/range", { op: "issue", marketId, side: "inside", lowE8: win.data.cashUnit, highE8: 10n ** 15n, maxPayoutBase: 4_000_000n, maxStakeBase: 3_000_000n, moonshot: false });
    const e = await web.call(B, "POST", "/api/ledger/tickets/earn", { op: "supply", reserve: "range", amountBase: 5_000_000n });
    const refusedAll = [q, r, e].every((x) => x.json.diagnosis?.kind === "market-not-trading" || String(x.json.diagnosis?.technical ?? "").includes("reduce-only"));
    return { outcome: refusedAll ? "pass" : "fail", detail: `quote ${q.status} ${words(q.json)} | range ${r.status} ${words(r.json)} | supply ${e.status} ${words(e.json)}`, evidence: "POST /api/ledger/quotes, /tickets/range, /tickets/earn" };
  });

  await step("venue mode: reduce-only lets seat B exit — its BTC-5m leg sells back", async () => {
    const leg = (await kit.acs(B.party!, TEMPLATE_IDS.Leg, decodeLeg)).find((l) => l.data.marketId === legMarket && l.data.owner === B.party);
    if (!leg) return { outcome: "fail", detail: "seat B holds no BTC-5m leg" };
    const contractsRaw = leg.data.lots * 1000n * leg.data.cashUnit;
    const x = await web.call(B, "POST", "/api/ledger/exit-quotes", { marketId: appMarketId(legMarket), side: "up", contractsRaw, displayedMinProceedsBase: 0n });
    if (x.json.kind !== "quote") return { outcome: "fail", detail: `exit quote ${x.status} ${words(x.json)}` };
    const [first, ...rest] = x.json.quoteCids as string[];
    const a = await web.call(B, "POST", `/api/ledger/exit-quotes/${first}/accept`, { commandId: randomUUID(), with: rest });
    return { outcome: a.status === 200 ? "pass" : "fail", detail: `exit of ${leg.data.lots} lots: ${a.status} ${a.json.updateId ? "sold" : words(a.json)}`, evidence: a.json.updateId ? `update ${a.json.updateId} (BuyQuote_Accept)` : "—" };
  });

  await step("venue mode: the roller holds new Windows (lane states say why)", async () => {
    await sleep(75_000);
    const session = (await (await fetch(`${ctx.opsUrl}/session`)).json()) as { lanes?: Record<string, string> };
    const held = Object.entries(session.lanes ?? {}).filter(([, s]) => s.startsWith("paused: venue reduce-only"));
    return { outcome: held.length > 0 ? "pass" : "fail", detail: held.length ? `${held.length} lane(s): ${held.slice(0, 2).map(([k, s]) => `${k} "${s}"`).join("; ")}` : `no lane held: ${JSON.stringify(session.lanes).slice(0, 160)}`, evidence: "GET ops /session.lanes" };
  });

  await step("venue mode: open again, and a quote lands", async () => {
    const set = await admin(ctx, { mode: "open", reason: "C8d drive done", by: "c8d-drive" });
    const { q } = await firmQuote(ctx, B, "BTC-1m", "down", 2_000_000n, 120_000);
    return { outcome: set.json.mode === "open" ? "pass" : "fail", detail: `admin → ${set.json.mode}; a BTC-1m quote issued (${q.data.lots} lots Down, ${q.cid.slice(0, 12)}…)`, evidence: `update ${await kit.updateIdAt(B.party!, q.offset)} (Desk_IssueQuote)` };
  });
}
