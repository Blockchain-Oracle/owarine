/**
 * C2e parts (abu-pm-main 0.5.2, K-315): a private call's payout lands in the seat's private bucket, on win, loss and void,
 * and its receipt names the bucket; the public balance never moves.
 *
 *   payout  seat P moves credits in, places an Up and a Down private call on one Window (one of them wins), and waits for
 *           the venue to settle both: the private balance grows by the winner's payout at settlement, with no cash-out;
 *           both receipts say `paidInto = "private"`; Cash out answers `done` and moves nothing; the receipt is never
 *           published; the seat's history does not list them.
 *   void    one more private call on a BTC-5m Window; the drive prints `C2E-VOID-PLACED` with the Window's close deadline,
 *           the operator stops ops before expiry and starts it again after that deadline (no close print can be counted,
 *           so the resolver voids the Window), and the drive waits for the void settle: stake + fee back in private.
 *   out     the private balance moves back to the seat's balance.
 *   guard   ops itself refuses to "cash out" a receipt the settle already paid into the private bucket (moving it again
 *           would take the seat's public cash): every such receipt of the seat parties is tried once, straight at ops
 *           over HMAC (`OPS_INTERNAL_SECRET`), and nothing may move.
 */
import { formatCadence } from "@agari/core/copy";
import { CLUSTER_ID } from "@agari/core/constants";
import { privateOpenMessage } from "@agari/core/private";
import { formatBaseUnits } from "@agari/core/units";
import { appMarketId, createOpsClient } from "@agari/markets/server";
import { credits, quotingWindow, randomUUID, seat, sleep, TEMPLATE_IDS, type Ctx } from "../c8d/common";

interface Placed {
  pairId: string;
  marketId: string;
  expirySec: number;
  costBase: bigint;
  updateId: string;
  side: "up" | "down";
}

interface PositionRow {
  pairId: string;
  status: string;
  result: string | null;
  payoutBase: string | null;
  paidInto?: string | null;
}

type Receipt = { payout: string; paidInto: string | null; pairId: string; resolved: string | null };

const STAKE = 5_000_000n;

const privateBalance = async (ctx: Ctx, name: string) => BigInt((await ctx.web.call(await seat(ctx, name), "GET", "/api/private/balance")).json.balanceBase);
const rows = async (ctx: Ctx, name: string): Promise<PositionRow[]> => (await ctx.web.call(await seat(ctx, name), "GET", "/api/private/balance")).json.positions ?? [];

/** The seat's settlement receipt for a pair, as the seat reads it on the ledger, with the update that created it. */
async function receiptOf(ctx: Ctx, party: string, pairId: string): Promise<(Receipt & { updateId: string }) | null> {
  const all = await ctx.kit.acs(party, TEMPLATE_IDS.SettlementReceipt, (a) => a as Receipt);
  const hit = all.find((r) => r.data.pairId === pairId);
  return hit ? { ...hit.data, updateId: await ctx.kit.updateIdAt(party, hit.offset) } : null;
}

/** One signed private call through `/api/private/open` on the lane's quoting Window. */
async function placePrivate(ctx: Ctx, name: string, seriesKey: string, side: "up" | "down", leadSec: number, cadenceSec: number): Promise<Placed> {
  const s = await seat(ctx, name);
  const status = (await ctx.web.call(null, "GET", "/api/private/status")).json;
  let win = await quotingWindow(ctx, seriesKey, leadSec);
  for (let i = 0; !win && i < 80; i++) (await sleep(5_000), (win = await quotingWindow(ctx, seriesKey, leadSec)));
  if (!win) throw new Error(`no ${seriesKey} Window with ${leadSec} s to lock`);
  const marketId = appMarketId(win.data.marketId);
  const issuedAtMs = Date.now();
  const text = privateOpenMessage({
    owner: s.address, contract: status.contract, chainId: CLUSTER_ID.localnet, marketId, asset: "BTC", cadenceText: formatCadence(cadenceSec), expirySec: win.data.expirySec, side,
    stakeText: formatBaseUnits(STAKE, 6, { maxDp: 6, minDp: 0, group: false }), symbol: "credits", issuedAtMs,
  });
  const r = await ctx.web.call(s, "POST", "/api/private/open", { owner: s.address, marketId, side, stakeBase: STAKE.toString(), minQuantityRaw: "0", issuedAtMs, signature: await s.sign(text) });
  if (r.json.status !== "placed") throw new Error(`private open: ${r.status} ${JSON.stringify(r.json).slice(0, 220)}`);
  const p = r.json.position;
  return { pairId: p.pairId, marketId: p.marketId, expirySec: p.expirySec, costBase: BigInt(p.costBase), updateId: r.json.updateId, side };
}

/** Wait until every pair is home in the private list (credited), or the deadline passes. */
async function waitHome(ctx: Ctx, name: string, pairs: readonly string[], untilMs: number): Promise<PositionRow[]> {
  for (;;) {
    const got = (await rows(ctx, name)).filter((r) => pairs.includes(r.pairId));
    if (got.length === pairs.length && got.every((r) => r.status === "credited")) return got;
    if (Date.now() > untilMs) return got;
    await sleep(8_000);
  }
}

