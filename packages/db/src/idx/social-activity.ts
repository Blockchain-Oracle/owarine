/**
 * Read-only projection queries for S13's activity feeds (social-assistant.md §1.6): a wallet's inbox, the following feed
 * and a ticker hub. On Canton every row here comes from an opt-in `Publication` (privacy-thesis.md §5): a user who never
 * published has no public activity, and a retraction removes it from every later read. Integers leave Postgres as
 * decimal strings; the web maps these rows to `ActivityItem`s and derives each settlement's verdict with core's rule.
 *
 * Two row shapes:
 * - a fill row is one published leg with the trade that opened it (`idx_publications` ⋈ `idx_fills`);
 * - a settlement row is one published leg on a terminal Window (⋈ `idx_legs` for how it ended).
 *
 * `wallet` matches the seat address the web bound to the publisher, or else the publication's handle.
 */
import type postgres from "postgres";
import { K_ANON_FLOOR } from "../schema-index";

type Sql = postgres.Sql;

const LIMIT_MAX = 200;
const clamp = (limit: number | undefined, fallback = 50) => Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit ?? fallback)));

export interface SocialFillRow {
  signature: string;
  outer_ix: number;
  inner_ix: number;
  fill_ix: number;
  market: string;
  wallet: string;
  /** The wallet's own order kind: 0 BUY_YES, 1 SELL_YES, 2 BUY_NO, 3 SELL_NO. */
  kind: number;
  /** Which seat the wallet held in the fill: the taker crossed the book; the maker's order rested and was taken (D-088). */
  seat: "taker" | "maker";
  symbol: string;
  cadence_sec: number | null;
  lots: string;
  /**
   * The wallet's leg in collateral base units: what a buy cost, the fee paid with it included (Canton charges the fee at
   * the fill, `PM.Leg.feePaid`; C9e), or what a sell returned (a sale carries no fee); null while the Series row is missing.
   */
  amount_base: string | null;
  ts_sec: string;
}

export interface SocialSettlementRow {
  market: string;
  owner: string;
  symbol: string;
  cadence_sec: number | null;
  state: "resolved" | "voided";
  /** 0 Yes (Up), 1 No (Down), 2 Void. */
  winner: number | null;
  resolved_ts_sec: string | null;
  expiry_sec: string | null;
  /** Lots of each outcome the seat held when trading stopped (fills plus complete sets), before any redemption. */
  held_yes_lots: string;
  held_no_lots: string;
  lot_base: string | null;
  /** Collateral paid for fills and mints, and received from sells and merges, in base units. */
  cost_base: string | null;
  proceeds_base: string | null;
  redeemed: boolean;
  redeemed_by_crank: boolean;
  payout_base: string;
  /** After a redemption, the redeem transaction and its block time (it is the seat's last event). */
  last_signature: string | null;
  last_ts_sec: string | null;
}

export interface SocialActivityQuery {
  /** Only activity at or after this unix second. */
  sinceSec?: number;
  limit?: number;
}

