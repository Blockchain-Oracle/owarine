/**
 * C4a integration: the seat routes end to end against a REAL local sandbox and a REAL `next start`.
 *
 * It allocates a venue, a resolver, three oracles, two seat parties and the personas; opens two short windows with
 * direct ledger calls; stands in for ops with an HMAC-checking mock of `/internal/quotes` (issuing the Quote directly
 * as the venue) and `/internal/seats/fund`; starts the built web app on :3120 with that configuration; then drives the
 * routes as a browser (cookie) and as a phone (signed header):
 *
 *   lease → balance → quote → accept (and the same command again) → positions → seat B sees nothing → views → CSRF →
 *   resolve → claimables → claim → stale refund → release → a recycled seat starts empty
 *
 *   (a sandbox with the current abu-pm-main, Postgres, `pnpm build` done; C2z re-ran it on engine 0.5.0)
 *   LEDGER_JSON_API_URL=http://localhost:7525 SEAT_IT_DB=postgres://…/pm_c2z_it pnpm --filter @agari/scripts exec tsx drive/seat-routes-it.ts
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID, webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { messageBytes, formatSeatReadHeader, seatReadText, SEAT_READ_HEADER } from "@agari/core/auth";
import { encodeBase58, type Address, type Signature } from "@agari/core/types";
import { createLedgerClient, fee, noAuth } from "@agari/ledger";
import { parseMarketsEnv, seatLeaseText, toWire } from "@agari/markets";
import { appMarketId, OPS_NONCE_HEADER, OPS_QUOTES_PATH, OPS_SEAT_FUND_PATH, OPS_SIG_HEADER, OPS_TS_HEADER, verifyOpsSignature } from "@agari/markets/server";
import { sandboxWorld, waitForLedger, type Window } from "./lib/sandbox-world";

const LEDGER = process.env.LEDGER_JSON_API_URL ?? "http://localhost:7595";
const DB = process.env.SEAT_IT_DB ?? "postgres://postgres:pm@localhost:5434/pm_c4a_it";
const WEB_PORT = 3120;
const OPS_PORT = 4199;
const SITE = `http://localhost:${WEB_PORT}`;
const OPS_SECRET = randomUUID() + randomUUID();
const COOKIE_SECRET = randomUUID() + randomUUID();
const RATE_BPS = 200n;
const CLUSTER = parseMarketsEnv({}).cluster;
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const client = createLedgerClient({ baseUrl: LEDGER, auth: noAuth(), userId: "c4a-it-driver" });
const run = `it${Date.now().toString(36)}`;
const world = sandboxWorld(client, run);
let failures = 0;
const log = (...a: unknown[]) => console.log(...a);
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- seat keys (what the browser's WebCrypto key does) ------------------------------------------------------

async function seatKey() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as { publicKey: webcrypto.CryptoKey; privateKey: webcrypto.CryptoKey };
  const address = encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) as Address;
  const sign = async (text: string) => encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, messageBytes(text) as Uint8Array<ArrayBuffer>)));
  return { address, sign, cookie: "" };
}
type Seat = Awaited<ReturnType<typeof seatKey>>;

async function call(seat: Seat | null, method: string, path: string, body?: unknown, o: { origin?: boolean; header?: boolean; cookie?: boolean } = {}) {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (seat && o.cookie !== false && seat.cookie) headers.cookie = seat.cookie;
  if (o.origin !== false) {
    headers.origin = SITE;
    headers["x-agari-seat"] = "1";
  }
  if (seat && o.header) {
    const now = Date.now();
    headers[SEAT_READ_HEADER] = formatSeatReadHeader({ address: seat.address, issuedAtMs: now, signature: (await seat.sign(seatReadText(seat.address, now, CLUSTER))) as Signature });
  }
  const res = await fetch(`${SITE}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(toWire(body)) }) });
  const setCookie = res.headers.get("set-cookie");
  if (seat && setCookie?.startsWith("agari_seat=")) seat.cookie = setCookie.split(";")[0]!;
  const json = (await res.json().catch(() => null)) as Record<string, any> | null;
  return { status: res.status, json: json ?? {} };
}

async function lease(seat: Seat) {
  const issuedAtMs = Date.now();
  return call(seat, "POST", "/api/seat", { address: seat.address, issuedAtMs, signature: await seat.sign(seatLeaseText(seat.address, issuedAtMs, CLUSTER)) });
}

// ---- the ops stand-in ---------------------------------------------------------------------------------------

/** `windows` is read at each request: the fast Window joins it only when the drive opens it (C2z). */
function mockOps(w: Awaited<ReturnType<typeof world.setup>>, windows: Window[]) {
  const byMarket = { get: (id: string) => windows.find((win) => appMarketId(win.marketId) === id) };
  const funded = new Set<string>();
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    const reply = (status: number, value: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(toWire(value)));
    };
    const signed = verifyOpsSignature(OPS_SECRET, { ts: req.headers[OPS_TS_HEADER] as string, nonce: (req.headers[OPS_NONCE_HEADER] as string) ?? null, sig: req.headers[OPS_SIG_HEADER] as string, method: req.method ?? "", path: req.url ?? "", body });
    if (!signed) return reply(401, { diagnosis: { kind: "rpc-down", retryable: false, technical: "bad ops signature" } });
    const r = JSON.parse(body);
    try {
      if (req.url === OPS_SEAT_FUND_PATH) {
        if (funded.has(r.leaseId)) return reply(200, { kind: "already" });
        await world.fund(w, r.party, 1_000_000_000n);
        funded.add(r.leaseId);
        return reply(200, { kind: "funded", amountBase: "1000000000" });
      }
      if (req.url === OPS_QUOTES_PATH) {
        const win = byMarket.get(r.marketId);
        if (!win) return reply(200, { kind: "refused", diagnosis: { kind: "market-not-trading", retryable: false, technical: "no such window" } });
        const ticks = 600n;
        const lots = BigInt(r.stakeBase) / (ticks * win.cashUnit);
        const feeBase = fee(lots, ticks, win.cashUnit, RATE_BPS);
        const cost = lots * ticks * win.cashUnit + feeBase;
        const quote = {
          side: r.side, stakeBase: r.stakeBase, contractsRaw: lots * 1000n * win.cashUnit, expectedCostBase: cost, maxCostBase: cost, limitPriceRaw: ticks * 1000n,
          avgPriceBps: 6000, oddsCents: 60, payoutIfRightBase: lots * 1000n * win.cashUnit, fillableStakeBase: BigInt(r.stakeBase), partial: false, feeBps: 200, decimals: 6, quotedAtMs: Date.now(),
        };
        if (cost > BigInt(r.displayedMaxCostBase)) return reply(200, { kind: "requote", quote });
        const validUntilMs = Math.min(Date.now() + 20_000, win.lockAtMs);
        const created = await world.issueQuote(w, win, { user: r.party, side: r.side === "up" ? "SideUp" : "SideDown", priceTicks: ticks, lots, fee: feeBase, validUntilMs });
        return reply(200, { kind: "quote", quoteCid: created.contractId, quote, validUntilMs });
      }
      reply(404, { diagnosis: { kind: "unknown", retryable: false, technical: "no such ops path" } });
    } catch (error) {
      reply(503, { diagnosis: { kind: "rpc-down", retryable: true, technical: String(error) } });
    }
  });
  return new Promise<typeof server>((ok) => server.listen(OPS_PORT, "127.0.0.1", () => ok(server)));
}