export async function runPayout(ctx: Ctx): Promise<void> {
  const { step, web } = ctx;
  const P = await seat(ctx, "P");
  const publicStart = await web.balance(P);
  let calls: Placed[] = [];
  let privateAfterCalls = 0n;
  let winner: Placed | null = null;

  await step("C2e payout: seat P moves 30 credits into its private bucket", async () => {
    const r = await web.call(P, "POST", "/api/private/balance", { commandId: randomUUID(), op: "in", amountBase: "30000000" });
    const pub = await web.balance(P);
    const priv = await privateBalance(ctx, "P");
    const ok = r.json.kind === "moved" && publicStart - pub === 30_000_000n && priv === 30_000_000n;
    return { outcome: ok ? "pass" : "fail", detail: `public ${credits(publicStart)} → ${credits(pub)}; private ${credits(priv)}`, evidence: `update ${r.json.updateId} (VenueCash_Withdraw + VenueAccount_Credit "private")` };
  });

  await step("C2e payout: an Up and a Down private call on one BTC-1m Window, paid from private only", async () => {
    const up = await placePrivate(ctx, "P", "BTC-1m", "up", 20, 60);
    const down = await placePrivate(ctx, "P", "BTC-1m", "down", 5, 60);
    calls = [up, down];
    privateAfterCalls = await privateBalance(ctx, "P");
    const pub = await web.balance(P);
    const same = up.marketId === down.marketId;
    const ok = same && privateAfterCalls === 30_000_000n - up.costBase - down.costBase && pub === publicStart - 30_000_000n;
    return { outcome: ok ? "pass" : "fail", detail: `${up.marketId}${same ? "" : ` / ${down.marketId}`}: Up ${credits(up.costBase)}, Down ${credits(down.costBase)}; private ${credits(privateAfterCalls)}; public ${credits(pub)} (unchanged)`, evidence: `updates ${up.updateId}, ${down.updateId} (Quote_Accept, beneficiaryRef "private")` };
  });
  if (calls.length !== 2) return;

  await step("C2e payout: the venue settles both into the private bucket at once; the public balance does not move", async () => {
    const got = await waitHome(ctx, "P", calls.map((c) => c.pairId), (calls[0]!.expirySec + 300) * 1000);
    const priv = await privateBalance(ctx, "P");
    const pub = await web.balance(P);
    const paid = got.reduce((s, r) => s + BigInt(r.payoutBase ?? "0"), 0n);
    const receipts = await Promise.all(calls.map((c) => receiptOf(ctx, P.party!, c.pairId)));
    const named = receipts.every((r) => r?.paidInto === "private");
    const ok = got.length === 2 && got.every((r) => r.status === "credited" && r.paidInto === "private") && priv - privateAfterCalls === paid && paid > 0n && pub === publicStart - 30_000_000n && named;
    const lines = got.map((r) => `${calls.find((c) => c.pairId === r.pairId)!.side} ${r.result} ${credits(BigInt(r.payoutBase ?? "0"))}`).join(", ");
    winner = calls.find((c) => got.some((r) => r.pairId === c.pairId && BigInt(r.payoutBase ?? "0") > 0n)) ?? null;
    return { outcome: ok ? "pass" : "fail", detail: `${lines}; private ${credits(privateAfterCalls)} → ${credits(priv)}; public ${credits(pub)} (unchanged); receipts paidInto ${receipts.map((r) => r?.paidInto ?? "—").join(", ")}`, evidence: `settle updates ${receipts.map((r) => r?.updateId ?? "—").join(", ")} (Leg_Settle → VenueCash "private" + SettlementReceipt)` };
  });

  await step("C2e payout: Cash out has nothing to move; the receipt is never published; history does not list the calls", async () => {
    const won = winner ?? calls[0]!;
    const before = await privateBalance(ctx, "P");
    const c = await web.call(P, "POST", "/api/private/cashout", { commandId: randomUUID(), pairId: won.pairId, marketId: won.marketId });
    const after = await privateBalance(ctx, "P");
    const pub = await web.call(P, "POST", "/api/ledger/publications", { marketId: appMarketId(won.marketId), source: "receipt" });
    const hist = await web.call(P, "GET", `/api/index/wallet/${P.address}/receipts`);
    const listed = JSON.stringify(hist.json).includes(won.pairId) || JSON.stringify(hist.json).includes(calls[1]!.pairId);
    const ok = c.json.status === "done" && after === before && pub.status === 409 && !listed;
    return { outcome: ok ? "pass" : "fail", detail: `cash-out ${c.json.status} (credited at settlement ${credits(BigInt(c.json.creditedBase ?? "0"))}); private ${credits(before)} → ${credits(after)}; publish ${pub.status}; history ${hist.status} ${listed ? "lists them" : "does not list them"}`, evidence: "POST /api/private/cashout · POST /api/ledger/publications · GET /api/index/wallet/<seat>/receipts" };
  });
}

