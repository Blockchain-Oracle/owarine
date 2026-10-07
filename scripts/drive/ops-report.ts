/**
 * The C3 drive report: one row per Window of a lane, from the runner's venue events (`OPS_EVENTS_FILE`), the traffic
 * log (`TRAFFIC_EVENTS_FILE`) and the ledger itself, read as the venue. The duplicate check is the ledger's: one
 * `MarketTerms` per (series, index), one `PriceQuote` per (oracle, symbol, boundary), and at most one `Resolution` per
 * Window, whatever the runner's restarts did.
 *
 *   pnpm --filter @owarine/scripts exec tsx drive/ops-report.ts --series BTC-1m [--from-index 30]
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { readFileSync } from "node:fs";
import { createLedgerClient, noAuth, parseLedgerEnv } from "@owarine/ledger";
import { TEMPLATE_IDS } from "@owarine/daml";
import { decodePriceQuote, decodeResolution, decodeTerms, pick, readActive } from "@owarine/markets/ops/canton";
import { readPartiesFile } from "../../services/ops/src/runtime/keys";
import { arg } from "./cli";

type Ev = Record<string, unknown> & { kind: string; atMs: number; pid?: number };
const readJsonl = (path: string | undefined): Ev[] => {
  if (!path) return [];
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Ev);
  } catch {
    return [];
  }
};

const SERIES = arg("--series", "BTC-1m");
const FROM = Number(arg("--from-index", "0"));
const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });
const venue = readPartiesFile()?.parties.venue;
if (!venue) throw new Error("no venue party in the parties file");
const session = { role: "venue", party: venue, client, dryRun: false };

const venueEvents = readJsonl(process.env.OPS_EVENTS_FILE);
const traffic = readJsonl(process.env.TRAFFIC_EVENTS_FILE);
const acs = await readActive(session, [TEMPLATE_IDS.MarketTerms, TEMPLATE_IDS.Resolution, TEMPLATE_IDS.PriceQuote]);
const terms = pick(acs, TEMPLATE_IDS.MarketTerms, decodeTerms).filter((t) => t.data.seriesKey === SERIES && t.data.index >= FROM);
const resolutions = pick(acs, TEMPLATE_IDS.Resolution, decodeResolution);
const quotes = pick(acs, TEMPLATE_IDS.PriceQuote, decodePriceQuote);
const symbol = terms[0]?.data.symbol ?? SERIES.split("-")[0]!;

const perIndex = new Map<number, number>();
for (const t of terms) perIndex.set(t.data.index, (perIndex.get(t.data.index) ?? 0) + 1);
const quoteKeys = new Map<string, number>();
for (const q of quotes) {
  const k = `${q.data.oracle}|${q.data.symbol}|${q.data.boundarySec}`;
  quoteKeys.set(k, (quoteKeys.get(k) ?? 0) + 1);
}
const resPerTerms = new Map<string, number>();
for (const r of resolutions) resPerTerms.set(r.data.termsCid, (resPerTerms.get(r.data.termsCid) ?? 0) + 1);

const oraclesAt = (boundarySec: number) => new Set(quotes.filter((q) => q.data.symbol === symbol && q.data.boundarySec === boundarySec).map((q) => q.data.oracle)).size;
const price = (e8: bigint | null) => (e8 === null ? "-" : `${e8 / 100_000_000n}.${((e8 % 100_000_000n) / 1_000_000n).toString().padStart(2, "0")}`);
const hhmm = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 16);

console.log(`| Window | Span (UTC) | Opened by | Prints open/close | Open → close | Resolution | Quotes accepted | Legs settled | Terms / Resolutions on ledger |`);
console.log(`|---|---|---|---|---|---|---|---|---|`);
for (const t of [...terms].sort((a, b) => a.data.index - b.data.index)) {
  const id = t.data.marketId;
  const opened = venueEvents.find((e) => e.kind === "opened" && e.marketId === id);
  const res = resolutions.find((r) => r.data.termsCid === t.cid)?.data;
  const outcome = !res ? "unresolved" : res.outcome ? (res.outcome === "SideUp" ? "Up" : "Down") : `void: ${res.voidReason?.tag}(${res.voidReason?.slot})`;
  const traded = traffic.filter((e) => e.kind === "traded" && e.marketId === id);
  const settled = venueEvents.filter((e) => e.kind === "settled" && e.marketId === id).reduce((a, e) => a + Number(e.legs), 0);
  console.log(
    `| ${id} | ${hhmm(t.data.tradingStartSec)}–${hhmm(t.data.expirySec)} | ${opened ? `pid ${opened.pid}` : "earlier run"} | ${oraclesAt(t.data.tradingStartSec)}/${oraclesAt(t.data.expirySec)} | ${price(res?.openPriceE8 ?? null)} → ${price(res?.closePriceE8 ?? null)} | ${outcome}${res ? ` (${res.signers} signers)` : ""} | ${traded.length} | ${settled} | ${perIndex.get(t.data.index)} / ${resPerTerms.get(t.cid) ?? 0} |`,
  );
}
const dupTerms = [...perIndex.values()].filter((n) => n > 1).length;
const dupQuotes = [...quoteKeys.values()].filter((n) => n > 1).length;
const dupRes = [...resPerTerms.values()].filter((n) => n > 1).length;
console.log(`\nduplicates on the ledger: MarketTerms ${dupTerms}, PriceQuote ${dupQuotes} (of ${quoteKeys.size} keys), Resolution ${dupRes}`);
const pids = [...new Set(venueEvents.map((e) => e.pid))];
console.log(`runner processes seen in the event log: ${pids.join(", ")}`);
const lat = traffic.filter((e) => e.kind === "traded").map((e) => Number(e.httpMs)).sort((a, b) => a - b);
const acc = traffic.filter((e) => e.kind === "traded").map((e) => Number(e.acceptMs)).sort((a, b) => a - b);
const issue = venueEvents.filter((e) => e.kind === "quoted").map((e) => Number(e.issueMs)).sort((a, b) => a - b);
const pct = (xs: number[], p: number) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor(p * (xs.length - 1)))] : null);
console.log(`quote issue (ops, ledger round trip) p50 ${pct(issue, 0.5)} ms p95 ${pct(issue, 0.95)} ms (n ${issue.length}); POST /internal/quotes (client) p50 ${pct(lat, 0.5)} ms p95 ${pct(lat, 0.95)} ms; Quote_Accept p50 ${pct(acc, 0.5)} ms p95 ${pct(acc, 0.95)} ms`);
const settles = venueEvents.filter((e) => e.kind === "settled").map((e) => `${e.legs} legs/${e.batches} batch ${e.ms} ms`);
console.log(`settle batches: ${settles.join("; ")}`);
