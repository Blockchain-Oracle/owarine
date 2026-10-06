/**
 * Read queries over the projection for `/api/index/*`. The path table and the wire shapes (`MarketRow`, `PositionRow`,
 * `FillRow`, `ActionRow`, `RestingOrderRow` in `@agari/markets`) are the reference's; only the SQL behind them changed
 * (research 02 map item 29). Integers stay decimal strings.
 *
 * Canton mapping of the reference's columns: `book` is the Window's `terms_cid`, `ledger` and `seat` are null,
 * `signature` is the ledger `update_id`, `seq`/`slot` the ledger offset, complete sets never happen (minted/merged 0).
 *
 * Scope rules (privacy-thesis.md §4–5):
 * - `wallet*`, `positions`, `orders` are one seat's own rows; the route serves them only to that seat. `owner` matches
 *   the seat address the web binds (`owner_address`) or, for ops and tests, the party id itself.
 * - A seat party is recycled to later visitors (plan §4), so the web passes the visitor's `lease` (the party and the
 *   ledger offset its lease started at): a row of that party counts only from that offset on, and a recycled seat never
 *   shows the previous visitor's history (C13a). Without a lease, only the address match applies.
 * - Market aggregates (volume, trade count, last price, candles) are shown only with >= K_ANON_FLOOR participants.
 * - The public per-market tape (`fills?market=`) lists opt-in publications only.
 */
import type postgres from "postgres";
import { K_ANON_FLOOR } from "../schema-index";

type Sql = postgres.Sql;
export type IdxRow = Record<string, unknown>;

const LIMIT_MAX = 1_000;
const clamp = (limit: number | undefined, fallback = 200) => Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit ?? fallback)));
const skip = (offset: number | undefined) => Math.max(0, Math.floor(offset ?? 0));

export interface IdxFillQuery {
  market?: string;
  /** A Window's terms contract id (the reference's Book); callers may filter on either. */
  book?: string;
  sinceSec?: number;
  limit?: number;
  offset?: number;
  /** A seat's own fills: the visitor's lease (see `seatRowsOf`). */
  lease?: IdxSeatLease | null;
}

export interface IdxMarketQuery {
  market?: string;
  series?: string;
  symbol?: string;
  state?: "open" | "resolved" | "voided";
  /** Terminal Windows only (resolved or voided). */
  settled?: boolean;
  ids?: readonly string[];
  expiryFromSec?: number;
  expiryToSec?: number;
  limit?: number;
}

/** `MarketRow` columns over `idx_markets m` + `idx_series s` (aggregates behind the k floor). */
export function marketCols(sql: Sql) {
  const k = K_ANON_FLOOR;
  return sql`
    m.market, m.market_key, m.terms_cid, m.series, m.series_key, m.symbol, m.cadence_sec, m.basis, m.market_index::text, m.trading_start_sec::text,
    m.lock_at_sec::text, m.expiry_sec::text, m.open_deadline_sec::text, m.close_deadline_sec::text, m.refund_after_sec::text, m.policy_version, m.print_source,
    m.terms_cid AS book, NULL::text AS ledger, m.state, m.winner,
    (CASE WHEN m.state = 'resolved' THEN (CASE WHEN m.winner = 0 THEN m.cash_unit * 1000 ELSE 0 END) END)::text AS payout_yes,
    (CASE WHEN m.state = 'resolved' THEN (CASE WHEN m.winner = 1 THEN m.cash_unit * 1000 ELSE 0 END) END)::text AS payout_no,
    m.void_reason, m.void_detail, m.single_source, m.signers, m.resolution_cid, m.resolved_ts_sec::text, m.resolved_update_id AS resolved_signature,
    m.opened_update_id AS opened_signature, m.opened_ts_sec::text AS opened_block_time_sec,
    (m.participants >= ${k}) AS stats_public,
    (CASE WHEN m.participants >= ${k} THEN m.backing_lots ELSE 0 END)::text AS backing_lots,
    (CASE WHEN m.participants >= ${k} THEN m.volume_lots ELSE 0 END)::text AS volume_lots,
    (CASE WHEN m.participants >= ${k} THEN m.volume_ticklots ELSE 0 END)::text AS volume_ticklots,
    (CASE WHEN m.participants >= ${k} THEN m.trade_count ELSE 0 END)::text AS trade_count,
    (CASE WHEN m.participants >= ${k} THEN m.last_price_ticks END) AS last_price_ticks,
    (CASE WHEN m.participants >= ${k} THEN m.last_trade_sec END)::text AS last_trade_sec,
    s.lot_base::text, s.tick_base::text, COALESCE(s.cash_unit, m.cash_unit)::text AS cash_unit,
    m.event_question, m.event_answer, m.event_verdict`;
}