// ---- the web app ------------------------------------------------------------------------------------------------

function startWeb(partiesFile: string): ChildProcess {
  const child = spawn("pnpm", ["exec", "next", "start", "-p", String(WEB_PORT)], {
    cwd: join(root, "web"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      LEDGER_AUTH_MODE: "none",
      LEDGER_JSON_API_URL: LEDGER,
      LEDGER_USER_ID: "c4a-web",
      DATABASE_URL: DB,
      AGARI_SEAT_COOKIE_SECRET: COOKIE_SECRET,
      OPS_INTERNAL_URL: `http://127.0.0.1:${OPS_PORT}`,
      OPS_INTERNAL_SECRET: OPS_SECRET,
      AGARI_PARTIES_FILE: partiesFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => process.env.IT_VERBOSE && process.stdout.write(`[web] ${d}`));
  child.stderr?.on("data", (d) => process.stdout.write(`[web!] ${d}`));
  return child;
}

async function waitForWeb() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${SITE}/api/seat`);
      if (r.status < 500 || r.status === 503) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error("web did not start");
}

// ---- the drive -------------------------------------------------------------------------------------------------

async function main() {
  await waitForLedger(client);
  const w = await world.setup();
  const now = Date.now();
  const main = await world.openWindow(w, { seriesKey: `ITA${run}-60`, symbol: "ITA", cadenceSec: 60, lockLeadSec: 10, startsAtMs: now - 2_000 });
  log(`world: venue ${w.venue.slice(0, 24)}…, seats ${w.seatA.slice(0, 16)}… ${w.seatB.slice(0, 16)}…; window ${main.marketId} (the fast one opens when it is used)`);

  const dir = mkdtempSync(join(tmpdir(), "c4a-it-"));
  const partiesFile = join(dir, "parties.json");
  writeFileSync(partiesFile, JSON.stringify({ venue: w.venue, seats: [w.seatA, w.seatB], personas: { alice: w.alice, bob: w.bob, outsider: w.outsider } }));
  const windows: Window[] = [main];
  const ops = await mockOps(w, windows);
  const web = startWeb(partiesFile);
  try {
    await waitForWeb();
    const A = await seatKey();
    const B = await seatKey();

    const la = await lease(A);
    check("seat A leases a party and is funded on first lease", la.status === 200 && la.json.kind === "leased" && la.json.funded === true && [w.seatA, w.seatB].includes(la.json.party), { status: la.status, kind: la.json.kind, funded: la.json.funded });
    check("the lease sets an HttpOnly seat cookie", A.cookie.startsWith("agari_seat="));
    const partyA = la.json.party as string;

    const bal0 = await call(A, "GET", "/api/ledger/me/balance");
    check("balance reads the seat's demo cash as its party", bal0.status === 200 && bal0.json.value?.spendableBase === "1000000000" && bal0.json.party === partyA && bal0.json.address === A.address, bal0.json.value?.spendableBase);

    const marketId = appMarketId(main.marketId);
    const stakeBase = 60_000n;
    const tooLow = await call(A, "POST", "/api/ledger/quotes", { marketId, side: "up", stakeBase, displayedMaxCostBase: 1_000n });
    check("a cost above the confirmed cap is a requote (no contract)", tooLow.json.kind === "requote", tooLow.json.kind);
    const q = await call(A, "POST", "/api/ledger/quotes", { marketId, side: "up", stakeBase, displayedMaxCostBase: 100_000n });
    check("POST /api/ledger/quotes returns a firm quote from ops", q.status === 200 && q.json.kind === "quote" && typeof q.json.quoteCid === "string", q.json.kind);
    const openQ = await call(A, "GET", "/api/ledger/me/quotes");
    check("the seat sees its open quote", openQ.json.value?.some((x: { quoteCid: string }) => x.quoteCid === q.json.quoteCid));

    const csrf = await call(A, "POST", `/api/ledger/quotes/${q.json.quoteCid}/accept`, { commandId: randomUUID() }, { origin: false });
    check("a cookie write without our Origin and seat header is refused (403)", csrf.status === 403, csrf.status);

    const commandId = randomUUID();
    const acc = await call(A, "POST", `/api/ledger/quotes/${q.json.quoteCid}/accept`, { commandId });
    const booked = acc.json.booked;
    check("accept lands as seat A and books from the created Leg", acc.json.kind === "confirmed" && booked?.contractsRaw === "100000" && booked?.costBase === String(10n * 600n * 10n + fee(10n, 600n, 10n, RATE_BPS)) && /^1220/.test(acc.json.updateId), { kind: acc.json.kind, booked });
    const again = await call(A, "POST", `/api/ledger/quotes/${q.json.quoteCid}/accept`, { commandId });
    check("the same commandId again returns the landed transaction (no second leg)", again.json.kind === "confirmed" && again.json.recovered === true && again.json.updateId === acc.json.updateId, again.json);
    const status = await call(A, "GET", `/api/ledger/commands/${commandId}`);
    check("GET /api/ledger/commands/:id says landed for its own lease", status.json.status === "landed" && status.json.updateId === acc.json.updateId, status.json);

    // The fast window: a leg whose market never resolves, refunded by the seat alone after refundAfter.
    // C2z: the fast Window opens here, not at setup. It trades for 15 s, and on a loaded machine the steps above take
    // longer than that.
    const fast = await world.openWindow(w, { seriesKey: `ITB${run}-20`, symbol: "ITB", cadenceSec: 20, lockLeadSec: 5, startsAtMs: Date.now() - 2_000, closeAdmissionSec: 0, settleGraceSec: 1 });
    windows.push(fast);
    const fastQ = await call(A, "POST", "/api/ledger/quotes", { marketId: appMarketId(fast.marketId), side: "down", stakeBase: 60_000n, displayedMaxCostBase: 100_000n });
    const fastAcc = await call(A, "POST", `/api/ledger/quotes/${fastQ.json.quoteCid}/accept`, { commandId: randomUUID() });
    check("a second call on the fast window lands", fastAcc.json.kind === "confirmed", fastAcc.json.kind === "confirmed" ? fastAcc.json.kind : { quote: fastQ.json.kind, diagnosis: fastQ.json.diagnosis ?? fastAcc.json.diagnosis });
    const early = await call(A, "POST", "/api/ledger/legs/refund-stale", { commandId: randomUUID(), marketId: appMarketId(fast.marketId) });
    check("a stale refund before refundAfter is refused not-settled", early.json.kind === "refused" && early.json.diagnosis?.kind === "not-settled", early.json.diagnosis?.kind);

    // The open print, recorded while the window still admits it (before lockAt).
    const openCid = await world.recordOpen(w, main, 100_000_000n);

    const pos = await call(A, "GET", "/api/ledger/me/positions");
    const mainRow = pos.json.value?.find((r: { marketId: string }) => r.marketId === marketId);
    check("positions show the leg", pos.json.value?.length === 2 && mainRow?.balanceUpRaw === "100000" && mainRow?.asset === "ITA", pos.json.value);
    const phone = await call(A, "GET", "/api/ledger/me/positions", undefined, { cookie: false, header: true, origin: false });
    check("the phone path (signed seat header, no cookie) reads the same seat", phone.status === 200 && phone.json.value?.length === 2 && phone.json.party === partyA, phone.status);
    const nobody = await call(null, "GET", "/api/ledger/me/positions");
    check("no seat → 401 signer-required", nobody.status === 401 && nobody.json.diagnosis?.kind === "signer-required", nobody.status);

    const lb = await lease(B);
    check("seat B leases the other party", lb.json.kind === "leased" && lb.json.party !== partyA, lb.json.kind);
    const posB = await call(B, "GET", "/api/ledger/me/positions");
    check("seat B's positions are empty", posB.status === 200 && posB.json.value?.length === 0, posB.json.value);
    const statusB = await call(B, "GET", `/api/ledger/commands/${commandId}`);
    check("seat B cannot see seat A's command (404)", statusB.status === 404, statusB.status);
    const stealB = await call(B, "POST", `/api/ledger/quotes/${q.json.quoteCid}/accept`, { commandId });
    check("seat B presenting seat A's command id is refused", stealB.json.kind === "refused", stealB.json);

    const D = await seatKey();
    const full = await lease(D);
    check("a third seat gets pool-full with a position and next-free estimate", full.status === 409 && full.json.kind === "pool-full" && full.json.position === 1 && full.json.total === 2, full.json);

    const vOut = await call(null, "GET", "/api/view?as=outsider");
    check("/api/view?as=outsider is empty and echoes its filtersByParty", vOut.status === 200 && vOut.json.rows?.length === 0 && Object.keys(vOut.json.request?.eventFormat?.filtersByParty ?? {})[0] === w.outsider, { rows: vOut.json.rows?.length });
    const vMe = await call(A, "GET", "/api/view?as=me");
    check("/api/view?as=me shows seat A's leg and cash, queried as its party", vMe.json.party === partyA && vMe.json.rows?.some((r: { template: string }) => r.template === "PM.Leg:Leg"), vMe.json.rows?.map((r: { template: string }) => r.template));
    const vAlice = await call(null, "GET", "/api/view?as=alice");
    check("/api/view?as=alice sees none of seat A's contracts", vAlice.json.rows?.length === 0);
    const vBad = await call(null, "GET", `/api/view?as=${encodeURIComponent(partyA)}`);
    check("/api/view never takes a party from the query", vBad.status === 400, vBad.status);

    // Manual resolution of the main window: close print after expiry, Up wins.
    const preClaim = await call(A, "POST", "/api/ledger/legs/claim", { commandId: randomUUID(), marketId });
    check("a claim before resolution is refused not-settled", preClaim.json.kind === "refused" && preClaim.json.diagnosis?.kind === "not-settled", preClaim.json.diagnosis?.kind);
    const waitMs = Math.max(0, main.expiryMs - Date.now()) + 1_500;
    log(`… waiting ${Math.round(waitMs / 1000)} s for the window to expire`);
    await sleep(waitMs);
    await world.resolve(w, main, openCid, 101_000_000n);
    const claimables = await call(A, "GET", "/api/ledger/me/claimables");
    const winRow = claimables.json.value?.find((r: { marketId: string }) => r.marketId === marketId);
    check("claimables show the win after resolution", winRow?.kind === "win" && winRow?.netPayoutBase === "100000", winRow);
    const staleRow = claimables.json.value?.find((r: { marketId: string }) => r.marketId === appMarketId(fast.marketId));
    check("claimables show the fast window's stale refund", staleRow?.kind === "stale-refund", staleRow?.kind);
    const balBefore = BigInt((await call(A, "GET", "/api/ledger/me/balance")).json.value.spendableBase);
    const claim = await call(A, "POST", "/api/ledger/legs/claim", { commandId: randomUUID(), marketId });
    check("claim lands with the resolution disclosed and pays the winner", claim.json.kind === "confirmed" && claim.json.payoutBase === "100000" && claim.json.legs === 1, claim.json);
    const refund = await call(A, "POST", "/api/ledger/legs/refund-stale", { commandId: randomUUID(), marketId: appMarketId(fast.marketId) });
    check("the stale refund pays backing plus fee back", refund.json.kind === "confirmed" && BigInt(refund.json.payoutBase ?? 0) > 0n, refund.json);
    const balAfter = BigInt((await call(A, "GET", "/api/ledger/me/balance")).json.value.spendableBase);
    check("the balance rose by the claim and the refund", balAfter === balBefore + 100_000n + BigInt(refund.json.payoutBase ?? 0), `${balBefore} → ${balAfter}`);
    const posAfter = await call(A, "GET", "/api/ledger/me/positions");
    check("positions are empty after the exits", posAfter.json.value?.length === 0, posAfter.json.value);
    const reclaim = await call(A, "POST", "/api/ledger/legs/claim", { commandId: randomUUID(), marketId });
    check("claiming again is already-claimed", reclaim.json.diagnosis?.kind === "already-claimed", reclaim.json.diagnosis?.kind);

    // Release and recycle: seat B lets go; the next visitor gets that party back empty and freshly funded.
    const partyB = lb.json.party as string;
    const rel = await call(B, "DELETE", "/api/seat");
    check("DELETE /api/seat releases the lease and clears the cookie", rel.status === 200 && rel.json.kind === "none");
    const afterRel = await call(B, "GET", "/api/ledger/me/balance");
    check("the released cookie no longer reads the seat", afterRel.status === 401, afterRel.status);
    const C = await seatKey();
    const behind = await lease(C);
    check("a newcomer queues behind the visitor already waiting (FIFO)", behind.json.kind === "pool-full" && behind.json.position === 2, behind.json);
    const lc = await lease(D);
    check("the first waiting visitor gets the recycled party", lc.json.kind === "leased" && lc.json.party === partyB, lc.json);
    const balC = await call(D, "GET", "/api/ledger/me/balance");
    const posC = await call(D, "GET", "/api/ledger/me/positions");
    check("the recycled seat starts empty: only its own fresh funding, no positions", balC.json.value?.spendableBase === "1000000000" && posC.json.value?.length === 0, { balance: balC.json.value?.spendableBase, positions: posC.json.value?.length });
  } finally {
    web.kill("SIGTERM");
    ops.close();
  }
  log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
