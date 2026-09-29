/**
 * The Room's index reads (social-assistant.md §1.2): "ever bet" and the fill that proves a registry write. Read
 * straight from the indexer's tables with no HTTP hop, and read-only — S13 never writes `idx_*`.
 *
 * "Ever bet" is an `idx_positions` row with at least one fill (a leg taken from a venue quote). It stays true after the
 * seat sells out and after the Window settles, which is what the Room owes a bettor: the thread outlives the position.
 * These are the calling seat's own rows (the Room gate asks about its own caller); `owner` matches the seat address the
 * web bound to the party (`owner_address`) or the party id itself.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

/** Where a Window stands for the chain-seat step: "past" means the index already holds every fill it will get. */
export type IdxWindowState = "live" | "past" | "unknown";

/** Seconds after expiry before the index is trusted to hold every fill (the indexer lags ≈ 2 s; §1.2 allows 10). */
const INDEX_SETTLE_SEC = 60;

export function socialGateReader(sql: Sql) {
  return {
    /** Has `owner` ever filled or minted on this Window? */
    async everBet(market: string, owner: string): Promise<boolean> {
      const rows = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM idx_positions
        WHERE (owner_address = ${owner} OR owner_party = ${owner}) AND market = ${market} AND fills > 0
        LIMIT 1`;
      return rows.length > 0;
    },

    /** Has `owner` ever filled or minted on any Window of this ticker? (Q-S13-3: no lookback limit.) */
    async everBetOnSymbol(symbol: string, owner: string): Promise<boolean> {
      const rows = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM idx_positions p JOIN idx_markets m ON m.market = p.market
        WHERE (p.owner_address = ${owner} OR p.owner_party = ${owner}) AND m.symbol = ${symbol} AND p.fills > 0
        LIMIT 1`;
      return rows.length > 0;
    },

    /** A fill in ledger update `signature` (an update id; Canton updates are final) on this Window for `wallet`. */
    async fillBy(signature: string, market: string, wallet: string): Promise<boolean> {
      const rows = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM idx_fills f
        WHERE f.update_id = ${signature} AND f.market = ${market} AND (f.owner_address = ${wallet} OR f.owner_party = ${wallet})
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
