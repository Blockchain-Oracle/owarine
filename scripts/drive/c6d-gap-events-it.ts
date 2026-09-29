/**
 * C6d integration on a REAL local stack (sandbox + `services/ops/src/main.ts` + the web): a Monday Gap window, two
 * committee events and the settlement receipts they leave, driven the way a browser seat drives the routes.
 *
 *   1. Gap. The roller's own planner (`planGapSeries`) names the next Gap on the agreed NYSE weekday calendar; then,
 *      time-shifted so it runs in minutes (the Friday → Sunday → Monday order kept), the drive opens `TSLA-gap`'s next
 *      Window with the roller's command (`Series_OpenWindowSpan`). The three oracle parties post drive-data prints
 *      (labelled so in each payload) at the open and the close; ops' resolver records the open and resolves; the seat
 *      buys Up through `/api/ledger/quotes` on the pricer's Gap ladder and a range ticket through
 *      `/api/ledger/tickets/range`; ops' settlers settle both.
 *   2. Events. Two events listed with `Series_OpenEvent`; the seat buys YES on both. After the close the committee
 *      attests YES, YES, YES on one (`Event_Resolve` → YES) and YES, NO, YES on the other (a conflict: void
 *      `SourceDisagreement`), each attestation hashing a statement that names its source.
 *   3. Receipts. `/api/index/wallet/<seat>/receipts` (the web route, seat cookie) lists the Gap leg, the range ticket
 *      (product `range`) and both event legs with their question; the projection holds the event verdicts.
 *
 *   SITE=http://localhost:3140 OPS=http://localhost:8747 LEDGER_JSON_API_URL=http://localhost:7545 LEDGER_AUTH_MODE=none \
 *     AGARI_PARTIES_FILE=… DATABASE_URL=postgres://localhost/pm_c6d pnpm --filter @agari/scripts exec tsx drive/c6d-gap-events-it.ts
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { createHash, randomUUID, webcrypto } from "node:crypto";
import { messageBytes } from "@agari/core/auth";
import {
  addDays, attestedPrintSource, BAR_LEN_SEC, calendarFromAlpaca, datesBetween, EVENT_KEY_PREFIX, etDateOf, eventStatementText, SOURCE_TIMING, weekdayOfDate,
} from "@agari/core/market";
import { encodeBase58, type Address } from "@agari/core/types";
import { TEMPLATE_IDS } from "@agari/daml";
import { createLedgerClient, noAuth, parseLedgerEnv, type Command } from "@agari/ledger";
import { parseMarketsEnv, seatLeaseText, toWire } from "@agari/markets";
import {
  attestCommandId, cmd, decodeSeries, decodeTerms, feeFor, openEventCommandId, openWindowCommandId, pick, readActive, type RoleSession,
} from "@agari/markets/ops/canton";
import postgres from "postgres";
import { planSeriesOf } from "../../services/ops/src/actors/window-roller/execute";
import { gapSpanOf, planGapSeries } from "../../services/ops/src/actors/window-roller/plan-gap";
import { ORACLE_ROLES, readPartiesFile } from "../../services/ops/src/runtime/keys";

const SITE = process.env.SITE ?? "http://localhost:3140";
const OPS = process.env.OPS ?? "http://localhost:8747";
const CLUSTER = parseMarketsEnv({ cluster: process.env.NEXT_PUBLIC_CANTON_NETWORK }).cluster;
const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("c6d-gap-events-it runs against an unauthenticated local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });
const file = readPartiesFile();
if (!file) throw new Error("no parties file: run bootstrap-local.ts first");
const p = file.parties;
const venue: RoleSession = { role: "venue", party: p.venue!, client, dryRun: false };
const run = Date.now().toString(36).slice(-5).toUpperCase();

let failures = 0;
const updates: Record<string, string> = {};
const log = (...a: unknown[]) => console.log(`${new Date().toISOString().slice(11, 19)}`, ...a);
const j = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${typeof detail === "string" ? detail : j(detail)}`}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowSec = () => Math.floor(Date.now() / 1000);
const until = async (sec: number) => {
  while (nowSec() < sec) await sleep(Math.min(2_000, (sec - nowSec()) * 1000 + 50));
};
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const iso = (sec: number) => new Date(sec * 1000).toISOString().replace(".000Z", "Z");

// ---- the seat (as exit-it.ts: cookie + CSRF header) ---------------------------------------------------------------
const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as { publicKey: webcrypto.CryptoKey; privateKey: webcrypto.CryptoKey };
const address = encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) as Address;
const sign = async (text: string) => encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, messageBytes(text) as Uint8Array<ArrayBuffer>)));
let cookie = "";
async function call(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { accept: "application/json", origin: SITE, "x-agari-seat": "1" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${SITE}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(toWire(body)) }) });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie?.startsWith("agari_seat=")) cookie = setCookie.split(";")[0]!;
  return { status: res.status, json: ((await res.json().catch(() => null)) ?? {}) as Record<string, any> };
}
const credits = async () => BigInt((await call("GET", "/api/ledger/me/balance")).json.value?.spendableBase ?? "0");

async function ladderFor(damlMarketId: string, waitSec: number) {
  for (let i = 0; i < waitSec / 2; i++) {
    const body = (await (await fetch(`${OPS}/ladders/latest`)).json()) as { ladders: any[] };
    const l = body.ladders.find((x) => x.damlMarketId === damlMarketId && x.state === "quoting" && x.up.length > 0);
    if (l) return l;
    await sleep(2_000);
  }
  return null;
}

/** Buy `lots` Up (YES) on a quoting Window through the web's quote and accept routes. */
async function buyUp(damlMarketId: string, lots: bigint, label: string): Promise<string | null> {
  const ladder = await ladderFor(damlMarketId, 90);
  if (!ladder) {
    check(`${label}: the pricer quotes ${damlMarketId}`, false);
    return null;
  }
  const ask = ladder.up[0][0] as number;
  const cu = BigInt(ladder.cashUnit);
  const stake = lots * BigInt(ask) * cu + feeFor(lots, ask, cu, ladder.feeRateBps);
  const q = await call("POST", "/api/ledger/quotes", { marketId: ladder.marketId, side: "up", stakeBase: stake, displayedMaxCostBase: stake });
  const acc = q.json.kind === "quote" ? await call("POST", `/api/ledger/quotes/${q.json.quoteCid}/accept`, { commandId: randomUUID() }) : null;
  check(`${label}: buy ${lots} Up at ${ask} (fair ${ladder.fairTicks}) on ${damlMarketId}`, acc?.json.kind === "confirmed", acc?.json.kind ?? q.json);
  if (acc?.json.updateId) updates[`${label} buy`] = acc.json.updateId;
  return ladder.marketId as string;
}