export async function runVoid(ctx: Ctx): Promise<void> {
  const { step, web } = ctx;
  const P = await seat(ctx, "P");
  if ((await privateBalance(ctx, "P")) < STAKE) await web.call(P, "POST", "/api/private/balance", { commandId: randomUUID(), op: "in", amountBase: "10000000" });
  let call: Placed | null = null;
  let before = 0n;
  let publicBefore = 0n;

  await step("C2e void: a private call on a BTC-5m Window", async () => {
    call = await placePrivate(ctx, "P", "BTC-5m", "up", 120, 300);
    before = await privateBalance(ctx, "P");
    publicBefore = await web.balance(P);
    const terms = (await ctx.kit.acs(ctx.roles.venue, TEMPLATE_IDS.MarketTerms, (a) => a as { marketId: string; closeDeadline: string })).find((t) => t.data.marketId === call!.marketId);
    console.log(`C2E-VOID-PLACED market=${call.marketId} expiry=${new Date(call.expirySec * 1000).toISOString()} closeDeadline=${terms?.data.closeDeadline ?? "?"}`);
    return { outcome: "pass", detail: `${call.marketId} Up for ${credits(call.costBase)}; private ${credits(before)}; stop ops before ${new Date(call.expirySec * 1000).toISOString().slice(11, 19)}Z, start it after ${String(terms?.data.closeDeadline ?? "?").slice(11, 19)}Z`, evidence: `update ${call.updateId} (Quote_Accept, beneficiaryRef "private")` };
  });
  if (!call) return;
  const placed = call as Placed;

  await step("C2e void: the Window voids; stake and fee come back into the private bucket, the public balance does not move", async () => {
    const [row] = await waitHome(ctx, "P", [placed.pairId], (placed.expirySec + 1_500) * 1000);
    const after = await privateBalance(ctx, "P");
    const pub = await web.balance(P);
    const r = await receiptOf(ctx, P.party!, placed.pairId);
    const ok = row?.status === "credited" && row.result === "void" && after - before === placed.costBase && pub === publicBefore && r?.paidInto === "private" && r.resolved === null;
    return { outcome: ok ? "pass" : "fail", detail: `${row?.status ?? "unlisted"} ${row?.result ?? ""}: payout ${credits(BigInt(row?.payoutBase ?? "0"))} (cost ${credits(placed.costBase)}); private ${credits(before)} → ${credits(after)}; public ${credits(pub)} (unchanged); receipt paidInto ${r?.paidInto ?? "—"}, resolved ${r?.resolved ?? "void"}`, evidence: `settle update ${r?.updateId ?? "—"} (Leg_Settle on a void Resolution)` };
  });
}

export async function runOut(ctx: Ctx): Promise<void> {
  const { step, web } = ctx;
  const P = await seat(ctx, "P");
  await step("C2e out: the private balance moves back to the seat's balance", async () => {
    const bal = await privateBalance(ctx, "P");
    const before = await web.balance(P);
    const r = await web.call(P, "POST", "/api/private/balance", { commandId: randomUUID(), op: "out", amountBase: bal.toString() });
    const after = await web.balance(P);
    return { outcome: r.json.kind === "moved" && after - before === bal ? "pass" : "fail", detail: `${credits(bal)} out; public ${credits(before)} → ${credits(after)}`, evidence: `update ${r.json.updateId} (VenueCash_Withdraw "private" + VenueAccount_Credit "demo")` };
  });
}

export async function runGuard(ctx: Ctx): Promise<void> {
  const secret = process.env.OPS_INTERNAL_SECRET;
  await ctx.step("C2e guard: ops refuses to cash out a receipt already paid into the private bucket; nothing moves", async () => {
    if (!secret) return { outcome: "fail", detail: "OPS_INTERNAL_SECRET is not set for the drive" };
    const ops = createOpsClient({ baseUrl: ctx.opsUrl, secret });
    const seats = Object.entries(ctx.parties.users).filter(([name]) => name.startsWith("seat-")).map(([, party]) => party);
    const tried: string[] = [];
    let moved = 0;
    for (const party of seats) {
      const receipts = (await ctx.kit.acs(party, TEMPLATE_IDS.SettlementReceipt, (a) => a as Receipt)).filter((r) => r.data.paidInto === "private");
      for (const r of receipts) {
        const reply = await ops.privateMove({ party, leaseId: "c2e-guard", requestId: randomUUID(), op: "cashout", receiptCid: r.cid });
        if (reply.kind === "moved") moved++;
        tried.push(reply.kind === "refused" ? `${reply.diagnosis.kind}` : "moved");
      }
    }
    const ok = tried.length > 0 && moved === 0 && tried.every((k) => k === "already-claimed");
    return { outcome: ok ? "pass" : "fail", detail: `${tried.length} receipt(s) paid into private tried: ${[...new Set(tried)].join(", ") || "none"}`, evidence: "POST /internal/private/move op cashout (HMAC)" };
  });
}
