/**
 * What the projection says is live, per template, for `verify-projection`: an independent recount re-reads the venue's
 * ACS at the projection's cursor offset and diffs contract-id sets against these. Nothing here is derived from the
 * ACS read; each set comes from the rows the stream wrote.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

/** Templates the projector tracks the life of, by `Module:Entity`. */
export const VERIFIED_TEMPLATES = [
  "PM.Series:Series",
  "PM.Market:MarketTerms",
  "PM.Market:WindowState",
  "PM.Market:OpenPrint",
  "PM.Market:Resolution",
  "PM.Oracle:PriceQuote",
  "PM.Quote:Quote",
  "PM.Quote:BuyQuote",
  "PM.Leg:Leg",
  "PM.Publication:Publication",
  // 0.4.0 (C6d)
  "PM.Publication:SettlementReceipt",
  "PM.Event:EventTerms",
  "PM.Event:EventState",
  "PM.Event:EventAttestation",
  "PM.Event:EventVerdict",
] as const;

export type VerifiedTemplate = (typeof VERIFIED_TEMPLATES)[number];

export async function projectedLiveSets(sql: Sql): Promise<Record<VerifiedTemplate, Set<string>>> {
  const col = async (q: Promise<{ cid: string | null }[]>) => new Set((await q).flatMap((r) => (r.cid ? [r.cid] : [])));
  return {
    "PM.Series:Series": await col(sql`SELECT contract_id AS cid FROM idx_series`),
    "PM.Market:MarketTerms": await col(sql`SELECT terms_cid AS cid FROM idx_markets`),
    "PM.Market:WindowState": await col(sql`SELECT window_state_cid AS cid FROM idx_markets`),
    "PM.Market:OpenPrint": await col(sql`SELECT open_print_cid AS cid FROM idx_markets`),
    "PM.Market:Resolution": await col(sql`SELECT resolution_cid AS cid FROM idx_markets`),
    "PM.Oracle:PriceQuote": await col(sql`SELECT contract_id AS cid FROM idx_prints WHERE NOT retired`),
    "PM.Quote:Quote": await col(sql`SELECT quote_cid AS cid FROM idx_quotes WHERE kind = 'quote' AND status = 'issued'`),
    "PM.Quote:BuyQuote": await col(sql`SELECT quote_cid AS cid FROM idx_quotes WHERE kind = 'buy' AND status = 'issued'`),
    "PM.Leg:Leg": await col(sql`SELECT leg_cid AS cid FROM idx_legs WHERE status = 'open'`),
    "PM.Publication:Publication": await col(sql`SELECT publication_cid AS cid FROM idx_publications`),
    "PM.Publication:SettlementReceipt": await col(sql`SELECT receipt_cid AS cid FROM idx_receipts WHERE NOT dismissed`),
    "PM.Event:EventTerms": await col(sql`SELECT event_terms_cid AS cid FROM idx_markets`),
    "PM.Event:EventState": await col(sql`SELECT event_state_cid AS cid FROM idx_markets`),
    "PM.Event:EventAttestation": await col(sql`SELECT contract_id AS cid FROM idx_event_attestations WHERE NOT retired`),
    "PM.Event:EventVerdict": await col(sql`SELECT event_verdict_cid AS cid FROM idx_markets`),
  };
}

/** Internal consistency the ACS cannot show: counters that must agree with the rows they count. */
export async function projectionInvariants(sql: Sql): Promise<string[]> {
  const out: string[] = [];
  const rows = await sql<{ check: string; n: number }[]>`
    SELECT 'markets.legs_open differs from open user legs' AS check, count(*)::int AS n FROM idx_markets m
      WHERE m.legs_open <> (SELECT count(*) FROM idx_legs l WHERE l.market = m.market AND NOT l.is_venue AND l.status = 'open')
    UNION ALL SELECT 'positions.open_legs differs from open legs', count(*)::int FROM idx_positions p
      WHERE p.open_legs <> (SELECT count(*) FROM idx_legs l WHERE l.market = p.market AND l.owner_party = p.owner_party AND l.status = 'open')
    UNION ALL SELECT 'positions.fills differs from fill rows', count(*)::int FROM idx_positions p
      WHERE p.fills <> (SELECT count(*) FROM idx_fills f WHERE f.market = p.market AND f.owner_party = p.owner_party)
    UNION ALL SELECT 'markets.trade_count differs from fill rows', count(*)::int FROM idx_markets m
      WHERE m.trade_count <> (SELECT count(*) FROM idx_fills f WHERE f.market = m.market)
    UNION ALL SELECT 'candle trades differ from fill rows', count(*)::int FROM idx_markets m
      WHERE (SELECT COALESCE(sum(trades), 0) FROM idx_candles c WHERE c.market = m.market) <> (SELECT count(*) FROM idx_fills f WHERE f.market = m.market)
    UNION ALL SELECT 'duplicate event keys', count(*)::int FROM (SELECT update_id, node_id FROM idx_events GROUP BY 1, 2 HAVING count(*) > 1) d
    UNION ALL SELECT 'updates without a strictly increasing offset', count(*)::int FROM (SELECT ledger_offset FROM idx_updates GROUP BY 1 HAVING count(*) > 1) d`;
  for (const r of rows) if (r.n > 0) out.push(`${r.check}: ${r.n}`);
  return out;
}