/** Each oracle party posts one drive-data print at a boundary, as the lane feeders would (commandId `drive:`). */
async function postPrints(t: ReturnType<typeof decodeTerms>, boundarySec: number, priceE8: bigint, what: string) {
  for (const role of ORACLE_ROLES) {
    const oracle = p[role]!;
    const payload = JSON.stringify({ drive: "c6d", label: "drive data: a time-shifted Gap, not a market print", marketId: t.marketId, what, priceE8: priceE8.toString(), oracle: role });
    const out = await client.submitAndWaitForTransaction({
      actAs: [oracle], commandId: `drive:c6d:${run}:${role}:${boundarySec}`,
      commands: [cmd.createPriceQuote({ oracle, venue: p.venue!, resolver: p.resolver!, symbol: t.symbol, boundarySec, priceE8, barLenSec: t.barLenSec, fetchedAtSec: nowSec(), payloadHash: sha256(payload), policyVersion: t.policyVersion })],
    });
    updates[`gap ${what} print ${role}`] = out.transaction.updateId;
  }
}

async function terms(marketId: string) {
  return pick(await readActive(venue, [TEMPLATE_IDS.MarketTerms]), TEMPLATE_IDS.MarketTerms, decodeTerms).find((t) => t.data.marketId === marketId)?.data ?? null;
}

