/**
 * C2d ops-level integration: the maker vault on a REAL local stack (sandbox + `drive/ops-local.ts` with
 * `MAKER_MODE=vault`), without the web. Calls ops' HMAC routes as the web would (parties from the parties file's
 * `seat-1` and `seat-2`) and accepts as those seats directly on the ledger, the way the web's server half does:
 *
 *   state → seat-1 supplies the vault → accept → the issuer quotes seat-2 from the vault's cash (the Quote carries
 *   `book = reserve:maker`) → accept (the venue's leg is the book's) → the same Window's other side → merge crank (split
 *   first when the sizes differ, K-201) →
 *   the Window resolves and settles into `reserve:maker` → the statement moves → seat-1 withdraws → accept
 *
 * At each step it prints the vault's statement and checks what the ledger holds for the book against it.
 *
 *   LEDGER_JSON_API_URL=http://localhost:7585 AGARI_PARTIES_FILE=… OPS=http://localhost:8787 OPS_INTERNAL_SECRET=… \
 *     pnpm --filter @agari/scripts exec tsx drive/maker-vault-it.ts
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { createLedgerClient, noAuth, parseLedgerEnv, type Command } from "@agari/ledger";
import { TEMPLATE_IDS } from "@agari/daml";
import { MAKER_BOOK } from "@agari/markets/ops/book";
import { cmd, decodeBookReceipt, decodeLeg, decodeQuote, decodeVenueCash, legBookOf, pick } from "@agari/markets/ops/canton";
import { tcmd } from "@agari/markets/ops/tickets";
import { createOpsClient, type MakerStateWire } from "@agari/markets/server";
import { readPartiesFile } from "../../services/ops/src/runtime/keys";

const OPS = process.env.OPS ?? "http://localhost:8787";
const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("maker-vault-it runs against an unauthenticated local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });
const ops = createOpsClient({ baseUrl: OPS, secret: process.env.OPS_INTERNAL_SECRET! });
const file = readPartiesFile()!;
const venue = file.parties.venue!;
const lp = file.users!["seat-1"]!;
const taker = file.users!["seat-2"]!;
const run = Date.now().toString(36);
const C = 1_000_000n;
let failures = 0;
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${typeof detail === "string" ? detail : json(detail)}`}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const credits = (b: bigint) => `${b / C}.${(b % C).toString().padStart(6, "0").slice(0, 2)}`;

async function cashOf(party: string): Promise<Array<{ cid: string; amount: bigint }>> {
  const r = await client.activeContracts({ parties: [party], templateIds: [TEMPLATE_IDS.VenueCash] });
  return pick(r.contracts, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === party).map((c) => ({ cid: c.cid, amount: c.data.amount }));
}
const total = async (party: string) => (await cashOf(party)).reduce((s, c) => s + c.amount, 0n);
async function accept(party: string, label: string, build: (cash: string[]) => Command) {
  const mine = (await cashOf(party)).sort((a, b) => (a.amount > b.amount ? -1 : 1));
  const r = await client.submitAndWaitForTransaction({ actAs: [party], commandId: `drive:${label}:${run}`, commands: [build(mine.slice(0, 3).map((c) => c.cid))] });
  console.log(`  update ${label}: ${r.transaction.updateId}`);
  return r.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));
}
async function maker(): Promise<MakerStateWire> {
  const s = await ops.ticketState();
  if (!s.ok || !s.value.maker) throw new Error(`no maker state: ${json(s)}`);
  return s.value.maker;
}
const line = (m: MakerStateWire) => `NAV #${m.navSeq} ${credits(m.assetsBase)} / ${credits(m.shares)} shares, liquid ${credits(m.liquidBase)}, deployed ${credits(m.deployedBase)}, ${m.open.length} open, ${m.history.length} settled`;
/** Waits until the published statement has caught up with `pred` (the reserve reporter publishes every few seconds). */
async function waitMaker(pred: (m: MakerStateWire) => boolean, what: string, ms = 90_000): Promise<MakerStateWire> {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(2_000)) {
    const m = await maker();
    if (pred(m)) return m;
  }
  throw new Error(`timed out waiting for ${what}`);
}
/** What the ledger holds for the book right now, as the venue sees it. */
async function bookOnLedger() {
  const r = await client.activeContracts({ parties: [venue], templateIds: [TEMPLATE_IDS.VenueCash, TEMPLATE_IDS.Quote, TEMPLATE_IDS.Leg, TEMPLATE_IDS.BookReceipt] });
  const cash = pick(r.contracts, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === venue && c.data.bucket === MAKER_BOOK);
  const quotes = pick(r.contracts, TEMPLATE_IDS.Quote, decodeQuote).filter((q) => q.data.book === MAKER_BOOK);
  const legs = pick(r.contracts, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => legBookOf(l.data) === MAKER_BOOK);
  const receipts = pick(r.contracts, TEMPLATE_IDS.BookReceipt, decodeBookReceipt).filter((x) => x.data.book === MAKER_BOOK);
  return { cash: cash.reduce((s, c) => s + c.data.amount, 0n), quotes, legs, receipts };
}
async function quoting(): Promise<any> {
  for (let i = 0; i < 120; i++) {
    const body = (await (await fetch(`${OPS}/ladders/latest`)).json()) as { ladders: any[] };
    const now = Date.now() / 1000;
    const ls = body.ladders
      .filter((x) => x.state === "quoting" && x.lockAtSec - now >= 60 && x.up.length > 0 && x.down.length > 0 && x.symbol === "BTC")
      .sort((a, b) => a.expirySec - b.expirySec);
    if (ls[0]) return ls[0];
    await sleep(2_000);
  }
  throw new Error("no quoting BTC Window with a minute left within 4 minutes");
}

