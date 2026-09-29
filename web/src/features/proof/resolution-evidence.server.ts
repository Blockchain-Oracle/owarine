import "server-only";
import { getDb, resolutionsByMarket } from "@agari/db";
import type { MarketId } from "@agari/core/types";
import { PROOF_CANTON } from "@/features/canton-ux/proof/copy";
import type { OracleQuote, ResolutionEvidence } from "@/features/canton-ux/proof/ResolutionTimeline";

/**
 * A Window's resolution evidence for `/proof/<market>` (C-ADD-09), read server-side from the projection: the Resolution
 * itself through `resolutionsByMarket` (outcome, void reason, when), and around it the projected open print, each
 * listed oracle's quote at the close boundary (`idx_prints`, one row per oracle, symbol and boundary) and the median the
 * resolver took. Null when the database is not configured, the Window is unknown, or it has no Resolution yet: the page
 * then shows no timeline rather than a half-decided one.
 */

type MarketRow = {
  symbol: string | null;
  oracles: unknown;
  max_deviation_bps: number;
  open_price_e8: string | null;
  open_recorded_ts_sec: string | null;
  open_update_id: string | null;
  opened_ts_sec: string;
  opened_update_id: string;
  expiry_sec: string;
  close_deadline_sec: string;
  close_price_e8: string | null;
  resolved_update_id: string | null;
};

type PrintRow = { oracle: string; price_e8: string; recorded_ts_sec: string; update_id: string };

const E8 = 100_000_000n;

/** A price in 1e-8 units as the page writes prices: two decimals, grouped. */
function priceText(e8: bigint): string {
  const cents = (e8 * 100n + E8 / 2n) / E8;
  const whole = cents / 100n;
  const frac = (cents % 100n).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

/** The Daml VoidReason constructors the resolver names, as the timeline's reasons. */
const VOID_REASON = {
  QuorumNotMet: "quorum",
  MissingPrint: "missingPrint",
  ResolverAbsent: "resolverAbsent",
  SourceDisagreement: "sourceDisagreement",
} as const satisfies Record<string, keyof typeof PROOF_CANTON.voidReason>;

export async function readResolutionEvidence(marketId: MarketId): Promise<ResolutionEvidence | null> {
  const sql = getDb();
  if (!sql) return null;
  try {
    const resolution = [...(await resolutionsByMarket(sql, { markets: [marketId], limit: 1 })).values()][0];
    if (!resolution) return null;
    const [m] = await sql<MarketRow[]>`
      SELECT symbol, oracles, max_deviation_bps, open_price_e8::text, open_recorded_ts_sec::text, open_update_id, opened_ts_sec::text,
        opened_update_id, expiry_sec::text, close_deadline_sec::text, close_price_e8::text, resolved_update_id
      FROM idx_markets WHERE market = ${marketId}`;
    if (!m || m.open_price_e8 === null) return null;
    const oracles = Array.isArray(m.oracles) ? m.oracles.filter((o): o is string => typeof o === "string") : [];
    const prints = m.symbol
      ? await sql<PrintRow[]>`
          SELECT oracle, price_e8::text, recorded_ts_sec::text, update_id FROM idx_prints
          WHERE symbol = ${m.symbol} AND boundary_sec = ${m.expiry_sec} AND oracle = ANY(${oracles}::text[]) AND NOT retired`
      : [];
    const byOracle = new Map(prints.map((p) => [p.oracle, p]));
    const quotes: OracleQuote[] = oracles.map((party) => {
      const p = byOracle.get(party);
      return p ? { party, priceText: priceText(BigInt(p.price_e8)), atMs: Number(p.recorded_ts_sec) * 1000, updateId: p.update_id } : { party, priceText: null, atMs: null, updateId: null };
    });

    const reported = prints.map((p) => BigInt(p.price_e8));
    const close = m.close_price_e8 === null ? null : BigInt(m.close_price_e8);
    const median =
      close !== null && close > 0n && reported.length > 0
        ? {
            priceText: priceText(close),
            spreadText: pct(Number(((reported.reduce((a, b) => (a > b ? a : b)) - reported.reduce((a, b) => (a < b ? a : b))) * 10_000n) / close)),
            limitText: pct(m.max_deviation_bps),
          }
        : null;

    const openPrint = BigInt(m.open_price_e8);
    const updateId = m.resolved_update_id ?? resolution.cid;
    const outcome: ResolutionEvidence["outcome"] =
      resolution.outcome === null
        ? { kind: "voided", reason: VOID_REASON[resolution.voidReason as keyof typeof VOID_REASON] ?? "missingPrint", atMs: resolution.createdAtMs, updateId }
        : {
            kind: "resolved",
            side: resolution.outcome === "up" ? "UP" : "DOWN",
            word: resolution.outcome === "up" ? "above" : "under",
            closeText: close !== null ? priceText(close) : "—",
            atMs: resolution.createdAtMs,
            updateId,
          };

    return {
      open: {
        priceText: priceText(openPrint),
        atMs: Number(m.open_recorded_ts_sec ?? m.opened_ts_sec) * 1000,
        updateId: m.open_update_id ?? m.opened_update_id,
      },
      quotes,
      deadlineMs: Number(m.close_deadline_sec) * 1000,
      median,
      outcome,
    };
  } catch {
    // The projection being down costs the timeline, never the page.
    return null;
  }
}

export interface LedgerUpdateFacts {
  updateId: string;
  offset: number;
  atMs: number;
  events: number;
  /** The Window the update touched, when the projection tied one of its events to one. */
  market: string | null;
}

/**
 * One ledger update as the venue's projection holds it, for `/proof?update=<id>` (the receipt's link): offset, time,
 * how many events, and the Window it touched. `missing` when the projection has not seen it (it trails by its lag) or
 * does not hold it; null when there is no projection to ask.
 */
export async function readLedgerUpdate(updateId: string): Promise<LedgerUpdateFacts | "missing" | null> {
  const sql = getDb();
  if (!sql || updateId.length === 0 || updateId.length > 200) return null;
  try {
    const [u] = await sql<{ update_id: string; ledger_offset: string; effective_at_ms: string; events: number; market: string | null }[]>`
      SELECT u.update_id, u.ledger_offset::text, u.effective_at_ms::text, u.events,
        (SELECT e.market FROM idx_events e WHERE e.update_id = u.update_id AND e.market IS NOT NULL LIMIT 1) AS market
      FROM idx_updates u WHERE u.update_id = ${updateId}`;
    if (!u) return "missing";
    return { updateId: u.update_id, offset: Number(u.ledger_offset), atMs: Number(u.effective_at_ms), events: u.events, market: u.market };
  } catch {
    return null;
  }
}
