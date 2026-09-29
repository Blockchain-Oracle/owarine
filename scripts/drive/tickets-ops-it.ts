/**
 * C8c ops-level integration: the ticket desk on a REAL local stack (sandbox + `drive/ops-local.ts`), without the web.
 * Calls ops' HMAC routes as the web would (party from the parties file's `seat-1`) and accepts as that seat directly on
 * the ledger, the way the web's server half does:
 *
 *   fund seat-1 → range quote → accept → parlay quote (two Windows) → accept → boost 2x quote → accept → exit quote
 *   → Earn supply 50 → accept → withdraw 10 shares → accept → the reserves' state before and after
 *
 *   LEDGER_JSON_API_URL=http://localhost:7645 AGARI_PARTIES_FILE=… OPS=http://localhost:8847 OPS_INTERNAL_SECRET=… \
 *     pnpm --filter @agari/scripts exec tsx drive/tickets-ops-it.ts
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { createLedgerClient, noAuth, parseLedgerEnv, type Command } from "@agari/ledger";
import { TEMPLATE_IDS } from "@agari/daml";
import { decodeVenueCash, pick } from "@agari/markets/ops/canton";
import { tcmd } from "@agari/markets/ops/tickets";
import { createOpsClient } from "@agari/markets/server";
import { readPartiesFile } from "../../services/ops/src/runtime/keys";

const OPS = process.env.OPS ?? "http://localhost:8847";
const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("tickets-ops-it runs against an unauthenticated local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });
const ops = createOpsClient({ baseUrl: OPS, secret: process.env.OPS_INTERNAL_SECRET! });
const file = readPartiesFile()!;
const seat = file.users!["seat-1"]!;
const leaseId = `drive-${Date.now().toString(36)}`;
let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${typeof detail === "string" ? detail : JSON.stringify(detail, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cash(): Promise<Array<{ cid: string; amount: bigint }>> {
  const r = await client.activeContracts({ parties: [seat], templateIds: [TEMPLATE_IDS.VenueCash] });
  return pick(r.contracts, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === seat).map((c) => ({ cid: c.cid, amount: c.data.amount }));
}
const total = async () => (await cash()).reduce((s, c) => s + c.amount, 0n);
async function accept(label: string, build: (cash: string[]) => Command) {
  const mine = (await cash()).sort((a, b) => (a.amount > b.amount ? -1 : 1));
  const r = await client.submitAndWaitForTransaction({ actAs: [seat], commandId: `drive:${label}:${Date.now()}`, commands: [build(mine.slice(0, 3).map((c) => c.cid))] });
  return r.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));
}

async function quoting(n: number) {
  for (let i = 0; i < 90; i++) {
    const body = (await (await fetch(`${OPS}/ladders/latest`)).json()) as { ladders: any[] };
    const now = Date.now() / 1000;
    const ls = body.ladders.filter((x) => x.state === "quoting" && x.lockAtSec - now >= 30 && x.up.length > 0 && x.down.length > 0);
    if (ls.length >= n) return ls;
    await sleep(2_000);
  }
  throw new Error(`fewer than ${n} quoting Windows within 3 minutes`);
}

const fund = await ops.fundSeat({ party: seat, leaseId, address: "11111111111111111111111111111111" });
check("fund seat-1", fund.kind === "funded" || fund.kind === "already", fund.kind);
for (let i = 0; i < 20 && (await total()) === 0n; i++) await sleep(1_000);
console.log(`seat-1 holds ${await total()}`);
const s0 = await ops.ticketState();
check("reserve state", s0.ok && s0.value.reserves.length === 3, s0.ok ? s0.value.reserves.map((r) => `${r.reserveId} ${r.assetsBase}/${r.shares}`) : s0.diagnosis);

const [a, b] = await quoting(2);
console.log(`Windows ${a.damlMarketId} (fair ${a.fairTicks}, open ${a.openPriceE8}) and ${b.damlMarketId}`);

// ---- range --------------------------------------------------------------------------------------------------
const open = BigInt(a.openPriceE8);
const basis = await ops.ticket("range", { op: "basis", marketId: a.marketId });
check("range basis", basis.kind === "basis", basis);
const band = { lowE8: open - open / 1000n, highE8: open + open / 1000n };
const preview = await ops.ticket("range", { op: "preview", marketId: a.marketId, side: "inside", ...band, mode: { kind: "fixPayout", maxPayoutBase: 20_000_000n } });
check("range preview", preview.kind === "preview", preview);
const rq = await ops.ticket("range", { op: "issue", marketId: a.marketId, side: "inside", ...band, maxPayoutBase: 20_000_000n, maxStakeBase: 20_000_000n, party: seat, leaseId });
check("range quote", rq.kind === "quote", rq);
if (rq.kind === "quote") {
  const created = await accept("range", (c) => tcmd.acceptRangeQuote(rq.quoteCid, c));
  check("range accept → RangeRound", created.some((e) => e.templateId.endsWith(":PM.Tickets.Range:RangeRound")));
}
// An even band (open to +0.5%) keeps the price well inside the reserve's bounds, so only the cap decides.
const low = await ops.ticket("range", { op: "issue", marketId: a.marketId, side: "inside", lowE8: open, highE8: open + open / 200n, maxPayoutBase: 20_000_000n, maxStakeBase: 1n, party: seat, leaseId });
check("range under-cap answers requote", low.kind === "requote", low.kind);

// ---- parlay -------------------------------------------------------------------------------------------------
const pq = await ops.ticket("parlay", { op: "issue", legs: [{ marketId: a.marketId, side: "up" }, { marketId: b.marketId, side: "up" }], maxPayoutBase: 30_000_000n, maxStakeBase: 30_000_000n, party: seat, leaseId });
check("parlay quote", pq.kind === "quote", pq);
if (pq.kind === "quote") {
  const created = await accept("parlay", (c) => tcmd.acceptParlayQuote(pq.quoteCid, c));
  check("parlay accept → ParlayTicket", created.some((e) => e.templateId.endsWith(":PM.Tickets.Parlay:ParlayTicket")));
}

// ---- boost --------------------------------------------------------------------------------------------------
const bp = await ops.ticket("boost", { op: "preview", marketId: a.marketId, side: "up", stakeBase: 10_000_000n, leverageBps: 20_000 });
check("boost preview", bp.kind === "preview", bp);
const bq = await ops.ticket("boost", { op: "issue", marketId: a.marketId, side: "up", stakeBase: 10_000_000n, leverageBps: 20_000, minQuantityRaw: 0n, party: seat, leaseId });
check("boost quote", bq.kind === "quote", bq);
let positionCid: string | null = null;
if (bq.kind === "quote") {
  const created = await accept("boost", (c) => tcmd.acceptBoostQuote(bq.quoteCid, c));
  positionCid = created.find((e) => e.templateId.endsWith(":PM.Tickets.Boost:BoostPosition"))?.contractId ?? null;
  check("boost accept → BoostPosition", positionCid !== null);
}
if (positionCid) {
  const ex = await ops.ticket("boost", { op: "exit", positionCid, minProceedsBase: 0n, party: seat, leaseId });
  check("boost exit quote", ex.kind === "exit-quote", ex);
}

// ---- earn ---------------------------------------------------------------------------------------------------
const sq = await ops.ticket("earn", { op: "supply", reserve: "range", amountBase: 50_000_000n, party: seat, leaseId });
check("earn supply quote", sq.kind === "supply-quote", sq);
if (sq.kind === "supply-quote") {
  const created = await accept("supply", (c) => tcmd.acceptSupply(sq.quoteCid, c));
  check("supply accept → LpShare", created.some((e) => e.templateId.endsWith(":PM.Reserve:LpShare")));
}
const wq = await ops.ticket("earn", { op: "withdraw", reserve: "range", shares: 10_000_000n, party: seat, leaseId });
check("earn withdraw quote", wq.kind === "withdraw-quote", wq);
if (wq.kind === "withdraw-quote") {
  const r = await client.submitAndWaitForTransaction({ actAs: [seat], commandId: `drive:withdraw:${Date.now()}`, commands: [tcmd.acceptWithdraw(wq.quoteCid)] });
  check("withdraw accept", r.transaction.events.length > 0);
}
await sleep(9_000);
const s1 = await ops.ticketState();
check("reserve state after", s1.ok, s1.ok ? s1.value.reserves.map((r) => `${r.reserveId} nav#${r.navSeq} ${r.assetsBase}/${r.shares} liquid ${r.liquidBase} locked ${r.lockedBase} open ${r.openTickets}`) : s1.diagnosis);
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