// ---- 0. lease -----------------------------------------------------------------------------------------------------
const issuedAtMs = Date.now();
const leased = await call("POST", "/api/seat", { address, issuedAtMs, signature: await sign(seatLeaseText(address, issuedAtMs, CLUSTER)) });
check("lease a seat", leased.status === 200 && leased.json.kind === "leased", leased.json.kind ?? leased.json);
for (let i = 0; i < 30 && (await credits()) === 0n; i++) await sleep(1_000);
check("the seat holds demo credits", (await credits()) > 0n);

// ---- 1a. the roller's plan on the agreed calendar ----------------------------------------------------------------
const seriesAll = pick(await readActive(venue, [TEMPLATE_IDS.Series]), TEMPLATE_IDS.Series, decodeSeries);
const gapSeries = seriesAll.find((s) => s.data.seriesKey === "TSLA-gap");
check("bootstrap created the TSLA-gap Series (weekly lane, Gap policy: open print admitted until lock)", !!gapSeries && gapSeries.data.policyVersions.every((v) => v.openAdmissionSec < 0), gapSeries?.data.policyVersions.map((v) => v.printSource));
if (!gapSeries) process.exit(1);
const gapKeys = seriesAll.filter((s) => s.data.seriesKey.endsWith("-gap")).map((s) => s.data.seriesKey);
log(`Gap Series: ${gapKeys.join(", ")}`);
{
  const at = nowSec();
  const [from, to] = [addDays(etDateOf(at), -7), addDays(etDateOf(at), 14)];
  const calendar = calendarFromAlpaca(datesBetween(from, to).filter((d) => weekdayOfDate(d) < 5).map((date) => ({ date, open: "09:30", close: "16:00" })), from, to);
  const plan = planGapSeries(planSeriesOf(gapSeries.data), {
    calendar, nowSec: at, leadSec: 120, gapLeadSec: 172_800, minTradableSec: 60, skips: [], multipliers: [], halts: {}, prelist: true, prelistCadencesSec: [], pythUsable: () => true,
  });
  check("the roller's planner names the next real Gap on a weekday calendar", plan.kind === "open" || plan.kind === "wait", plan.state);
  if ("window" in plan) log(`  next Gap ${gapSpanOf(plan.window)} (lock ${iso(plan.window.lockAtSec)}): ${plan.state}`);
}
const session = (await (await fetch(`${OPS}/session`)).json()) as { lanes: Record<string, string> };
check("ops /session lists the Gap lanes (the web's Gap plate reads these keys)", gapKeys.every((k) => k in session.lanes), Object.fromEntries(gapKeys.map((k) => [k, session.lanes[k]])));

// ---- 1b. a time-shifted Gap on TSLA-gap and two events, all starting at the next minute -------------------------
const t0 = Math.ceil((nowSec() + 50) / 60) * 60;
const gapIndex = gapSeries.data.nextIndex;
const gapWindow = { index: gapIndex, tradingStartSec: t0, lockAtSec: t0 + 240, expirySec: t0 + 330 };
const opened = await client.submitAndWaitForTransaction({ actAs: [p.venue!], commandId: openWindowCommandId("TSLA-gap", gapIndex), commands: [cmd.openWindowSpan(gapSeries.cid, gapWindow)] });
updates["gap Series_OpenWindowSpan"] = opened.transaction.updateId;
const gapId = `TSLA-gap:${gapIndex}`;
const gapTerms = await terms(gapId);
check(`Series_OpenWindowSpan opened ${gapId} ${iso(t0)} → lock ${iso(gapWindow.lockAtSec)} → ${iso(gapWindow.expirySec)} (time-shifted)`, !!gapTerms && gapTerms.expirySec === gapWindow.expirySec && gapTerms.openDeadlineSec === gapWindow.lockAtSec, gapTerms && { openDeadline: iso(gapTerms.openDeadlineSec), printSource: gapTerms.printSource });

