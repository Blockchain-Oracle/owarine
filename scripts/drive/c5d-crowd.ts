/**
 * C5d: the crowd-flow floor (`/api/sentiment`, C-MKT-09) on a local stack. Each seat is held from this process through
 * the web's own routes (as `c4f-money.ts` holds one): it leases, places calls on a live lane, and publishes its legs
 * on that Window (`POST /api/ledger/publications`, `Leg_Publish`). The reading is printed after every round, so the
 * moment the fifth distinct publisher lands (k = 5) is on the record, as is everything below it.
 *
 *   tsx drive/c5d-crowd.ts seats --n 5                     lease n seats (keys in --dir, mode 600)
 *   tsx drive/c5d-crowd.ts round --seats 1-4 [--lane BTC-1m] [--side up|down|mix] [--no-publish]
 *   tsx drive/c5d-crowd.ts sentiment                       /api/sentiment as a visitor reads it
 *   tsx drive/c5d-crowd.ts reset --seats 1-5               let the seats go
 *
 *   env: C5D_WEB (http://localhost:3160), LEDGER_JSON_API_URL, AGARI_PARTIES_FILE, --dir <scratch>/crowd
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { randomUUID, webcrypto } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { messageBytes } from "@agari/core/auth";
import { encodeBase58, type Address } from "@agari/core/types";
import { TEMPLATE_IDS } from "@agari/daml";
import { createLedgerClient, noAuth } from "@agari/ledger";
import { parseMarketsEnv } from "@agari/markets";
import { decodeOpenPrint, decodeTerms, templateSuffix } from "@agari/markets/ops/canton";
import { appMarketId } from "@agari/markets/server";
import { readPartiesFile } from "../../services/ops/src/runtime/keys";
import { arg } from "./cli";
import { webClient, type Seat } from "./first-call/seat";

const WEB = process.env.C5D_WEB ?? "http://localhost:3160";
const DIR = arg("--dir", "crowd");
const cluster = parseMarketsEnv({ cluster: process.env.NEXT_PUBLIC_CANTON_NETWORK }).cluster;
const web = webClient(WEB, cluster);
const client = createLedgerClient({ baseUrl: process.env.LEDGER_JSON_API_URL ?? "http://localhost:7604", auth: noAuth(), userId: "c5d-crowd" });
const venue = readPartiesFile()?.parties.venue;
if (!venue) throw new Error("no parties file (AGARI_PARTIES_FILE)");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (s: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${s}`);

type Held = Seat & { jwk: webcrypto.JsonWebKey };

function range(spec: string): number[] {
  const [a, b] = spec.split("-").map(Number);
  return Array.from({ length: (b ?? a!) - a! + 1 }, (_, i) => a! + i);
}

async function load(i: number): Promise<Held> {
  const saved = JSON.parse(readFileSync(`${DIR}/seat-${i}.json`, "utf8")) as { address: string; jwk: webcrypto.JsonWebKey; cookie: string; party?: string; leaseId?: string };
  const key = await crypto.subtle.importKey("jwk", saved.jwk, { name: "Ed25519" }, false, ["sign"]);
  const sign = async (text: string) => encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, messageBytes(text) as Uint8Array<ArrayBuffer>)));
  return { name: `crowd-${i}`, address: saved.address as Address, sign, cookie: saved.cookie, party: saved.party, leaseId: saved.leaseId, jwk: saved.jwk };
}

function save(i: number, s: Held): void {
  writeFileSync(`${DIR}/seat-${i}.json`, JSON.stringify({ address: s.address, jwk: s.jwk, cookie: s.cookie, party: s.party, leaseId: s.leaseId }), { mode: 0o600 });
}

async function seats(): Promise<void> {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  for (let i = 1; i <= Number(arg("--n", "5")); i++) {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as { publicKey: webcrypto.CryptoKey; privateKey: webcrypto.CryptoKey };
    const address = encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) as Address;
    const sign = async (text: string) => encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, messageBytes(text) as Uint8Array<ArrayBuffer>)));
    const seat: Held = { name: `crowd-${i}`, address, sign, cookie: "", jwk: await crypto.subtle.exportKey("jwk", pair.privateKey) };
    const r = await web.lease(seat);
    if (r.json.kind !== "leased") throw new Error(`seat ${i}: lease refused ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    save(i, seat);
    log(`crowd-${i} ${address.slice(0, 4)}… leased ${seat.party?.split("::")[0]}`);
  }
}

/** The lane's Window that ops is quoting now: its open print recorded and at least 15 s before it locks (as c4f-money). */
async function quotingWindow(lane: string) {
  const now = Date.now() / 1000;
  const read = async <T>(tpl: string, decode: (v: unknown) => T) =>
    (await client.activeContracts({ parties: [venue!], templateIds: [tpl], maxPageSize: 500 })).contracts
      .filter((c) => templateSuffix(c.createdEvent.templateId) === templateSuffix(tpl))
      .map((c) => ({ cid: c.createdEvent.contractId, data: decode(c.createdEvent.createArgument) }));
  const terms = (await read(TEMPLATE_IDS.MarketTerms, decodeTerms)).filter((t) => t.data.seriesKey === lane && t.data.tradingStartSec <= now && t.data.lockAtSec - now >= 15);
  const opened = new Set((await read(TEMPLATE_IDS.OpenPrint, decodeOpenPrint)).map((o) => o.data.termsCid));
  return terms.find((t) => opened.has(t.cid));
}