/** `FillRow` columns over `idx_fills f` (the maker is the venue: a mint's counter-leg, or the buyer of a sale). */
export function fillCols(sql: Sql, taker: postgres.PendingQuery<postgres.Row[]> = sql`COALESCE(f.owner_address, f.owner_party)`) {
  return sql`
    f.update_id AS signature, 0 AS outer_ix, f.node_id AS inner_ix, 0 AS fill_ix, f.market, f.terms_cid AS book, f.ledger_offset::text AS seq,
    f.ledger_offset::text AS slot, f.ts_sec::text, ${taker} AS taker, 0 AS taker_seat, f.kind AS taker_kind,
    f.venue_party AS maker, 0 AS maker_seat, (CASE f.kind WHEN 0 THEN 2 WHEN 2 THEN 0 WHEN 1 THEN 0 ELSE 2 END) AS maker_kind, f.path,
    f.price_ticks, f.side_ticks, f.lots::text, f.fee::text, f.quote_cid, f.leg_cid, f.pair_id, 'finalized' AS commitment`;
}

export const ownerIs = (sql: Sql, alias: string, owner: string) =>
  sql`(${sql(alias)}.owner_address = ${owner} OR ${sql(alias)}.owner_party = ${owner})`;

/** The web's seat lease for a lease-scoped read: the party the visitor holds and the offset the lease started at. */
export interface IdxSeatLease {
  party: string;
  fromOffset: number;
}

/**
 * One seat's rows: the owner match, or the leased party's rows from the lease's start offset on (`offsetCol` is the
 * row's own creation offset). The previous visitor's rows of a recycled party all sit before that offset.
 */
export const seatRowsOf = (sql: Sql, alias: string, owner: string, lease: IdxSeatLease | null | undefined, offsetCol: string, partyCol = "owner_party") =>
  lease
    ? sql`(${ownerIs(sql, alias, owner)} OR (${sql(alias)}.${sql(partyCol)} = ${lease.party} AND ${sql(alias)}.${sql(offsetCol)} >= ${lease.fromOffset}))`
    : ownerIs(sql, alias, owner);

