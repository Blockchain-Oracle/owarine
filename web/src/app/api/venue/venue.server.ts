import "server-only";
import { getDb } from "@agari/db";
import { seatServer } from "@/lib/ledger.server";
import { marketFacts, seriesFacts, venueFacts, type MarketRowForFacts, type SeriesRow } from "./venue-facts";

/**
 * The projection reads behind `/api/venue/*`. The venue party is the projection's own stream party (`idx_cursor`), so
 * the facts need no ledger credential; the ledger is read only for the clock's ledger end, and only when the seat tier
 * is configured. Each read answers null when there is nothing to read (no database, nothing projected yet).
 */

export async function readVenueFacts() {
  const sql = getDb();
  if (!sql) return null;
  const [cursor] = await sql<{ party: string }[]>`SELECT party FROM idx_cursor ORDER BY stream LIMIT 1`;
  if (!cursor) return null;
  const series = await sql<SeriesRow[]>`
    SELECT series, series_key, symbol, basis, cadence_sec, cash_unit::text, lot_base::text, tick_base::text, policy_versions
    FROM idx_series ORDER BY series_key`;
  return { venue: venueFacts(cursor.party), series: series.map(seriesFacts) };
}

export async function readMarketFacts(marketId: string) {
  const sql = getDb();
  if (!sql) return undefined;
  const [row] = await sql<MarketRowForFacts[]>`
    SELECT market, series, terms_cid, market_index::text, state, trading_start_sec::text, lock_at_sec::text, expiry_sec::text,
      backing_lots::text, winner
    FROM idx_markets WHERE market = ${marketId}`;
  return row ? marketFacts(row) : null;
}

const LEDGER_END_TIMEOUT_MS = 1_500;

export type LedgerEndRead = { ok: true; offset: number } | { ok: false; why: string };

/**
 * The participant's ledger end, read from the ledger itself (never the projection's cursor), or why it could not be.
 * `/status` judges the ledger by this alone (C4e: with the ledger down it read "offset 0" in green).
 */
export async function readLedgerEnd(timeoutMs = LEDGER_END_TIMEOUT_MS): Promise<LedgerEndRead> {
  const tier = seatServer();
  if (!tier.ok) return { ok: false, why: tier.reason };
  return Promise.race([
    tier.server.client.ledgerEnd().then(
      (end): LedgerEndRead => ({ ok: true, offset: Number(end) }),
      (error: unknown): LedgerEndRead => ({ ok: false, why: error instanceof Error ? error.message : String(error) }),
    ),
    new Promise<LedgerEndRead>((resolve) => setTimeout(() => resolve({ ok: false, why: `no answer in ${timeoutMs / 1000} s` }), timeoutMs)),
  ]);
}

export async function readVenueClock() {
  const serverMs = Date.now();
  const end = await readLedgerEnd();
  let offset: number | null = end.ok ? end.offset : null;
  let recordTimeMs: number | null = null;
  const sql = getDb();
  if (sql) {
    const [cursor] = await sql<{ record_time_ms: string | null; ledger_offset: string }[]>`
      SELECT record_time_ms::text, ledger_offset::text FROM idx_cursor ORDER BY stream LIMIT 1`.catch(() => []);
    recordTimeMs = cursor?.record_time_ms ? Number(cursor.record_time_ms) : null;
    offset ??= cursor ? Number(cursor.ledger_offset) : null;
  }
  return { serverMs, offset, recordTimeMs };
}
