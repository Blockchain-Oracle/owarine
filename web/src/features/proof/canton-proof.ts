/**
 * `/proof/<market>` on Canton: the page's view of one Window, mapped from the projection's rows (`@owarine/db`
 * `proofWindow`, `proofPrints`) with core's integer rule. Pure and browser-safe, so the screen, the `/dev` fixture and
 * the tests share it; the reads live in `canton-proof.server.ts`.
 */
import { exchangeOfParty, lowerMedian, parseVoidDetail, spreadBps, disagrees, type EvidenceItem, type Exchange, type ProofResolution, type ProofSide, type ProofSlot, type ProofVoid } from "@owarine/core/proof";

/** The rows as `@owarine/db` answers them (structural: the page never imports the database package into the browser). */
export interface WindowRowWire {
  market: string;
  symbol: string | null;
  state: "open" | "resolved" | "voided";
  winner: number | null;
  void_detail: string | null;
  tie_up: boolean | null;
  quorum: number;
  oracles: unknown;
  max_deviation_bps: number;
  trading_start_sec: string;
  expiry_sec: string;
  open_price_e8: string | null;
  open_evidence: EvidenceWire[] | null;
  close_price_e8: string | null;
  close_evidence: EvidenceWire[] | null;
  resolver: string;
  resolution_cid: string | null;
  resolved_update_id: string | null;
  resolved_at_ms: string | null;
  resolved_ts_sec: string | null;
  resolution_venue: string | null;
  resolution_resolver: string | null;
  resolution_open_evidence: unknown;
  resolution_close_evidence: unknown;
}

export interface EvidenceWire {
  oracle: string;
  priceE8: string;
  fetchedAtSec: number;
  payloadHash: string;
  quoteCid: string;
}

export interface PrintRowWire {
  oracle: string;
  boundary_sec: string;
  price_e8: string;
  fetched_at_sec: string;
  payload_hash: string;
  update_id: string;
}

export interface OraclePrintView {
  oracle: string;
  exchange: Exchange | null;
  /** null: the oracle posted nothing for this boundary that the projection holds. */
  priceE8: string | null;
  fetchedAtSec: number | null;
  payloadHash: string | null;
  updateId: string | null;
  /** In the Resolution's (or open print's) evidence for this slot. */
  counted: boolean;
}

export interface SlotView {
  slot: ProofSlot;
  boundarySec: number;
  prints: OraclePrintView[];
  /** Over the counted quotes, with the ledger's rule; null with none counted. */
  medianE8: string | null;
  spreadBps: string | null;
  overLimit: boolean;
  counted: number;
  /** What the ledger recorded for this slot's price (open print or close median); null when it recorded none. */
  ledgerE8: string | null;
}

export type ProofResult =
  | { kind: "resolved"; side: ProofSide; atMs: number; updateId: string | null }
  | { kind: "voided"; reason: ProofVoid | null; atMs: number; updateId: string | null }
  | { kind: "pending" };

export interface CantonProofView {
  market: string;
  symbol: string | null;
  quorum: number;
  maxDeviationBps: number;
  open: SlotView;
  close: SlotView;
  result: ProofResult;
  /** The Resolution's signatories (resolver and venue, both required by the template); null before it exists. */
  signatories: { resolver: string; venue: string | null } | null;
}

/** The Resolution's embedded evidence, raw from its create argument: `{ oracle, priceE8, fetchedAt (ISO), payloadHash, quoteCid }`. */
export function rawEvidence(value: unknown): EvidenceWire[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((e: Record<string, unknown>) => {
    const fetchedAtMs = typeof e.fetchedAt === "string" ? Date.parse(e.fetchedAt) : Number.NaN;
    if (typeof e.oracle !== "string" || typeof e.priceE8 !== "string" || typeof e.payloadHash !== "string" || !Number.isFinite(fetchedAtMs)) return [];
    return [{ oracle: e.oracle, priceE8: e.priceE8, fetchedAtSec: Math.floor(fetchedAtMs / 1000), payloadHash: e.payloadHash, quoteCid: typeof e.quoteCid === "string" ? e.quoteCid : "" }];
  });
}

/** What the ledger counted per slot: the Resolution's own evidence once it exists, else the projected open print's. */
function countedEvidence(row: WindowRowWire): { open: EvidenceWire[]; close: EvidenceWire[] } {
  const open = rawEvidence(row.resolution_open_evidence);
  const close = rawEvidence(row.resolution_close_evidence);
  return { open: open ?? row.open_evidence ?? [], close: close ?? row.close_evidence ?? [] };
}

const partiesOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((o): o is string => typeof o === "string") : []);

function slotView(slot: ProofSlot, boundarySec: number, oracles: readonly string[], prints: readonly PrintRowWire[], evidence: readonly EvidenceWire[], ledgerE8: string | null, maxBps: number): SlotView {
  const counted = new Map(evidence.map((e) => [e.oracle, e]));
  const posted = new Map(prints.filter((p) => Number(p.boundary_sec) === boundarySec).map((p) => [p.oracle, p]));
  // The terms' oracles first, in their order; then any counted oracle the terms row did not list (never expected).
  const names = [...oracles, ...evidence.map((e) => e.oracle).filter((o) => !oracles.includes(o))];
  const rows: OraclePrintView[] = names.map((oracle) => {
    const e = counted.get(oracle);
    const p = posted.get(oracle);
    return {
      oracle,
      exchange: exchangeOfParty(oracle),
      // The evidence is what the ledger counted; the projected print is what was posted (they match unless re-posted).
      priceE8: e?.priceE8 ?? p?.price_e8 ?? null,
      fetchedAtSec: e?.fetchedAtSec ?? (p ? Number(p.fetched_at_sec) : null),
      payloadHash: e?.payloadHash ?? p?.payload_hash ?? null,
      updateId: p?.update_id ?? null,
      counted: e !== undefined,
    };
  });
  const prices = evidence.map((e) => BigInt(e.priceE8));
  const median = lowerMedian(prices);
  const spread = spreadBps(prices);
  return { slot, boundarySec, prints: rows, medianE8: median?.toString() ?? null, spreadBps: spread?.toString() ?? null, overLimit: disagrees(maxBps, prices), counted: evidence.length, ledgerE8 };
}

function resultOf(row: WindowRowWire): ProofResult {
  if (!row.resolution_cid) return { kind: "pending" };
  const atMs = row.resolved_at_ms ? Number(row.resolved_at_ms) : Number(row.resolved_ts_sec ?? 0) * 1000;
  if (row.winner === 0 || row.winner === 1) return { kind: "resolved", side: row.winner === 0 ? "up" : "down", atMs, updateId: row.resolved_update_id };
  return { kind: "voided", reason: parseVoidDetail(row.void_detail), atMs, updateId: row.resolved_update_id };
}

export function buildProofView(row: WindowRowWire, prints: readonly PrintRowWire[]): CantonProofView {
  const oracles = partiesOf(row.oracles);
  const max = row.max_deviation_bps;
  const ev = countedEvidence(row);
  return {
    market: row.market,
    symbol: row.symbol,
    quorum: row.quorum,
    maxDeviationBps: max,
    open: slotView("open", Number(row.trading_start_sec), oracles, prints, ev.open, row.open_price_e8, max),
    close: slotView("close", Number(row.expiry_sec), oracles, prints, ev.close, row.close_price_e8, max),
    result: resultOf(row),
    signatories: row.resolution_cid ? { resolver: row.resolution_resolver ?? row.resolver, venue: row.resolution_venue } : null,
  };
}

const evidenceOf = (list: readonly EvidenceWire[] | null): EvidenceItem[] =>
  (list ?? []).map((e) => ({ oracle: e.oracle, priceE8: BigInt(e.priceE8), payloadHash: e.payloadHash, fetchedAtSec: e.fetchedAtSec }));

/** The Resolution as core's re-verify reads it; null before the Window has one (nothing to re-verify yet). */
export function toProofResolution(row: WindowRowWire): ProofResolution | null {
  if (!row.resolution_cid || !row.symbol) return null;
  const voided = row.winner !== 0 && row.winner !== 1;
  const ev = countedEvidence(row);
  return {
    symbol: row.symbol,
    openBoundarySec: Number(row.trading_start_sec),
    closeBoundarySec: Number(row.expiry_sec),
    quorum: row.quorum,
    maxDeviationBps: row.max_deviation_bps,
    tieUp: row.tie_up ?? false,
    openPriceE8: row.open_price_e8 === null ? null : BigInt(row.open_price_e8),
    closePriceE8: row.close_price_e8 === null ? null : BigInt(row.close_price_e8),
    openEvidence: evidenceOf(ev.open),
    closeEvidence: evidenceOf(ev.close),
    outcome: voided ? null : row.winner === 0 ? "up" : "down",
    voidReason: voided ? parseVoidDetail(row.void_detail) : null,
  };
}