async function place(seat: Held, marketId: string, side: "up" | "down"): Promise<string | null> {
  const stakeBase = 1_000_000n;
  const body = { marketId, side, stakeBase, displayedMaxCostBase: (stakeBase * 11n) / 10n };
  let q = await web.call(seat, "POST", "/api/ledger/quotes", body);
  if (q.json.kind === "requote") q = await web.call(seat, "POST", "/api/ledger/quotes", { ...body, displayedMaxCostBase: BigInt(q.json.quote.maxCostBase) });
  if (q.json.kind !== "quote") return log(`${seat.name}: no quote ${q.status} ${q.json.kind ?? ""} ${String(q.json.diagnosis?.technical ?? "").slice(0, 100)}`), null;
  const a = await web.call(seat, "POST", `/api/ledger/quotes/${q.json.quoteCid}/accept`, { commandId: randomUUID() });
  if (a.json.kind !== "confirmed") return log(`${seat.name}: accept ${a.status} ${JSON.stringify(a.json).slice(0, 200)}`), null;
  return String(a.json.updateId);
}

async function round(): Promise<void> {
  const lane = arg("--lane", "BTC-1m");
  const sideArg = arg("--side", "mix");
  const publish = !process.argv.includes("--no-publish");
  const ids = range(arg("--seats", "1-4"));
  const until = Date.now() + 150_000;
  let win = await quotingWindow(lane);
  while (!win && Date.now() < until) { await sleep(3_000); win = await quotingWindow(lane); }
  if (!win) throw new Error(`no quoting ${lane} Window in 150 s`);
  const marketId = appMarketId(win.data.marketId);
  log(`${lane} ${win.data.marketId} (${marketId})`);
  await Promise.all(ids.map(async (i, k) => {
    const seat = await load(i);
    const side = sideArg === "mix" ? (k % 3 === 2 ? "down" : "up") : (sideArg as "up" | "down");
    const update = await place(seat, marketId, side);
    if (!update) return;
    let line = `crowd-${i} ${side} filled ${update}`;
    if (publish) {
      const p = await web.call(seat, "POST", "/api/ledger/publications", { marketId });
      line += ` · publish ${p.status} ${p.json.kind ?? ""} ${p.json.updateId ?? p.json.published ?? ""}`;
    }
    save(i, seat);
    log(line);
  }));
  await sentiment();
}

async function sentiment(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${WEB}/api/sentiment`);
    log(`/api/sentiment ${r.status} ${await r.text()}`);
    await sleep(1_000);
  }
}

async function reset(): Promise<void> {
  for (const i of range(arg("--seats", "1-5"))) {
    const seat = await load(i);
    const r = await web.call(seat, "DELETE", "/api/seat");
    log(`crowd-${i} reset ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }
}

const steps: Record<string, () => Promise<void>> = { seats, round, sentiment, reset };
const step = steps[process.argv[2] ?? ""];
if (!step) throw new Error(`usage: c5d-crowd.ts ${Object.keys(steps).join("|")}`);
await step();
