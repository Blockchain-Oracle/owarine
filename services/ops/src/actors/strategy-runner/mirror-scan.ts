import { isOk } from "@owarine/core/schemas";
import { decideMirror, type MirrorSpec } from "@owarine/core/strategies";
import type { Address } from "@owarine/core/types";
import { listPublishedFills, marketsProvider } from "@owarine/markets";
import type { Scan } from "./decide";
import { tradingWindows } from "./trading-windows";

/** A trader's published calls are read from the index, so the window of interest is also the only history this needs. */
const FILL_LIMIT = 50;

/**
 * One read of the venue for a copy-a-trader strategy (A-3b): every Trading Window that named seat has just taken a
 * side on, in a call it published. On Canton a seat's fills are private to its lease, so the runner reads the opt-in
 * publications (`published/<address>/fills`), never `wallet/*`, which answers 403 to anyone but the seat (C8d).
 *
 * Reads only — nothing here can send. The trader's own fills are the signal, so a Window they have not touched is
 * not a decision to sit out, it is simply not a candidate; the "why" says how many Windows they were quiet on so a
 * subscriber can tell a resting trader from a broken runner.
 */
export async function scanVenueMirror(venueId: Address, spec: MirrorSpec, nowMs: number): Promise<Scan> {
  const lanes = await marketsProvider.listLiveLanes(venueId);
  if (!isOk(lanes) || lanes.stale) return { candidates: [], scanned: 0, closestBps: null, why: `lanes unreadable: ${isOk(lanes) ? "stale state" : lanes.error.technical}` };
  const markets = tradingWindows(lanes.value, nowMs);
  const sinceSec = Math.floor(nowMs / 1_000) - spec.withinSec;
  const fills = await listPublishedFills(spec.trader, { sinceSec, limit: FILL_LIMIT });
  if (!isOk(fills) || fills.stale) {
    return { candidates: [], scanned: markets.length, closestBps: null, why: `this trader's published calls are unreadable: ${isOk(fills) ? "stale index" : fills.error.technical}` };
  }
  const candidates: Scan["candidates"] = [];
  let quiet = 0;
  for (const market of markets) {
    const own = fills.value.filter((fill) => fill.marketId === market.marketId);
    const decision = decideMirror({ fills: own, spec, nowMs });
    if (decision.side) candidates.push({ market, decision });
    else quiet += 1;
  }
  const why =
    candidates.length > 0
      ? `scanned ${markets.length} markets, this trader is net on ${candidates.length}`
      : `scanned ${markets.length} markets, this trader has published no side in the last ${spec.withinSec}s (${quiet} quiet)`;
  return { candidates, scanned: markets.length, closestBps: null, why };
}
