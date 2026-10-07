/**
 * Windows' Resolutions from the projection, for the seat routes (`@owarine/markets/server` MarketReader.resolutions()
 * scans the venue's ACS with a 3 s cache today). Rows are shaped like its `ResolutionView`, keyed by what it keys on:
 * `termsCid`. `disclosure` is what `Leg_Claim` needs to receive the Resolution as a disclosed contract; it is null only
 * for a Resolution projected without its blob. A Resolution is never archived by the model, so a projected one stays
 * valid; the projection trails the ledger by its lag (≈ 0.3 s on the sandbox).
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

export interface ProjectedResolution {
  cid: string;
  termsCid: string;
  damlMarketId: string;
  /** The app's MarketId (`marketIdFromDaml`). */
  marketId: string;
  /** null = void. */
  outcome: "up" | "down" | null;
  /** The Daml VoidReason constructor (`MissingPrint`, `QuorumNotMet`, `ResolverAbsent`, `SourceDisagreement`), null when resolved. */
  voidReason: string | null;
  createdAtMs: number;
  disclosure: { createdEventBlob: string; templateId: string; contractId: string; synchronizerId: string } | null;
}

type Row = {
  resolution_cid: string;
  terms_cid: string;
  market_key: string;
  market: string;
  winner: number;
  void_detail: string | null;
  resolved_at_ms: string | null;
  resolved_ts_sec: string;
  resolution_blob: string | null;
  resolution_template_id: string | null;
  synchronizer_id: string | null;
};

/**
 * Resolved or voided Windows by app MarketId (`markets`), by terms contract id (`termsCids`), or all of them (neither;
 * at most `limit`, newest first). Returns a Map keyed by terms contract id, like `MarketReader.resolutions()`.
 */
export async function resolutionsByMarket(
  sql: Sql,
  q: { markets?: readonly string[]; termsCids?: readonly string[]; limit?: number } = {},
): Promise<Map<string, ProjectedResolution>> {
  const limit = Math.max(1, Math.min(5_000, Math.floor(q.limit ?? 5_000)));
  const rows = await sql<Row[]>`
    SELECT resolution_cid, terms_cid, market_key, market, winner, void_detail, resolved_at_ms::text, resolved_ts_sec::text,
      resolution_blob, resolution_template_id, synchronizer_id
    FROM idx_markets
    WHERE resolution_cid IS NOT NULL
      ${q.markets ? sql`AND market = ANY(${q.markets as string[]}::text[])` : sql``}
      ${q.termsCids ? sql`AND terms_cid = ANY(${q.termsCids as string[]}::text[])` : sql``}
    ORDER BY resolved_ts_sec DESC LIMIT ${limit}`;
  const out = new Map<string, ProjectedResolution>();
  for (const r of rows) {
    out.set(r.terms_cid, {
      cid: r.resolution_cid,
      termsCid: r.terms_cid,
      damlMarketId: r.market_key,
      marketId: r.market,
      outcome: r.winner === 0 ? "up" : r.winner === 1 ? "down" : null,
      voidReason: r.void_detail ? r.void_detail.split(":")[0]! : null,
      createdAtMs: r.resolved_at_ms ? Number(r.resolved_at_ms) : Number(r.resolved_ts_sec) * 1000,
      disclosure:
        r.resolution_blob && r.resolution_template_id && r.synchronizer_id
          ? { createdEventBlob: r.resolution_blob, templateId: r.resolution_template_id, contractId: r.resolution_cid, synchronizerId: r.synchronizer_id }
          : null,
    });
  }
  return out;
}
