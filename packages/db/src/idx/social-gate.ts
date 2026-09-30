/**
 * The Room's index reads (social-assistant.md §1.2): "ever bet" and the fill that proves a registry write. Read
 * straight from the indexer's tables with no HTTP hop, and read-only — S13 never writes `idx_*`.
 *
 * "Ever bet" is at least one `idx_fills` row (a leg taken from a venue quote). It stays true after the seat sells out
 * and after the Window settles, which is what the Room owes a bettor: the thread outlives the position. These are the
 * calling seat's own rows (the Room gate asks about its own caller); `owner` is the seat's address, matched to the
 * party it leased at the fill's time (`seat_leases`), or the party id itself.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

/** Where a Window stands for the chain-seat step: "past" means the index already holds every fill it will get. */
export type IdxWindowState = "live" | "past" | "unknown";

/** Seconds after expiry before the index is trusted to hold every fill (the indexer lags ≈ 2 s; §1.2 allows 10). */
const INDEX_SETTLE_SEC = 60;

/**
 * C9d: whose fill is this? The projector knows the party; the Room asks with the seat's ADDRESS, and a guest seat's
 * party is recycled between visitors. So a fill is the wallet's when the wallet is the party itself, or when the wallet
 * held a lease on that party (`seat_leases`, the web's seat table) at the fill's time — never a later or earlier
 * visitor's fill on the same party. Without a seat table (no guest pool) only the direct match applies.
 */
function ownedBy(sql: Sql, wallet: string, withLeases: boolean) {
  const direct = sql`(f.owner_address = ${wallet} OR f.owner_party = ${wallet})`;
  if (!withLeases) return direct;
  return sql`(${direct} OR EXISTS (
    SELECT 1 FROM seat_leases l
    WHERE l.address = ${wallet} AND l.party = f.owner_party
      AND f.ts_sec * 1000 >= l.started_at_ms - ${LEASE_CLOCK_SLACK_MS}
      AND (l.ended_at_ms IS NULL OR f.ts_sec * 1000 <= l.ended_at_ms + ${LEASE_CLOCK_SLACK_MS})))`;
}

/** Ledger time is whole seconds and the lease clock is the web's: a fill is matched within this slack of the span. */
const LEASE_CLOCK_SLACK_MS = 2_000;

export function socialGateReader(sql: Sql) {
  let leases: Promise<boolean> | null = null;
  const hasLeases = () =>
    (leases ??= sql<{ ok: boolean }[]>`SELECT to_regclass('seat_leases') IS NOT NULL AS ok`.then(
      (r) => r[0]?.ok === true,
      () => ((leases = null), false),
    ));
  return {
    /** Has `owner` ever filled on this Window (a leg taken from a venue quote; a mint is a fill too)? */
    async everBet(market: string, owner: string): Promise<boolean> {
      const rows = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM idx_fills f
        WHERE f.market = ${market} AND ${ownedBy(sql, owner, await hasLeases())}
        LIMIT 1`;
      return rows.length > 0;
    },

    /** Has `owner` ever filled on any Window of this ticker? (Q-S13-3: no lookback limit.) */
    async everBetOnSymbol(symbol: string, owner: string): Promise<boolean> {
      const rows = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM idx_fills f JOIN idx_markets m ON m.market = f.market
        WHERE m.symbol = ${symbol} AND ${ownedBy(sql, owner, await hasLeases())}
        LIMIT 1`;
      return rows.length > 0;
    },

    /** A fill in ledger update `signature` (an update id; Canton updates are final) on this Window for `wallet`. */
    async fillBy(signature: string, market: string, wallet: string): Promise<boolean> {
      const rows = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM idx_fills f
        WHERE f.update_id = ${signature} AND f.market = ${market} AND ${ownedBy(sql, wallet, await hasLeases())}
        LIMIT 1`;
      return rows.length > 0;
    },

    /** Whether a fill on this Window could still be missing from the index. */
    async windowState(market: string, nowSec: number): Promise<IdxWindowState> {
      const [row] = await sql<{ state: string; expiry_sec: string | null }[]>`
        SELECT state, expiry_sec::text FROM idx_markets WHERE market = ${market}`;
      if (!row) return "unknown";
      const expired = row.expiry_sec !== null && Number(row.expiry_sec) + INDEX_SETTLE_SEC < nowSec;
      return row.state !== "open" || expired ? "past" : "live";
    },
  };
}

export type SocialGateReader = ReturnType<typeof socialGateReader>;
