/**
 * `/proof/<market>` reads (C5): one Window's terms and Resolution as the projection holds them, every oracle's posted
 * quote at its open and close boundaries (`idx_prints`, the chosen row per oracle, symbol and boundary), and the archived
 * exchange responses behind them (`print_archive`, source `attested`, feed `<exchange>:<symbol>`). Market-level facts
 * only: nothing here is a user's. Integers stay decimal strings.
 */
import type postgres from "postgres";
import type { IdxEvidence } from "./types";

type Sql = postgres.Sql;

export interface ProofWindowRow {
  market: string;
  symbol: string | null;
  state: "open" | "resolved" | "voided";
  /** 0 Up, 1 Down, 2 Void. */
  winner: number | null;
  void_detail: string | null;
  tie_up: boolean | null;
  quorum: number;
  oracles: unknown;
  max_deviation_bps: number;
  trading_start_sec: string;
  expiry_sec: string;
  open_deadline_sec: string;
  close_deadline_sec: string;
  opened_update_id: string;
  opened_ts_sec: string;
  open_price_e8: string | null;
  open_evidence: IdxEvidence[] | null;
  open_recorded_ts_sec: string | null;
  open_update_id: string | null;
  close_price_e8: string | null;
  close_evidence: IdxEvidence[] | null;
  resolver: string;
  resolution_cid: string | null;
  resolved_update_id: string | null;
  resolved_at_ms: string | null;
  resolved_ts_sec: string | null;
  /** The Resolution's two signatories as its create argument names them (resolver and venue); null before one exists. */
  resolution_venue: string | null;
  resolution_resolver: string | null;
  /** The Resolution's own evidence lists, raw as the ledger sent them (`fetchedAt` an ISO time); null before one exists. */
  resolution_open_evidence: unknown;
  resolution_close_evidence: unknown;
}

export interface ProofPrintRow {
  oracle: string;
  boundary_sec: string;
  price_e8: string;
  fetched_at_sec: string;
  payload_hash: string;
  recorded_ts_sec: string;
  update_id: string;
  contract_id: string;
  retired: boolean;
  duplicates: number;
}

export interface ProofArchiveRow {
  feed: string;
  boundary_sec: string;
  payload: string;
  fetched_at_ms: string;
}

export async function proofWindow(sql: Sql, market: string): Promise<ProofWindowRow | null> {
  const [row] = await sql<ProofWindowRow[]>`
    SELECT m.market, m.symbol, m.state, m.winner, m.void_detail, m.tie_up, m.quorum, m.oracles, m.max_deviation_bps,
      m.trading_start_sec::text, m.expiry_sec::text, m.open_deadline_sec::text, m.close_deadline_sec::text, m.opened_update_id, m.opened_ts_sec::text,
      m.open_price_e8::text, m.open_evidence, m.open_recorded_ts_sec::text, m.open_update_id, m.close_price_e8::text, m.close_evidence,
      m.resolver, m.resolution_cid, m.resolved_update_id, m.resolved_at_ms::text, m.resolved_ts_sec::text,
      e.data->>'venue' AS resolution_venue, e.data->>'resolver' AS resolution_resolver,
      e.data->'openEvidence' AS resolution_open_evidence, e.data->'closeEvidence' AS resolution_close_evidence
    FROM idx_markets m
      LEFT JOIN idx_events e ON e.contract_id = m.resolution_cid AND e.kind = 'created'
    WHERE m.market = ${market}`;
  return row ?? null;
}

/** Every oracle's quote for this symbol at these boundaries, retired ones included (a Resolution may have counted them). */
export async function proofPrints(sql: Sql, symbol: string, boundaries: readonly number[]): Promise<ProofPrintRow[]> {
  if (boundaries.length === 0) return [];
  return sql<ProofPrintRow[]>`
    SELECT oracle, boundary_sec::text, price_e8::text, fetched_at_sec::text, payload_hash, recorded_ts_sec::text, update_id, contract_id, retired, duplicates
    FROM idx_prints WHERE symbol = ${symbol} AND boundary_sec = ANY(${boundaries.map(String)}::bigint[]) AND chosen
    ORDER BY boundary_sec, oracle`;
}

/** The oracle feeders' archived exchange responses for this symbol at these boundaries. */
export async function proofArchives(sql: Sql, symbol: string, boundaries: readonly number[]): Promise<ProofArchiveRow[]> {
  if (boundaries.length === 0) return [];
  return sql<ProofArchiveRow[]>`
    SELECT feed, boundary_sec::text, payload, fetched_at_ms::text FROM print_archive
    WHERE source = 'attested' AND feed LIKE ${`%:${symbol}`} AND boundary_sec = ANY(${boundaries.map(String)}::bigint[])`;
}