// ---- 0. seats and the vault as bootstrapped -------------------------------------------------------------------
for (const party of [lp, taker]) {
  const f = await ops.fundSeat({ party, leaseId: `drive-${run}`, address: "11111111111111111111111111111111" });
  check(`fund ${party.split("::")[0]}`, f.kind === "funded" || f.kind === "already", f.kind);
}
for (let i = 0; i < 30 && ((await total(lp)) === 0n || (await total(taker)) === 0n); i++) await sleep(1_000);
const m0 = await maker();
console.log(`vault at start: ${line(m0)} (quoting ${m0.quoting})`);
check("the vault is live and quoting (MAKER_MODE=vault)", !m0.paused && m0.quoting && m0.shares > 0n);
const b0 = await bookOnLedger();
check("its cash is reserve:maker cash", b0.cash > 0n, credits(b0.cash));

// ---- 1. supply ----------------------------------------------------------------------------------------------------
const lpBefore = await total(lp);
const sq = await ops.ticket("earn", { op: "supply", reserve: "maker", amountBase: 500n * C, party: lp, leaseId: `drive-${run}` });
check("supply quote from the vault's statement", sq.kind === "supply-quote", sq);
if (sq.kind !== "supply-quote") process.exit(1);
const supplied = await accept(lp, "supply", (c) => tcmd.acceptSupply(sq.quoteCid, c));
check("supply accept → LpShare", supplied.some((e) => e.templateId.endsWith(":PM.Reserve:LpShare")));
check("seat-1 paid 500", lpBefore - (await total(lp)) === 500n * C);
const m1 = await waitMaker((m) => m.shares === m0.shares + sq.sharesOut, "the statement to count the supply");
console.log(`after supply: ${line(m1)}`);
check("NAV counts the supply, shares at the published price", m1.assetsBase === m0.assetsBase + 500n * C, { assets: m1.assetsBase, shares: m1.shares });

// ---- 2. quotes drawn from the vault's cash ----------------------------------------------------------------------
const w = await quoting();
console.log(`Window ${w.damlMarketId} (fair ${w.fairTicks}, lock in ${Math.round(w.lockAtSec - Date.now() / 1000)} s)`);
// Different stakes on the two sides (inside the vault's 20-lot bound), so the book's legs differ in size and the merge must
// split first (K-201).
const takeSide = async (side: "up" | "down", label: string, stake: bigint) => {
  const q = await ops.quote({ marketId: w.marketId, side, stakeBase: stake * C, displayedMaxCostBase: (stake + 1n) * C, party: taker, leaseId: `drive-${run}` });
  check(`${label}: firm quote`, q.kind === "quote", q.kind === "quote" ? { lots: q.quote.contractsRaw } : q);
  if (q.kind !== "quote") return null;
  const r = await client.activeContracts({ parties: [taker], templateIds: [TEMPLATE_IDS.Quote] });
  const quote = pick(r.contracts, TEMPLATE_IDS.Quote, decodeQuote).find((x) => x.cid === q.quoteCid);
  check(`${label}: the Quote is the vault's (book = reserve:maker)`, quote?.data.book === MAKER_BOOK, quote?.data.book ?? "missing");
  const onWindow = async () => (await bookOnLedger()).legs.filter((l) => l.data.marketId === w.damlMarketId).length;
  const before = await onWindow();
  const created = await accept(taker, label, (c) => cmd.acceptQuote(q.quoteCid, c));
  check(`${label}: accept → the taker's leg`, created.some((e) => e.templateId.endsWith(":PM.Leg:Leg")));
  // The venue's leg is not the taker's to see (Canton privacy): read it as the venue.
  check(`${label}: accept → the venue's leg is the book's (beneficiaryRef = reserve:maker)`, (await onWindow()) === before + 1);
  return q;
};
const cashBeforeQuotes = (await bookOnLedger()).cash;
await takeSide("up", "quote up", 3n);
await takeSide("down", "quote down", 4n);
const b2 = await bookOnLedger();
check("the vault's cash paid the venue stakes", b2.cash < cashBeforeQuotes, `${credits(cashBeforeQuotes)} → ${credits(b2.cash)}`);
check("the book holds both sides on the Window", b2.legs.length >= 2, b2.legs.map((l) => `${l.data.outcome} ${l.data.lots}×${l.data.backingShare}`));
const m2 = await waitMaker((m) => m.open.some((x) => x.marketId === w.marketId), "the Window in the vault's open list");
console.log(`after the accepts: ${line(m2)}`);
check("accepts do not move the NAV (positions at cost)", m2.assetsBase === m1.assetsBase, { before: m1.assetsBase, after: m2.assetsBase });