export function indexReader(sql: Sql) {
  return {
    /**
     * A seat's own fills, newest first (Masayume `getUserFills`). Every row here is the seat's (its address or its leased
     * party), so `taker` names the wallet asked for: the replay attributes a fill to the wallet only when `taker` equals
     * it, and the projector writes no `owner_address` for a leased party, so the default label (the party id) made every
     * own buy replay as the complement side. Found twice on 6 Oct: C9e (a won call read "Stake 0.14, +609%") and C11b
     * on the phone ("+0.82 credits, 67 %" on a seat that lost 0.83 over three calls).
     */
    async walletFills(wallet: string, q: IdxFillQuery = {}): Promise<IdxRow[]> {
      return sql`
        SELECT ${fillCols(sql, sql`${wallet}::text`)} FROM idx_fills f
        WHERE ${seatRowsOf(sql, "f", wallet, q.lease, "ledger_offset")}
          ${q.market ? sql`AND f.market = ${q.market}` : sql``} ${q.book ? sql`AND f.terms_cid = ${q.book}` : sql``}
          ${q.sinceSec !== undefined ? sql`AND f.ts_sec >= ${q.sinceSec}` : sql``}
        ORDER BY f.ts_sec DESC, f.ledger_offset DESC, f.node_id DESC LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
    },

    /** One Window's public tape: published trades only, newest first (Masayume `getFills(pool)`). */
    async fills(q: IdxFillQuery): Promise<IdxRow[]> {
      return sql`
        SELECT ${fillCols(sql, sql`COALESCE(p.owner_address, p.handle)`)}, p.handle FROM idx_publications p
          JOIN idx_fills f ON f.owner_party = p.owner_party AND f.pair_id = p.pair_id AND f.market = p.market AND f.kind IN (0, 2) AND p.product IS NULL
        WHERE true ${q.market ? sql`AND p.market = ${q.market}` : sql``} ${q.book ? sql`AND f.terms_cid = ${q.book}` : sql``}
          ${q.sinceSec !== undefined ? sql`AND f.ts_sec >= ${q.sinceSec}` : sql``}
        ORDER BY f.ts_sec DESC, f.ledger_offset DESC LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
    },

    /** A seat's leg exits as the reference's `Redeemed` actions (Masayume `getRouterActions`); complete sets never happen. */
    async walletActions(wallet: string, q: { limit?: number; offset?: number; lease?: IdxSeatLease | null } = {}): Promise<IdxRow[]> {
      return sql`
        SELECT l.closed_update_id AS signature, 'Redeemed' AS name, l.market, l.closed_offset::text AS seq, l.closed_ts_sec::text AS block_time_sec,
          json_build_object('owner', COALESCE(l.owner_address, l.owner_party), 'byCrank', l.status = 'settled', 'how', l.status, 'result', l.result,
            'payout', l.payout_base::text, 'lots', l.lots::text, 'outcome', l.outcome, 'legCid', l.leg_cid) AS data, 'finalized' AS commitment
        FROM idx_legs l
        WHERE ${seatRowsOf(sql, "l", wallet, q.lease, "created_offset")} AND NOT l.is_venue AND l.status IN ('settled', 'claimed', 'refunded_stale', 'closed_out')
        ORDER BY l.closed_offset DESC, l.leg_cid LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
    },

    /**
     * A seat's settlement receipts (0.4.0, K-028/K-030): pair legs and tickets alike, newest first, with the Window's
     * facts. `owner` matches the bound address or the party; `lease` (the web's seat lease) adds that party's receipts
     * from the lease's start offset on, so a new visitor never sees the last one's (plan §4).
     */
    async walletReceipts(owner: string, q: { lease?: IdxSeatLease | null; limit?: number } = {}): Promise<IdxRow[]> {
      return sql`
        SELECT r.receipt_cid, r.market, r.market_key, r.pair_id, r.outcome, r.resolved, r.lots::text, r.cash_unit::text, r.backing_share::text,
          r.cost::text, r.payout::text, r.fee::text, r.product, r.detail, r.created_update_id AS signature, r.created_offset::text AS seq,
          r.created_ts_sec::text AS ts_sec, m.symbol, m.cadence_sec, m.basis, m.expiry_sec::text, m.state, m.winner, m.void_reason, m.void_detail,
          m.resolved_ts_sec::text, m.event_question, m.event_answer
        FROM idx_receipts r LEFT JOIN idx_markets m ON m.market = r.market
        WHERE NOT r.dismissed AND ${seatRowsOf(sql, "r", owner, q.lease, "created_offset")}
        ORDER BY r.created_offset DESC, r.receipt_cid LIMIT ${clamp(q.limit)}`;
    },

    /** Windows with their Series facts and prints (Masayume `listLive/PastBinaryMarkets`, `getBinaryMarket`). */
    async markets(q: IdxMarketQuery = {}): Promise<IdxRow[]> {
      return sql`
        SELECT ${marketCols(sql)},
          (SELECT json_object_agg(p.which, json_build_object('source', p.source, 'price', p.price::text, 'expo', p.expo, 'sourceTsSec', p.source_ts_sec,
             'signers', p.signers, 'copied', p.copied, 'signature', p.signature)) FROM idx_market_prints p WHERE p.market = m.market) AS prints
        FROM idx_markets m LEFT JOIN idx_series s ON s.series = m.series
        WHERE true
          ${q.market ? sql`AND m.market = ${q.market}` : sql``} ${q.series ? sql`AND m.series = ${q.series}` : sql``}
          ${q.symbol ? sql`AND m.symbol = ${q.symbol}` : sql``} ${q.state ? sql`AND m.state = ${q.state}` : sql``}
          ${q.settled ? sql`AND m.state <> 'open'` : sql``} ${q.ids ? sql`AND m.market = ANY(${q.ids as string[]}::text[])` : sql``}
          ${q.expiryFromSec !== undefined ? sql`AND m.expiry_sec >= ${q.expiryFromSec}` : sql``}
          ${q.expiryToSec !== undefined ? sql`AND m.expiry_sec <= ${q.expiryToSec}` : sql``}
        ORDER BY m.expiry_sec DESC, m.market LIMIT ${clamp(q.limit)}`;
    },

    async marketsByIds(ids: readonly string[]): Promise<IdxRow[]> {
      if (ids.length === 0) return [];
      return this.markets({ ids, limit: ids.length });
    },

    /** Opening prints by Window (Masayume `getOpeningPrices`). */
    async openingPrints(markets: readonly string[]): Promise<IdxRow[]> {
      if (markets.length === 0) return [];
      return sql`SELECT market, source, price::text, expo, source_ts_sec::text, signers FROM idx_market_prints WHERE which = 0 AND market = ANY(${markets as string[]}::text[])`;
    },

    /**
     * Oracle prints of a ticker over time, one row per boundary: the lower median of the oracles' posts (the rule the
     * resolution applies) and how many oracles posted. Every lane of a symbol shares one print per boundary.
     */
    async printHistory(symbol: string, fromSec: number, toSec: number, limit?: number, _basis?: number): Promise<IdxRow[]> {
      return sql`
        SELECT boundary_sec::text AS source_ts_sec, 4 AS source, (percentile_disc(0.5) WITHIN GROUP (ORDER BY price_e8))::text AS price, -8 AS expo,
          count(*)::int AS signers
        FROM idx_prints WHERE symbol = ${symbol} AND boundary_sec BETWEEN ${fromSec} AND ${toSec} AND chosen
        GROUP BY boundary_sec ORDER BY boundary_sec LIMIT ${clamp(limit, 500)}`;
    },

    /** The signed 5-minute archive series (D-086), unchanged: `print_archive` is off-ledger evidence. */
    async printArchiveSeries(keys: readonly { source: string; feed: string }[], fromSec: number, toSec: number, limit?: number): Promise<IdxRow[]> {
      if (keys.length === 0) return [];
      const sources = [...new Set(keys.map((k) => k.source))];
      const feeds = [...new Set(keys.map((k) => k.feed))];
      return sql`
        SELECT DISTINCT ON (boundary_sec) boundary_sec::text, source, price_e8, signers FROM print_archive
        WHERE source = ANY(${sources}::text[]) AND feed = ANY(${feeds}::text[]) AND boundary_sec BETWEEN ${fromSec} AND ${toSec}
        ORDER BY boundary_sec, (source = 'redstone') DESC LIMIT ${clamp(limit, 500)}`;
    },

    /**
     * A seat's positions with the Window's state (Masayume `getPortfolio`). A position row sums one (Window, party), so
     * under a lease it counts only when the party has no fill in that Window before the lease began: a Window the
     * previous visitor also traded is withheld rather than merged (their legs had all ended before the party was freed,
     * and the visitor's own receipts and live contracts still show it).
     */
    async positions(owner: string, q: { unredeemedOnly?: boolean; limit?: number; lease?: IdxSeatLease | null } = {}): Promise<IdxRow[]> {
      const k = K_ANON_FLOOR;
      const lease = q.lease ?? null;
      return sql`
        SELECT p.market, COALESCE(p.owner_address, p.owner_party) AS owner, p.owner_party, NULL::int AS seat,
          p.yes_lots::text, p.no_lots::text, p.bought_yes_lots::text, p.sold_yes_lots::text, p.bought_no_lots::text, p.sold_no_lots::text,
          p.paid_ticklots::text, p.received_ticklots::text, '0' AS minted_lots, '0' AS merged_lots, '0' AS set_paid_base, '0' AS set_received_base,
          p.fees_paid_base::text, p.payout_base::text, p.refunded_base::text, p.open_legs, p.redeemed, p.redeemed_by_crank, p.refunded_stale, p.closed_out,
          p.fills, p.first_ts_sec::text, p.last_ts_sec::text, p.entry_update_id AS entry_signature, p.last_update_id AS last_signature,
          m.symbol, m.cadence_sec, m.expiry_sec::text, m.lock_at_sec::text, m.trading_start_sec::text, m.refund_after_sec::text, m.state, m.winner,
          m.void_reason, m.resolved_ts_sec::text, COALESCE(s.cash_unit, m.cash_unit)::text AS cash_unit, s.lot_base::text, s.tick_base::text,
          (CASE WHEN m.participants >= ${k} THEN m.last_price_ticks END) AS last_price_ticks, m.series, NULL::text AS ledger, m.terms_cid
        FROM idx_positions p JOIN idx_markets m ON m.market = p.market LEFT JOIN idx_series s ON s.series = m.series
        WHERE (${ownerIs(sql, "p", owner)}
          ${lease ? sql`OR (p.owner_party = ${lease.party} AND NOT EXISTS (SELECT 1 FROM idx_fills pf
            WHERE pf.owner_party = p.owner_party AND pf.market = p.market AND pf.ledger_offset < ${lease.fromOffset}))` : sql``})
          ${q.unredeemedOnly ? sql`AND NOT p.redeemed` : sql``}
        ORDER BY p.last_ts_sec DESC NULLS LAST LIMIT ${clamp(q.limit)}`;
    },

    /** A seat's live and accepted quotes in the reference's `idx_orders` row shape; `openOnly` keeps live ones. */
    async orders(q: { owner?: string; market?: string; openOnly?: boolean; limit?: number; lease?: IdxSeatLease | null }): Promise<IdxRow[]> {
      return sql`
        SELECT q.issued_update_id AS signature, q.quote_cid, q.kind AS quote_kind, q.market, COALESCE(q.user_address, q.user_party) AS owner, 0 AS seat,
          (CASE WHEN q.kind = 'quote' THEN (CASE WHEN q.side = 0 THEN 0 ELSE 2 END) ELSE (CASE WHEN q.side = 0 THEN 1 ELSE 3 END) END) AS kind,
          3 AS order_type, (CASE WHEN q.side = 0 THEN q.price_ticks ELSE 1000 - q.price_ticks END) AS limit_price, q.price_ticks AS side_ticks,
          q.lots::text, (CASE WHEN q.status = 'accepted' THEN q.lots ELSE 0 END)::text AS filled_lots, q.lots::text AS rested_lots,
          (CASE WHEN q.status = 'issued' THEN q.lots ELSE 0 END)::text AS remaining_lots, q.fee::text, q.valid_until_sec::text AS expire_ts_sec,
          q.issued_ts_sec::text AS ts_sec, (CASE q.status WHEN 'issued' THEN 'open' WHEN 'accepted' THEN 'filled' ELSE q.status END) AS status,
          NULL::bigint AS rested_node, NULL::text AS rested_seq, q.leg_cid, q.pair_id
        FROM idx_quotes q
        WHERE true ${q.owner ? sql`AND (q.user_address = ${q.owner} OR q.user_party = ${q.owner}
          ${q.lease ? sql`OR (q.user_party = ${q.lease.party} AND q.issued_offset >= ${q.lease.fromOffset})` : sql``})` : sql``}
          ${q.market ? sql`AND q.market = ${q.market}` : sql``} ${q.openOnly ? sql`AND q.status = 'issued'` : sql``}
        ORDER BY q.issued_ts_sec DESC, q.issued_offset DESC LIMIT ${clamp(q.limit)}`;
    },

    /**
     * A seat's resting calls (0.5.1) in the reference's `idx_orders` row shape (`RestingOrderRow`), newest first: what rests,
     * and how each ended (filled, cancelled, expired unfilled with its refund). Per-user, under the caller's lease like
     * `orders`. An UP call is a BUY_YES at its price (kind 0), a DOWN call a BUY_NO at the pair's complement (kind 2).
     */
    async restingCalls(q: { owner?: string; market?: string; openOnly?: boolean; limit?: number; lease?: IdxSeatLease | null }): Promise<IdxRow[]> {
      return sql`
        SELECT r.placed_update_id AS signature, r.call_ref, r.call_cid, r.market, COALESCE(r.user_address, r.user_party) AS owner, 0 AS seat,
          (CASE WHEN r.side = 0 THEN 0 ELSE 2 END) AS kind, 3 AS order_type,
          (CASE WHEN r.side = 0 THEN r.price_ticks ELSE 1000 - r.price_ticks END) AS limit_price, r.price_ticks AS side_ticks,
          r.lots_placed::text AS lots, (r.lots_placed - r.lots_remaining)::text AS filled_lots, r.lots_placed::text AS rested_lots,
          (CASE WHEN r.status = 'open' THEN r.lots_remaining ELSE 0 END)::text AS remaining_lots, r.expires_at_sec::text AS expire_ts_sec,
          r.placed_ts_sec::text AS ts_sec, r.status AS status,
          r.refunded_base::text AS refunded_base, r.closed_ts_sec::text AS closed_ts_sec
        FROM idx_resting r
        WHERE true ${q.owner ? sql`AND (r.user_address = ${q.owner} OR r.user_party = ${q.owner}
          ${q.lease ? sql`OR (r.user_party = ${q.lease.party} AND r.placed_offset >= ${q.lease.fromOffset})` : sql``})` : sql``}
          ${q.market ? sql`AND r.market = ${q.market}` : sql``} ${q.openOnly ? sql`AND r.status = 'open'` : sql``}
        ORDER BY r.placed_ts_sec DESC, r.placed_offset DESC LIMIT ${clamp(q.limit)}`;
    },

    /** One Window's minute candles, only above the k floor. */
    async candles(market: string, fromSec: number, toSec: number): Promise<IdxRow[]> {
      return sql`SELECT c.bucket_sec::text, c.open_ticks, c.high_ticks, c.low_ticks, c.close_ticks, c.volume_lots::text, c.trades
        FROM idx_candles c JOIN idx_markets m ON m.market = c.market AND m.participants >= ${K_ANON_FLOOR}
        WHERE c.market = ${market} AND c.bucket_sec BETWEEN ${fromSec} AND ${toSec} ORDER BY c.bucket_sec`;
    },

    /** Counts and freshness for `/health`, `/status` and `verify-projection`. */
    async status(stream: string): Promise<IdxRow> {
      const [row] = await sql`
        SELECT (SELECT count(*) FROM idx_updates)::int AS updates, (SELECT count(*) FROM idx_updates)::int AS txs, 0 AS failed_txs, 0 AS confirmed_txs,
          (SELECT count(*) FROM idx_events)::int AS events, (SELECT count(*) FROM idx_fills)::int AS fills,
          (SELECT count(*) FROM idx_markets)::int AS windows_opened, (SELECT count(*) FROM idx_markets WHERE state <> 'open')::int AS windows_resolved,
          (SELECT count(*) FROM idx_legs WHERE status = 'open')::int AS open_legs,
          (SELECT count(*) FROM idx_markets WHERE state <> 'open' AND legs_open > 0)::int AS resolved_with_open_legs,
          (SELECT count(*) FROM idx_markets WHERE state = 'resolved' AND legs_refunded_stale > 0)::int AS resolved_with_stale_refunds,
          (SELECT max(effective_at_ms) / 1000 FROM idx_updates)::text AS last_block_time_sec, (SELECT max(ledger_offset) FROM idx_updates)::text AS last_slot,
          (SELECT json_object_agg(template, n) FROM (SELECT template || CASE WHEN choice IS NULL THEN '' ELSE '.' || choice END AS template, count(*)::int AS n
             FROM idx_events GROUP BY 1) c) AS by_name,
          (SELECT row_to_json(c) FROM (SELECT ledger_offset::text AS offset, update_id, updated_at_ms::text, bootstrap, history_from_offset::text, party
             FROM idx_cursor WHERE stream = ${stream}) c) AS cursor`;
      return row!;
    },
  };
}

export type IndexReader = ReturnType<typeof indexReader>;
