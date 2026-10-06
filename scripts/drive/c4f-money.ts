/**
 * C4f: the money a seat's screens show, against what its ledger did. One seat holds the lease from this process (the
 * phone's role in C11b: a key that signs, the seat cookie on our routes), places calls on a live lane through the web's
 * own routes, can take one call to a void by freezing ops across its close, links the seat to a browser that joins it,
 * and resets. Every step prints the ledger's own figures: the party's `VenueCash`, its legs and settlement receipts.
 *
 * The key is kept between steps in a scratch file (mode 600; a throwaway local seat, never a real one).
 *
 *   tsx drive/c4f-money.ts seat                              take a seat (writes --state)
 *   tsx drive/c4f-money.ts call --side up [--lane BTC-1m] [--lots 1] [--void-ops-pid N]
 *   tsx drive/c4f-money.ts link                              show a code (written to --state.code), allow the key that joins
 *   tsx drive/c4f-money.ts reset                             let the seat go
 *   tsx drive/c4f-money.ts ledger                            the seat's cash, legs and receipts as the ledger holds them
 *
 *   env: C4F_WEB (http://localhost:3160), LEDGER_JSON_API_URL, AGARI_PARTIES_FILE, --state <scratch>/c4f-seat.json
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { randomUUID, webcrypto } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { messageBytes } from "@agari/core/auth";
import { encodeBase58, type Address } from "@agari/core/types";
import { TEMPLATE_IDS } from "@agari/daml";
import { createLedgerClient, noAuth } from "@agari/ledger";
import { parseMarketsEnv } from "@agari/markets";
import { decodeLeg, decodeOpenPrint, decodeTerms, decodeVenueCash, templateSuffix } from "@agari/markets/ops/canton";
import { appMarketId } from "@agari/markets/server";
import { readPartiesFile } from "../../services/ops/src/runtime/keys";
import { arg } from "./cli";
import { webClient, type Seat } from "./first-call/seat";

const WEB = process.env.C4F_WEB ?? "http://localhost:3160";
const STATE = arg("--state", "c4f-seat.json");
const cluster = parseMarketsEnv({ cluster: process.env.NEXT_PUBLIC_CANTON_NETWORK }).cluster;
const web = webClient(WEB, cluster);
const client = createLedgerClient({ baseUrl: process.env.LEDGER_JSON_API_URL ?? "http://localhost:7604", auth: noAuth(), userId: "c4f-drive" });
const parties = readPartiesFile();
if (!parties) throw new Error("no parties file (AGARI_PARTIES_FILE)");
const venue = parties.parties.venue!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const credits = (base: bigint) => `${base < 0n ? "-" : ""}${(Number(base < 0n ? -base : base) / 1_000_000).toFixed(6)}`;
const stamp = () => new Date().toISOString().slice(11, 19);
const log = (s: string) => console.log(`${stamp()} ${s}`);

interface Saved {
  address: string;
  jwk: webcrypto.JsonWebKey;
  cookie: string;
  party?: string;
  leaseId?: string;
}

async function load(): Promise<Seat & { jwk: webcrypto.JsonWebKey }> {
  const saved = JSON.parse(readFileSync(STATE, "utf8")) as Saved;
  const key = await crypto.subtle.importKey("jwk", saved.jwk, { name: "Ed25519" }, false, ["sign"]);
  const sign = async (text: string) => encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, messageBytes(text) as Uint8Array<ArrayBuffer>)));
  return { name: "holder", address: saved.address as Address, sign, cookie: saved.cookie, party: saved.party, leaseId: saved.leaseId, jwk: saved.jwk };
}

function save(seat: Seat & { jwk: webcrypto.JsonWebKey }): void {
  const out: Saved = { address: seat.address, jwk: seat.jwk, cookie: seat.cookie, party: seat.party, leaseId: seat.leaseId };
  writeFileSync(STATE, JSON.stringify(out), { mode: 0o600 });
}

async function acs<T>(party: string, templateId: string, decode: (v: unknown) => T) {
  const { contracts } = await client.activeContracts({ parties: [party], templateIds: [templateId], maxPageSize: 500 });
  return contracts
    .filter((c) => templateSuffix(c.createdEvent.templateId) === templateSuffix(templateId))
    .map((c) => ({ cid: c.createdEvent.contractId, data: decode(c.createdEvent.createArgument), offset: c.createdEvent.offset, raw: c.createdEvent.createArgument as Record<string, unknown> }));
}

async function takeSeat(): Promise<void> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as { publicKey: webcrypto.CryptoKey; privateKey: webcrypto.CryptoKey };
  const address = encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) as Address;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const sign = async (text: string) => encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, messageBytes(text) as Uint8Array<ArrayBuffer>)));
  const seat: Seat & { jwk: webcrypto.JsonWebKey } = { name: "holder", address, sign, cookie: "", jwk };
  const r = await web.lease(seat);
  if (r.json.kind !== "leased") throw new Error(`lease refused: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  save(seat);
  log(`seat ${address} leased ${seat.party} (lease ${seat.leaseId})`);
  for (let i = 0; i < 30; i++) {
    const cash = await web.balance(seat).catch(() => 0n);
    if (cash > 0n) return log(`funded: ${credits(cash)} credits`);
    await sleep(2_000);
  }
  log("not funded after 60 s");
}

/** The lane's Window that ops is quoting now: its open print recorded and at least 15 s before it locks. */
async function quotingWindow(lane: string) {
  const now = Date.now() / 1000;
  const terms = (await acs(venue, TEMPLATE_IDS.MarketTerms, decodeTerms)).filter((t) => t.data.seriesKey === lane && t.data.tradingStartSec <= now && t.data.lockAtSec - now >= 15);
  const opened = new Set((await acs(venue, TEMPLATE_IDS.OpenPrint, decodeOpenPrint)).map((o) => o.data.termsCid));
  return terms.find((t) => opened.has(t.cid));
}