export function socialActivityReader(sql: Sql) {
  const who = sql`COALESCE(p.owner_address, p.handle)`;
  const fillCols = sql`
    f.update_id AS signature, 0 AS outer_ix, f.node_id AS inner_ix, 0 AS fill_ix, p.market, ${who} AS wallet, f.kind, 'taker' AS seat,
    m.symbol, m.cadence_sec, p.lots::text AS lots, (f.side_ticks * f.lots * f.cash_unit + COALESCE(f.fee, 0))::text AS amount_base, f.ts_sec::text AS ts_sec`;
  const published = sql`
    idx_publications p JOIN idx_markets m ON m.market = p.market
      JOIN idx_fills f ON f.owner_party = p.owner_party AND f.pair_id = p.pair_id AND f.market = p.market AND f.kind IN (0, 2) AND p.product IS NULL`;

  const settlementCols = sql`
    p.market, ${who} AS owner, m.symbol, m.cadence_sec, m.state, m.winner, m.resolved_ts_sec::text, m.expiry_sec::text,
    (CASE WHEN p.outcome = 0 THEN p.lots ELSE 0 END)::text AS held_yes_lots, (CASE WHEN p.outcome = 1 THEN p.lots ELSE 0 END)::text AS held_no_lots,
    (m.cash_unit * 1000)::text AS lot_base, (p.backing_share + COALESCE(l.fee_paid, 0))::text AS cost_base, '0' AS proceeds_base,
    (l.status IS NOT NULL AND l.status <> 'open') AS redeemed, COALESCE(l.status = 'settled', false) AS redeemed_by_crank,
    COALESCE(l.payout_base, 0)::text AS payout_base, l.closed_update_id AS last_signature, l.closed_ts_sec::text AS last_ts_sec`;
  // A ticket's publication (0.4.0 `product`) has no leg or fill: the pair-leg feeds read pair legs only.
  const settled = sql`
    idx_publications p JOIN idx_markets m ON m.market = p.market AND p.product IS NULL
      LEFT JOIN idx_legs l ON l.owner_party = p.owner_party AND l.pair_id = p.pair_id AND l.market = p.market AND NOT l.is_venue`;

  const since = (column: postgres.PendingQuery<postgres.Row[]>, sinceSec: number | undefined) =>
    sinceSec === undefined ? sql`` : sql`AND ${column} >= ${sinceSec}`;

  return {
    /** Published trades of any of these wallets, newest first (`takerOnly` is kept for the signature: every row is the publisher's own call). */
    async walletFills(wallets: readonly string[], q: SocialActivityQuery & { takerOnly?: boolean } = {}): Promise<SocialFillRow[]> {
      if (wallets.length === 0) return [];
      return sql<SocialFillRow[]>`
        SELECT ${fillCols} FROM ${published}
        WHERE ${who} = ANY(${wallets as string[]}::text[]) AND m.symbol IS NOT NULL ${since(sql`f.ts_sec`, q.sinceSec)}
        ORDER BY f.ts_sec DESC, f.ledger_offset DESC LIMIT ${clamp(q.limit)}`;
    },

    /** Published legs of any of these wallets on terminal Windows, newest settlement first. */
    async walletSettlements(wallets: readonly string[], q: SocialActivityQuery = {}): Promise<SocialSettlementRow[]> {
      if (wallets.length === 0) return [];
      return sql<SocialSettlementRow[]>`
        SELECT ${settlementCols} FROM ${settled}
        WHERE ${who} = ANY(${wallets as string[]}::text[]) AND m.state <> 'open' AND m.symbol IS NOT NULL ${since(sql`m.resolved_ts_sec`, q.sinceSec)}
        ORDER BY m.resolved_ts_sec DESC NULLS LAST LIMIT ${clamp(q.limit)}`;
    },

    /** The published calls on one ticker's Windows. */
    async tickerFills(symbol: string, q: SocialActivityQuery = {}): Promise<SocialFillRow[]> {
      return sql<SocialFillRow[]>`
        SELECT ${fillCols} FROM ${published}
        WHERE m.symbol = ${symbol} ${since(sql`f.ts_sec`, q.sinceSec)}
        ORDER BY f.ts_sec DESC, f.ledger_offset DESC LIMIT ${clamp(q.limit)}`;
    },

    /** Verdicts on one ticker's Windows for the published legs there. */
    async tickerSettlements(symbol: string, q: SocialActivityQuery = {}): Promise<SocialSettlementRow[]> {
      return sql<SocialSettlementRow[]>`
        SELECT ${settlementCols} FROM ${settled}
        WHERE m.symbol = ${symbol} AND m.state <> 'open' ${since(sql`m.resolved_ts_sec`, q.sinceSec)}
        ORDER BY m.expiry_sec DESC LIMIT ${clamp(q.limit)}`;
    },
  };
}

export type SocialActivityReader = ReturnType<typeof socialActivityReader>;

/** The last `windowSec` of published flow for the sentiment marquee: lots per side and how many publications. */
export interface CrowdFlowRow {
  fills: number;
  up_lots: string;
  down_lots: string;
}

/**
 * Crowd flow from opt-in publications only (plan "Every remaining capability": `/api/sentiment` with the k = 5 floor):
 * null below `K_ANON_FLOOR` distinct publishers, so a reading never describes one or two people.
 */
export async function crowdFlow(sql: Sql, sinceSec: number): Promise<CrowdFlowRow | null> {
  const [row] = await sql<(CrowdFlowRow & { publishers: number })[]>`
    SELECT count(*)::int AS fills, count(DISTINCT owner_party)::int AS publishers,
      COALESCE(sum(lots) FILTER (WHERE outcome = 0), 0)::text AS up_lots, COALESCE(sum(lots) FILTER (WHERE outcome = 1), 0)::text AS down_lots
    FROM idx_publications WHERE created_ts_sec >= ${sinceSec}`;
  if (!row || row.publishers < K_ANON_FLOOR) return null;
  return { fills: row.fills, up_lots: row.up_lots, down_lots: row.down_lots };
}
