import "server-only";
import { candleUrl, identifySource, isExchange, reverify, type ArchivedPayload, type Exchange, type ProofSlot, type Refetch, type ReverifyReport, type SourceInput } from "@owarine/core/proof";
import { getDb, proofArchives, proofPrints, proofWindow } from "@owarine/db";
import type { MarketId } from "@owarine/core/types";
import { buildProofView, toProofResolution, type CantonProofView } from "./canton-proof";

/**
 * `/proof/<market>` reads and the re-verify run, server-side. The page's view comes from the projection; the re-verify
 * adds the archived exchange responses and one fresh public candle per (exchange, boundary). Null when there is no
 * database or no such Window.
 */
const FETCH_TIMEOUT_MS = 5_000;
/** One run per Window per minute across every viewer: the exchanges' public endpoints are rate-limited. */
const REPORT_REUSE_MS = 60_000;

/** The Window's view; null when the projection holds no such Window, "unreachable" when there is no projection to ask. */
export async function readCantonProof(marketId: MarketId): Promise<CantonProofView | null | "unreachable"> {
  const sql = getDb();
  if (!sql) return "unreachable";
  try {
    const row = await proofWindow(sql, marketId);
    if (!row) return null;
    const prints = row.symbol ? await proofPrints(sql, row.symbol, [Number(row.trading_start_sec), Number(row.expiry_sec)]) : [];
    return buildProofView(row, prints);
  } catch {
    // The projection being down costs the evidence, never the page.
    return "unreachable";
  }
}

export type Fetcher = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** A candle as the exchange serves it now; an HTTP error or a timeout is "can't re-fetch", never a failed check. */
async function refetch(fetcher: Fetcher, exchange: Exchange, symbol: string, boundarySec: number): Promise<Refetch> {
  try {
    const r = await fetcher(candleUrl(exchange, symbol, boundarySec), { headers: { "user-agent": "owarine-proof-reverify" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    if (!r.ok) return { kind: "unavailable", why: `the exchange answered HTTP ${r.status}` };
    return { kind: "ok", payload: await r.text() };
  } catch (error) {
    return { kind: "unavailable", why: error instanceof Error && error.name === "TimeoutError" ? "the exchange did not answer in 5 s" : "the exchange could not be reached" };
  }
}

export type ReverifyOutcome = { kind: "report"; report: ReverifyReport; atMs: number } | { kind: "unresolved" } | { kind: "unknown" } | { kind: "unavailable" };

const recent = new Map<string, { atMs: number; outcome: Promise<ReverifyOutcome> }>();

async function run(marketId: MarketId, fetcher: Fetcher): Promise<ReverifyOutcome> {
  const sql = getDb();
  if (!sql) return { kind: "unavailable" };
  const row = await proofWindow(sql, marketId);
  if (!row) return { kind: "unknown" };
  const resolution = toProofResolution(row);
  if (!resolution) return { kind: "unresolved" };
  const boundaries = { open: resolution.openBoundarySec, close: resolution.closeBoundarySec } satisfies Record<ProofSlot, number>;
  const archiveRows = await proofArchives(sql, resolution.symbol, Object.values(boundaries));
  const archivesAt = (sec: number): ArchivedPayload[] =>
    archiveRows.flatMap((a) => {
      const exchange = a.feed.split(":")[0] ?? "";
      return Number(a.boundary_sec) === sec && isExchange(exchange) ? [{ exchange, payload: a.payload }] : [];
    });

  const items = [
    ...resolution.openEvidence.map((item) => ({ slot: "open" as const, item })),
    ...resolution.closeEvidence.map((item) => ({ slot: "close" as const, item })),
  ].map(({ slot, item }) => ({ slot, item, source: identifySource(item, archivesAt(boundaries[slot])) }));

  // One fetch per (exchange, boundary), shared by every quote that needs it.
  const fetches = new Map<string, Promise<Refetch>>();
  const liveFor = (exchange: Exchange, sec: number) => {
    const key = `${exchange}:${sec}`;
    if (!fetches.has(key)) fetches.set(key, refetch(fetcher, exchange, resolution.symbol, sec));
    return fetches.get(key)!;
  };
  const sources: SourceInput[] = await Promise.all(
    items.map(async ({ slot, item, source }) => ({ slot, item, source, refetch: source.exchange ? await liveFor(source.exchange, boundaries[slot]) : null })),
  );
  return { kind: "report", report: reverify(resolution, sources), atMs: Date.now() };
}

export function reverifyMarket(marketId: MarketId, fetcher: Fetcher = fetch as Fetcher): Promise<ReverifyOutcome> {
  const now = Date.now();
  for (const [key, entry] of recent) if (now - entry.atMs > REPORT_REUSE_MS) recent.delete(key);
  const hit = recent.get(marketId);
  if (hit) return hit.outcome;
  const outcome = run(marketId, fetcher).catch((): ReverifyOutcome => ({ kind: "unavailable" }));
  recent.set(marketId, { atMs: now, outcome });
  // A failed run is not kept: the next click tries again.
  void outcome.then((o) => o.kind === "unavailable" && recent.delete(marketId));
  return outcome;
}