async function placeCall(): Promise<void> {
  const seat = await load();
  const lane = arg("--lane", "BTC-1m");
  const side = arg("--side", "up") as "up" | "down";
  const stakeBase = BigInt(Math.round(Number(arg("--stake", "1")) * 1_000_000));
  const opsPid = Number(arg("--void-ops-pid", "0"));
  const until = Date.now() + 180_000;
  for (;;) {
    const win = await quotingWindow(lane);
    if (win) {
      const marketId = appMarketId(win.data.marketId);
      const body = { marketId, side, stakeBase, displayedMaxCostBase: (stakeBase * 11n) / 10n };
      let q = await web.call(seat, "POST", "/api/ledger/quotes", body);
      if (q.json.kind === "requote") q = await web.call(seat, "POST", "/api/ledger/quotes", { ...body, displayedMaxCostBase: BigInt(q.json.quote.maxCostBase) });
      if (q.json.kind === "quote") {
        const accept = await web.call(seat, "POST", `/api/ledger/quotes/${q.json.quoteCid}/accept`, { commandId: randomUUID() });
        save(seat);
        log(`${lane} ${win.data.marketId} (${marketId}) ${side}: accept ${accept.status} ${accept.json.kind} update ${accept.json.updateId ?? "—"}`);
        if (accept.json.kind !== "confirmed") log(JSON.stringify(accept.json).slice(0, 400));
        const leg = (await acs(seat.party!, TEMPLATE_IDS.Leg, decodeLeg)).find((l) => l.data.owner === seat.party && l.data.marketId === win.data.marketId);
        if (leg) log(`leg ${leg.cid.slice(0, 16)}… ${leg.data.lots} lots ${leg.data.outcome}: backing ${credits(leg.data.backingShare)} + fee ${credits(leg.data.feePaid)} = ${credits(leg.data.backingShare + leg.data.feePaid)}`);
        log(`expiry ${new Date(win.data.expirySec * 1000).toISOString().slice(11, 19)}Z, close deadline ${new Date(win.data.closeDeadlineSec * 1000).toISOString().slice(11, 19)}Z`);
        if (opsPid > 0 && accept.json.kind === "confirmed") await freezeAcross(opsPid, win.data.expirySec, win.data.closeDeadlineSec);
        return;
      }
      log(`no quote yet: ${q.status} ${q.json.kind ?? ""} ${q.json.diagnosis?.kind ?? ""} ${String(q.json.diagnosis?.technical ?? "").slice(0, 120)}`);
    }
    if (Date.now() > until) throw new Error(`no firm quote on ${lane} in 180 s`);
    await sleep(3_000);
  }
}

