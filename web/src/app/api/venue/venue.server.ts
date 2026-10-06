import "server-only";
import { getDb } from "@agari/db";
import { isVenueMode, VENUE_MODE_CODE } from "@agari/core/market";
import { webEnv } from "@/lib/env";
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
  return { venue: venueFacts(cursor.party, await opsVenueModeCode()), series: series.map(seriesFacts) };
}

const MODE_READ_TIMEOUT_MS = 1_500;

/** ops' venue mode as the reference's code (C-DAML-02); 0 when ops cannot be read in time. */
async function opsVenueModeCode(): Promise<0 | 1 | 2> {
  const base = webEnv.markets.priceFeedUrl;
  if (!base) return 0;
  try {
    const body = (await (await fetch(`${base}/session`, { cache: "no-store", signal: AbortSignal.timeout(MODE_READ_TIMEOUT_MS) })).json()) as { venueMode?: { mode?: unknown } };
    const mode = body.venueMode?.mode;
    return isVenueMode(mode) ? VENUE_MODE_CODE[mode] : 0;
  } catch {
    return 0;
  }
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

export async function readVenueClock() {
  const serverMs = Date.now();
  let offset: number | null = null;
  const tier = seatServer();
  if (tier.ok) {
    offset = await Promise.race([
      tier.server.client.ledgerEnd().then((end) => Number(end), () => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LEDGER_END_TIMEOUT_MS)),
    ]);
  }
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