const EVENT_SOURCE = "https://www.nasa.gov/ (drive: the committee's named source)";
async function listEvent(id: string, question: string) {
  const key = `${EVENT_KEY_PREFIX}${id}`;
  const t = SOURCE_TIMING.committee;
  await client.submitAndWaitForTransaction({
    actAs: [p.venue!], commandId: `event:${id}:series`,
    commands: [cmd.createSeries({
      venue: p.venue!, resolver: p.resolver!, auditor: p.auditor!, seriesKey: key, symbol: key, anchorSec: t0, cadenceSec: 180, lockLeadSec: 30, settleGraceSec: 300,
      cashUnit: 1000n, nextIndex: 0, oracles: ORACLE_ROLES.map((r) => p[r]!), quorum: 2, maxDeviationBps: 0,
      policy: { version: 1, effectiveFromSec: t0, printSource: attestedPrintSource("committee", id), minDelaySec: t.minDelaySec, barLenSec: BAR_LEN_SEC.committee, openAdmissionSec: t.admissionSec, closeAdmissionSec: t.admissionSec },
    })],
  });
  const series = pick(await readActive(venue, [TEMPLATE_IDS.Series]), TEMPLATE_IDS.Series, decodeSeries).find((s) => s.data.seriesKey === key)!;
  const out = await client.submitAndWaitForTransaction({
    actAs: [p.venue!], commandId: openEventCommandId(key, 0),
    commands: [cmd.openEvent(series.cid, { index: 0, question, tradingStartSec: t0, lockAtSec: t0 + 150, closeTimeSec: t0 + 180 })],
  });
  updates[`event ${id} Series_OpenEvent`] = out.transaction.updateId;
  const created = out.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : [])).map((e) => e.templateId.split(":").slice(-2).join(":"));
  check(`Series_OpenEvent listed ${key}:0 "${question}" (terms, EventTerms, EventState; no WindowState)`, created.includes("PM.Event:EventTerms") && created.includes("PM.Event:EventState") && !created.includes("PM.Market:WindowState"), created);
  return `${key}:0`;
}
const yesId = await listEvent(`C6D${run}Y`, "Will the C6d drive's committee attest YES?");
const conflictId = await listEvent(`C6D${run}C`, "Will the C6d drive's committee agree?");

// ---- 1c. the Gap's open print, then trading ---------------------------------------------------------------------
// The prints are ops' own: the lane feeders read TSLA on RedStone at each boundary, one attested PriceQuote per oracle
// party (the terms' `printSource`). Only if none is recorded 60 s after a boundary (an off-hours run with RedStone
// down) does the drive post labelled drive-data prints so the Window can still resolve.
const db = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1 }) : null;
if (!db) throw new Error("DATABASE_URL is required for the projection checks");
const printed = async () =>
  (await db`SELECT open_price_e8::text AS open, close_price_e8::text AS close, state FROM idx_markets WHERE market_key = ${gapId}`)[0] as { open: string | null; close: string | null; state: string } | undefined;
const printSources: Record<string, string> = {};
async function awaitPrint(slot: "open" | "close", boundarySec: number, fallbackE8: () => bigint) {
  for (let i = 0; i < 60; i++) {
    const row = await printed();
    if (slot === "open" ? row?.open : row && row.state !== "open") {
      printSources[slot] = "ops lane feeders (RedStone TSLA, attested by the three oracle parties)";
      return;
    }
    if (nowSec() > boundarySec + 60) break;
    await sleep(2_000);
  }
  printSources[slot] = "drive data (fallback: no feeder print within 60 s)";
  await postPrints(gapTerms!, boundarySec, fallbackE8(), slot);
}
await until(t0 + gapTerms!.minDelaySec + 1);
await awaitPrint("open", t0, () => 350_00000000n);
log(`Gap open print: ${(await printed())?.open} e-8 from ${printSources.open}`);

