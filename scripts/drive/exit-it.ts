/**
 * C7a integration: sell back on a REAL local stack (sandbox, the real ops process, `next dev`/`next start`). Drives the
 * routes as a browser seat does (cookie + CSRF header):
 *
 *   lease → balance → buy 100 Up (quote + accept) → positions (marked at the ladder mid) → exit quote for 50 →
 *   requote below a floor it cannot meet → accept the sale → the position halves and credits rise → the same command
 *   again answers the original sale → sell the rest → nothing held → the projector's SELL fills
 *
 * Latency is measured per call (quote, accept, exit quote, sale accept) and printed as p50 / max.
 *
 *   SITE=http://localhost:3150 LADDER=http://localhost:8807 DATABASE_URL=… pnpm --filter @agari/scripts exec tsx drive/exit-it.ts
 */
import { randomUUID, webcrypto } from "node:crypto";
import { messageBytes } from "@agari/core/auth";
import { encodeBase58, type Address } from "@agari/core/types";
import { parseMarketsEnv, seatLeaseText, toWire } from "@agari/markets";
import { feeFor } from "@agari/markets/ops/canton";
import postgres from "postgres";

const SITE = process.env.SITE ?? "http://localhost:3150";
const LADDER = process.env.LADDER ?? "http://localhost:8807";
const CLUSTER = parseMarketsEnv({ cluster: process.env.NEXT_PUBLIC_CANTON_NETWORK }).cluster;
const HOLD = Number(process.env.HOLD_SEC ?? "0");
let failures = 0;
const timings: Record<string, number[]> = {};
const log = (...a: unknown[]) => console.log(...a);
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as { publicKey: webcrypto.CryptoKey; privateKey: webcrypto.CryptoKey };
const address = encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) as Address;
const sign = async (text: string) => encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, messageBytes(text) as Uint8Array<ArrayBuffer>)));
let cookie = "";