// ---- 3. merge crank (the reference's public_merge) ----------------------------------------------------------------
const mg = await ops.ticket("earn", { op: "merge", reserve: "maker", marketId: w.marketId, party: taker, leaseId: `drive-${run}` });
console.log(`merge crank: ${json(mg)}`);
// K-201: with both sides held the crank nets min(up, down), splitting a leg first when the sizes differ.
check("merge crank nets the book's pairs (splitting first when sizes differ)", mg.kind === "maker-op" && mg.done >= 1, mg);
const b3 = await bookOnLedger();
const onW = b3.legs.filter((l) => l.data.marketId === w.damlMarketId);
check("after the merge the book holds one side only on the Window", new Set(onW.map((l) => l.data.outcome)).size <= 1, onW.map((l) => `${l.data.outcome} ${l.data.lots}×${l.data.backingShare}`));
const m3 = await waitMaker((m) => m.navSeq > m2.navSeq, "the statement after the merge");
console.log(`after the merge: ${line(m3)}`);
check("the NAV never rises at a merge (a residual counts at the lesser of its values)", m3.assetsBase <= m2.assetsBase, { before: m2.assetsBase, after: m3.assetsBase });

// ---- 4. the Window resolves and settles into reserve:maker ------------------------------------------------------------
const settleBy = w.expirySec + 180;
console.log(`waiting for ${w.damlMarketId} to resolve and settle (expiry ${new Date(w.expirySec * 1000).toISOString()})…`);
let m4: MakerStateWire | null = null;
while (Date.now() / 1000 < settleBy) {
  await sleep(5_000);
  const m = await maker();
  if (m.unsettledExpired === w.marketId) {
    const st = await ops.ticket("earn", { op: "settle", reserve: "maker", marketId: w.marketId, party: taker, leaseId: `drive-${run}` });
    console.log(`settle crank: ${json(st)}`);
  }
  if (m.history.some((h) => h.marketId === w.marketId && h.settled)) {
    m4 = m;
    break;
  }
}
check("the Window settled out of the vault's book", m4 !== null);
if (m4) {
  const h = m4.history.find((x) => x.marketId === w.marketId)!;
  console.log(`settled: out ${credits(h.escrowOutBase)}, merged ${credits(h.mergedBase)}, paid ${credits(h.payoutBase)}, realised ${h.realizedBase === null ? "-" : credits(h.realizedBase)}`);
  const b4 = await bookOnLedger();
  check("the book's receipts record it", b4.receipts.some((r) => r.data.marketId === w.damlMarketId), b4.receipts.map((r) => `${r.data.kind} ${r.data.cost}→${r.data.proceeds}`));
  const m5 = await waitMaker((m) => m.navSeq > m4!.navSeq && m.open.every((x) => x.marketId !== w.marketId), "the statement after the settle");
  console.log(`after settle: ${line(m5)}`);
  check("the NAV moved by the Window's realised result", m5.assetsBase === m1.assetsBase + (h.realizedBase ?? 0n) || m5.open.length > 0, { before: m1.assetsBase, after: m5.assetsBase, realised: h.realizedBase });
}

// ---- 5. withdraw ------------------------------------------------------------------------------------------------------
const mine = await client.activeContracts({ parties: [lp], templateIds: [TEMPLATE_IDS.LpShare] });
const held = mine.contracts
  .map((c) => c.createdEvent.createArgument as { reserveId: string; shares: string; provider: string })
  .filter((s) => s.reserveId === "maker" && s.provider === lp)
  .reduce((s, x) => s + BigInt(x.shares), 0n);
const lpBeforeWithdraw = await total(lp);
const wq = await ops.ticket("earn", { op: "withdraw", reserve: "maker", shares: held, party: lp, leaseId: `drive-${run}` });
check("withdraw quote, paid from reserve:maker", wq.kind === "withdraw-quote", wq);
if (wq.kind === "withdraw-quote") {
  const wr = await client.submitAndWaitForTransaction({ actAs: [lp], commandId: `drive:withdraw:${run}`, commands: [tcmd.acceptWithdraw(wq.quoteCid)] });
  console.log(`  update withdraw: ${wr.transaction.updateId}`);
  check("seat-1 received the quoted cash", (await total(lp)) - lpBeforeWithdraw === wq.cashOut, credits(wq.cashOut));
}
const m6 = await waitMaker((m) => m.shares === m1.shares - held, "the statement after the withdrawal");
console.log(`after withdraw: ${line(m6)}`);
const b6 = await bookOnLedger();
check("the vault's idle cash is what the statement calls liquid", b6.cash === m6.liquidBase || m6.open.length > 0, { ledger: b6.cash, statement: m6.liquidBase });
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