await sleep(3_000);
const gapMarket = await buyUp(gapId, 10n, "gap");
const yesMarket = await buyUp(yesId, 10n, "event YES");
const conflictMarket = await buyUp(conflictId, 10n, "event conflict");

// A range ticket on the Gap Window, through the web's ticket routes (the ticket desk prices it off the Gap ladder).
let rangeOk = false;
if (gapMarket) {
  const openE8 = BigInt((await printed())!.open!);
  const band = { lowE8: openE8 - openE8 / 1000n, highE8: openE8 + openE8 / 1000n };
  const issue = await call("POST", "/api/ledger/tickets/range", { op: "issue", marketId: gapMarket, side: "inside", ...band, maxPayoutBase: 10_000_000n, maxStakeBase: 10_000_000n });
  const accept = issue.json.kind === "quote" ? await call("POST", "/api/ledger/tickets/range/accept", { commandId: randomUUID(), quoteCid: issue.json.quoteCid }) : null;
  rangeOk = accept?.json.kind === "confirmed";
  check("a range ticket (inside ±0.1% of the open print) on the Gap Window", rangeOk, accept?.json.kind ?? issue.json);
  if (accept?.json.updateId) updates["range ticket accept"] = accept.json.updateId;
}

// ---- 2. the events' attestations after the close ----------------------------------------------------------------
async function attest(marketId: string, answers: ("yes" | "no")[], label: string) {
  const question = marketId === yesId ? "Will the C6d drive's committee attest YES?" : "Will the C6d drive's committee agree?";
  for (const [i, role] of ORACLE_ROLES.entries()) {
    const member = p[role]!;
    const at = nowSec();
    const statement = eventStatementText({ marketId, question, answer: answers[i]!, source: EVENT_SOURCE, member: role, attestedAtSec: at });
    const out = await client.submitAndWaitForTransaction({
      actAs: [member], commandId: attestCommandId(member, marketId),
      commands: [cmd.createEventAttestation({ attestor: member, venue: p.venue!, resolver: p.resolver!, marketId, answer: answers[i] === "yes", attestedAtSec: at, statementHash: sha256(statement) })],
    });
    updates[`${label} attestation ${role}`] = out.transaction.updateId;
    log(`  ${role} ${answers[i]!.toUpperCase()} on ${marketId}: ${statement}`);
  }
}
await until(t0 + 181);
await attest(yesId, ["yes", "yes", "yes"], "event YES");
await attest(conflictId, ["yes", "no", "yes"], "event conflict");

// ---- 1d. the Gap's close print ------------------------------------------------------------------------------------
await until(gapWindow.expirySec + gapTerms!.minDelaySec + 1);
const gapOpenE8 = BigInt((await printed())?.open ?? "35000000000");
await awaitPrint("close", gapWindow.expirySec, () => gapOpenE8 + gapOpenE8 / 1000n);

// ---- 3. outcomes, settlement, receipts ----------------------------------------------------------------------------
const rowOf = async (marketKey: string) =>
  (await db`SELECT state, winner, void_detail, resolved_update_id, open_price_e8::text, close_price_e8::text, event_question, event_answer, event_verdict, event_state_cid, event_terms_cid FROM idx_markets WHERE market_key = ${marketKey}`)[0];