/** SIGSTOP ops a few seconds before the close and SIGCONT it past the close deadline, so no close print lands (a void). */
async function freezeAcross(pid: number, expirySec: number, deadlineSec: number): Promise<void> {
  const stopAt = (expirySec - 5) * 1000;
  const resumeAt = (deadlineSec + 5) * 1000;
  await sleep(Math.max(0, stopAt - Date.now()));
  process.kill(pid, "SIGSTOP");
  log(`ops ${pid} stopped (SIGSTOP) until ${new Date(resumeAt).toISOString().slice(11, 19)}Z`);
  await sleep(Math.max(0, resumeAt - Date.now()));
  process.kill(pid, "SIGCONT");
  log(`ops ${pid} resumed (SIGCONT)`);
}

async function link(): Promise<void> {
  const seat = await load();
  const r = await web.call(seat, "POST", "/api/seat/link", {});
  const code = String(r.json.code ?? "");
  if (!code) throw new Error(`no link code: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  writeFileSync(`${STATE}.code`, code, { mode: 0o600 });
  log(`link code ${code} (written to ${STATE}.code); waiting for a device to use it`);
  for (let i = 0; i < 90; i++) {
    const s = await web.call(seat, "GET", `/api/seat/link?code=${encodeURIComponent(code)}`);
    if (s.json.state === "pending") {
      const c = await web.call(seat, "POST", "/api/seat/link/confirm", { code, allow: true });
      return log(`allowed key ${String(s.json.device ?? "?")}: ${c.status} ${JSON.stringify(c.json).slice(0, 200)}`);
    }
    if (s.json.state !== "showing") return log(`code ${s.json.state ?? `${s.status} ${JSON.stringify(s.json).slice(0, 200)}`}`);
    await sleep(1_000);
  }
}

async function reset(): Promise<void> {
  const seat = await load();
  const r = await web.call(seat, "DELETE", "/api/seat");
  log(`reset: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
}

async function ledger(): Promise<void> {
  const seat = await load();
  if (!seat.party) throw new Error("no party in the state file");
  const cash = (await acs(seat.party, TEMPLATE_IDS.VenueCash, decodeVenueCash)).filter((c) => c.data.owner === seat.party);
  const cashBase = cash.reduce((s, c) => s + c.data.amount, 0n);
  log(`ledger: ${seat.party.slice(0, 32)}… holds ${credits(cashBase)} credits in ${cash.length} VenueCash`);
  const legs = (await acs(seat.party, TEMPLATE_IDS.Leg, decodeLeg)).filter((l) => l.data.owner === seat.party);
  for (const l of legs) log(`  open leg ${l.data.marketId} ${l.data.outcome} ${l.data.lots} lots: backing ${credits(l.data.backingShare)} + fee ${credits(l.data.feePaid)}`);
  const receipts = await acs(seat.party, TEMPLATE_IDS.SettlementReceipt, (v) => v as Record<string, unknown>);
  let cost = 0n;
  let paid = 0n;
  for (const r of receipts) {
    const d = r.data;
    cost += BigInt(String(d.cost));
    paid += BigInt(String(d.payout));
    log(`  receipt ${String(d.pairId).slice(0, 24)} resolved ${JSON.stringify(d.resolved)}: cost ${credits(BigInt(String(d.cost)))} payout ${credits(BigInt(String(d.payout)))} fee ${credits(BigInt(String(d.fee ?? 0)))}`);
  }
  log(`  receipts: cost ${credits(cost)}, paid ${credits(paid)}, net ${credits(paid - cost)}`);
  const me = await web.call(seat, "GET", "/api/ledger/me/balance");
  log(`web /me/balance: ${me.status} ${me.json.value ? `spendable ${credits(BigInt(me.json.value.spendableBase))} vault ${me.json.value.vaultBase}` : JSON.stringify(me.json).slice(0, 200)}`);
}

const steps: Record<string, () => Promise<void>> = { seat: takeSeat, call: placeCall, link, reset, ledger };
const step = steps[process.argv[2] ?? ""];
if (!step) throw new Error(`usage: c4f-money.ts ${Object.keys(steps).join("|")}`);
await step();