async function call(method: string, path: string, body?: unknown, label?: string) {
  const headers: Record<string, string> = { accept: "application/json", origin: SITE, "x-agari-seat": "1" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  const t0 = performance.now();
  const res = await fetch(`${SITE}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(toWire(body)) }) });
  const ms = Math.round(performance.now() - t0);
  if (label) (timings[label] ??= []).push(ms);
  const setCookie = res.headers.get("set-cookie");
  if (setCookie?.startsWith("agari_seat=")) cookie = setCookie.split(";")[0]!;
  const json = (await res.json().catch(() => null)) as Record<string, any> | null;
  return { status: res.status, json: json ?? {}, ms };
}

const me = async (view: string) => (await call("GET", `/api/ledger/me/${view}`)).json.value;
const credits = async () => BigInt((await me("balance")).spendableBase);

/** A Window the venue quotes with at least `minLeftSec` of quoting time left. */
async function liveLadder(minLeftSec: number) {
  for (let i = 0; i < 90; i++) {
    const body = (await (await fetch(`${LADDER}/ladders/latest`)).json()) as { ladders: any[] };
    const nowSec = Date.now() / 1000;
    const l = body.ladders.find((x) => x.state === "quoting" && x.quotingUntilSec - nowSec >= minLeftSec && x.up.length > 0 && x.down.length > 0);
    if (l) return l;
    await sleep(2_000);
  }
  throw new Error("no quoting Window within 3 minutes");
}

// ---- 1. lease and fund ---------------------------------------------------------------------------------------
const issuedAtMs = Date.now();
const leased = await call("POST", "/api/seat", { address, issuedAtMs, signature: await sign(seatLeaseText(address, issuedAtMs, CLUSTER)) });
check("lease a seat", leased.status === 200 && leased.json.kind === "leased", leased.json.kind);
for (let i = 0; i < 20 && (await credits()) === 0n; i++) await sleep(1_000);
const c0 = await credits();
check("the seat holds demo credits", c0 > 0n, c0.toString());

// ---- 2. buy 100 Up -------------------------------------------------------------------------------------------
const ladder = await liveLadder(30);
const ask = ladder.up[0][0] as number;
const cu = BigInt(ladder.cashUnit);
const stake = 100n * BigInt(ask) * cu + feeFor(100n, ask, cu, ladder.feeRateBps);
log(`Window ${ladder.damlMarketId}: Up ask ${ask}, Down ask ${ladder.down[0][0]} (Up bid ${1000 - ladder.down[0][0]}), stake ${stake}`);
const q = await call("POST", "/api/ledger/quotes", { marketId: ladder.marketId, side: "up", stakeBase: stake, displayedMaxCostBase: stake }, "buy quote");
check("a firm buy quote", q.json.kind === "quote", q.json.kind ?? q.json);
const acc = await call("POST", `/api/ledger/quotes/${q.json.quoteCid}/accept`, { commandId: randomUUID() }, "buy accept");
check("buy 100 Up", acc.json.kind === "confirmed" && acc.json.booked.contractsRaw === String(100n * 1000n * cu), acc.json.booked ?? acc.json);
const c1 = await credits();
const [pos1] = await me("positions");
check("one position of 100 lots", pos1 && BigInt(pos1.balanceUpRaw) === 100n * 1000n * cu, pos1);
log(`  mark ${pos1?.markValueBase} (entry backing ${100n * BigInt(ask) * cu}), credits ${c0} → ${c1}`);

// ---- 3. sell 50 back -----------------------------------------------------------------------------------------
const half = 50n * 1000n * cu;
const tooHigh = await call("POST", "/api/ledger/exit-quotes", { marketId: ladder.marketId, side: "up", contractsRaw: half, displayedMinProceedsBase: half }, "exit quote");
check("a floor the bid cannot meet is a requote, nothing created", tooHigh.json.kind === "requote", tooHigh.json.exit ?? tooHigh.json);
const exitQ = await call("POST", "/api/ledger/exit-quotes", { marketId: ladder.marketId, side: "up", contractsRaw: half, displayedMinProceedsBase: BigInt(tooHigh.json.exit.minProceedsBase) }, "exit quote");
check("a firm exit quote for 50", exitQ.json.kind === "quote" && exitQ.json.exit.contractsRaw === String(half), exitQ.json);
const quoted = BigInt(exitQ.json.exit.minProceedsBase);
if (HOLD) await sleep(HOLD * 1000);
const commandId = randomUUID();
const [first, ...rest] = exitQ.json.quoteCids as string[];
const sold = await call("POST", `/api/ledger/exit-quotes/${first}/accept`, { commandId, with: rest }, "sale accept");
check("sell 50 at the quoted bid", sold.json.kind === "confirmed" && BigInt(sold.json.booked.proceedsBase) === quoted && sold.json.booked.contractsRaw === String(half), sold.json.booked ?? sold.json);
const c2 = await credits();
const [pos2] = await me("positions");
check("credits rise by exactly the proceeds", c2 - c1 === quoted, { before: c1.toString(), after: c2.toString(), proceeds: quoted.toString() });
check("the position halves", pos2 && BigInt(pos2.balanceUpRaw) === half, pos2?.balanceUpRaw);
const again = await call("POST", `/api/ledger/exit-quotes/${first}/accept`, { commandId, with: rest });
check("the same command again answers the original sale", again.json.kind === "confirmed" && again.json.updateId === sold.json.updateId && again.json.recovered === true, again.json.kind);
const stale = await call("POST", `/api/ledger/exit-quotes/${first}/accept`, { commandId: randomUUID(), with: rest });
check("a spent buy-back under a new command is order-expired", stale.json.kind === "refused" && stale.json.diagnosis.kind === "order-expired", stale.json.diagnosis?.kind);

// ---- 4. results ------------------------------------------------------------------------------------------------
const db = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1 }) : null;
if (db) {
  await sleep(4_000);
  const fills = await db`SELECT kind, lots::text, side_ticks FROM idx_fills WHERE update_id = ${sold.json.updateId}`;
  check("the projector books one SELL fill of 50 lots", fills.length === 1 && fills[0]!.lots === "50" && (fills[0]!.kind === 1 || fills[0]!.kind === 3), fills);
  await db.end();
}
const stat = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return `p50 ${s[Math.floor((s.length - 1) / 2)]} ms, max ${s[s.length - 1]} ms (n ${s.length})`;
};
for (const [k, v] of Object.entries(timings)) log(`latency ${k}: ${stat(v)}`);
log(`market ${ladder.marketId} (${ladder.damlMarketId}), seat ${address}`);
log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