for (let i = 0; i < 60; i++) {
  const rows = await Promise.all([gapId, yesId, conflictId].map(rowOf));
  if (rows.every((r) => r && r.state !== "open")) break;
  await sleep(2_000);
}
const gapRow = await rowOf(gapId);
const gapWinner = gapRow?.winner === 0 ? "Up" : gapRow?.winner === 1 ? "Down" : "?";
check(`${gapId} resolved ${gapWinner} on its time-shifted Friday → Monday prints (${printSources.open} / ${printSources.close})`, gapRow?.state === "resolved" && (gapRow.winner === 0 || gapRow.winner === 1), gapRow && { open: gapRow.open_price_e8, close: gapRow.close_price_e8 });
if (gapRow?.resolved_update_id) updates["gap Terms_Resolve"] = gapRow.resolved_update_id;
const yesRow = await rowOf(yesId);
check(`${yesId} resolved YES (Event_Resolve, 3 of 3 attestations)`, yesRow?.state === "resolved" && yesRow.winner === 0 && yesRow.event_answer === true && yesRow.event_state_cid === null, yesRow && { answer: yesRow.event_answer, verdict: yesRow.event_verdict });
if (yesRow?.resolved_update_id) updates["event YES Event_Resolve"] = yesRow.resolved_update_id;
const cRow = await rowOf(conflictId);
check(`${conflictId} voided on the conflict (SourceDisagreement)`, cRow?.state === "voided" && cRow.void_detail === "SourceDisagreement:CloseSlot" && cRow.event_answer === null, cRow && { void: cRow.void_detail, verdict: cRow.event_verdict });
if (cRow?.resolved_update_id) updates["event conflict Event_Resolve (void)"] = cRow.resolved_update_id;

let receipts: any[] = [];
for (let i = 0; i < 90; i++) {
  const r = await call("GET", `/api/index/wallet/${address}/receipts`);
  receipts = (r.json.rows as any[]) ?? [];
  const markets = new Set(receipts.map((x) => x.market_key));
  const want = [gapMarket && gapId, yesMarket && yesId, conflictMarket && conflictId].filter(Boolean) as string[];
  if (want.every((m) => markets.has(m)) && (!rangeOk || receipts.some((x) => x.product === "range"))) break;
  await sleep(2_000);
}
const byKey = (k: string, product: string | null = null) => receipts.find((x) => x.market_key === k && x.product === product);
log(`receipts via the web route: ${j(receipts.map((x) => ({ market: x.market_key, product: x.product, outcome: x.outcome, resolved: x.resolved, cost: x.cost, payout: x.payout, fee: x.fee, question: x.event_question, detail: x.detail })))}`);
const gapR = byKey(gapId);
check(`the Gap leg's receipt records the ${gapWinner} outcome and pays accordingly (Up leg: 10 lots × 1,000 × cashUnit if Up, 0 if Down)`,
  !!gapR && gapR.resolved === gapRow?.winner && BigInt(gapR.payout) === (gapRow?.winner === 0 ? 10_000_000n : 0n), gapR && { cost: gapR.cost, payout: gapR.payout, resolved: gapR.resolved });
const yesR = byKey(yesId);
check("the YES event leg's receipt names the question and pays out", !!yesR && yesR.event_question === "Will the C6d drive's committee attest YES?" && BigInt(yesR.payout) > 0n, yesR && { payout: yesR.payout, question: yesR.event_question });
const cR = byKey(conflictId);
check("the conflict leg's receipt is a void refund (resolved null, payout = cost)", !!cR && cR.resolved === null && cR.payout === cR.cost, cR && { cost: cR.cost, payout: cR.payout });
if (rangeOk) {
  const rR = receipts.find((x) => x.product === "range");
  check("the range ticket's receipt carries product and payout breakdown", !!rR && rR.detail?.reserveId === "range" && typeof rR.detail?.pick === "string", rR && rR.detail);
}
const other = await fetch(`${SITE}/api/index/wallet/${address}/receipts`, { headers: { accept: "application/json" } });
check("the receipts route refuses a caller without the seat's proof", other.status === 403, other.status);
for (const r of receipts) if (r.signature) updates[`receipt ${r.market_key}${r.product ? ` ${r.product}` : ""}`] = r.signature;

const verdicts = await db`SELECT count(*)::int AS n FROM idx_event_attestations WHERE market_key IN (${yesId}, ${conflictId})`;
check("the projection holds all six attestations", verdicts[0]!.n === 6, verdicts[0]);
await db.end();

log("update ids:");
for (const [k, v] of Object.entries(updates)) log(`  ${k}: ${v}`);
log(`seat ${address}, run ${run}`);
log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
