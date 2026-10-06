/**
 * Product dependents in the projection (C8d, C-DAML-03): how many products still pin a Window's terms. The plan's rule
 * is that settlement checks this count here, never on the ledger, and that a Window's terms are never retired while it
 * is above zero. Ops reads it before it retires the price quotes a product's settlement or knock-out may still cite,
 * and the settler names it in its pass.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

/** Open dependents of one Window, by its terms contract. */
export async function openDependents(sql: Sql, termsCid: string): Promise<number> {
  const [row] = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM idx_dependents WHERE terms_cid = ${termsCid} AND closed_ts_sec IS NULL`;
  return Number(row?.n ?? 0);
}

export interface DependentSpan {
  termsCid: string;
  marketKey: string;
  symbol: string;
  tradingStartSec: number;
  expirySec: number;
  state: string;
  open: number;
  products: string[];
}

/** Every Window with an open dependent: its symbol and life, so a quote inside that life is kept. */
export async function openDependentSpans(sql: Sql): Promise<DependentSpan[]> {
  const rows = await sql<{ terms_cid: string; market_key: string; symbol: string; trading_start_sec: string; expiry_sec: string; state: string; open: string; products: string[] }[]>`
    SELECT d.terms_cid, d.market_key, m.symbol, m.trading_start_sec::text, m.expiry_sec::text, m.state, count(*)::text AS open, array_agg(DISTINCT d.product) AS products
    FROM idx_dependents d JOIN idx_markets m ON m.terms_cid = d.terms_cid
    WHERE d.closed_ts_sec IS NULL
    GROUP BY d.terms_cid, d.market_key, m.symbol, m.trading_start_sec, m.expiry_sec, m.state`;
  return rows.map((r) => ({
    termsCid: r.terms_cid, marketKey: r.market_key, symbol: r.symbol, tradingStartSec: Number(r.trading_start_sec), expirySec: Number(r.expiry_sec),
    state: r.state, open: Number(r.open), products: r.products,
  }));
}

/** Whether a quote for `symbol` at `boundarySec` falls inside a Window an open product still depends on. */
export const quoteIsCited = (spans: readonly DependentSpan[], symbol: string, boundarySec: number): boolean =>
  spans.some((s) => s.symbol === symbol && boundarySec >= s.tradingStartSec && boundarySec <= s.expirySec);
