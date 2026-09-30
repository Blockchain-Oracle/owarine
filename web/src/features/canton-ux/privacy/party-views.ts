import { marketIdFromDaml } from "@agari/core/market";
import type { MarketId, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import type { LedgerView, LedgerViewAs, LedgerViewResult } from "@agari/markets/react";

/**
 * The per-party view switcher's data (C-ADD-02), apart from any DOM so web's switcher and the phone's native one read
 * `/api/view` the same way: each party's `Leg` rows as positions, exactly what the participant returned.
 */

export interface PartyPosition {
  contractId: string;
  market: string;
  side: Side;
  stakeText: string;
  /** The price paid, when the row carries one. */
  priceCents: number | null;
  /** The row is on the Window the page is showing. */
  here?: boolean;
}

export interface PartyView {
  value: string;
  /** Tab label: "Alice", "Bob", "Outsider". */
  label: string;
  party: string;
  /** What the ledger returned for this party; an empty list is a real answer, not a missing one. */
  positions: readonly PartyPosition[];
  /** The request line shown in the Code Block's header. */
  request: string;
  /** The literal body sent, party id included. */
  query: string;
  /** Live reads only: still asking, or the ledger (or our route) refused; the panel says which, never an empty list. */
  status?: { kind: "loading" } | { kind: "error"; text: string };
  /** The route's own sentence about what the participant filtered (shown under the query). */
  note?: string;
}

const REQUEST = "POST /v2/state/active-contracts-page";
/** A leg pays 1000 × cashUnit base units per lot if it wins (`@agari/markets/server` contractsOf). */
const PAIR_TICKS = 1000n;
const CASH_DECIMALS = 6;
const LABELS: Record<LedgerViewAs, string> = { alice: "Alice", bob: "Bob", outsider: "Outsider", me: "You" };

interface LegPayload {
  marketId?: string;
  outcome?: string;
  lots?: string | number;
  cashUnit?: string | number;
  backingShare?: string | number;
  feePaid?: string | number;
}

const big = (v: string | number | undefined): bigint => {
  try {
    return BigInt(v ?? 0);
  } catch {
    return 0n;
  }
};

function hereOf(damlMarketId: string, marketId: MarketId | null): boolean {
  if (!marketId || damlMarketId.length === 0) return false;
  try {
    return marketIdFromDaml(damlMarketId) === marketId;
  } catch {
    return false;
  }
}

/** A `Leg` row as the participant returned it (Daml JSON: Ints as strings), shown as a position: side, cost, price. */
function positionOf(row: LedgerView["rows"][number], marketId: MarketId | null, symbol: string): PartyPosition | null {
  if (!row.template.endsWith(":Leg")) return null;
  const leg = (row.payload ?? {}) as LegPayload;
  const contracts = big(leg.lots) * PAIR_TICKS * big(leg.cashUnit);
  const backing = big(leg.backingShare);
  const cost = backing + big(leg.feePaid);
  return {
    contractId: row.contractId,
    market: leg.marketId ?? "",
    side: leg.outcome === "SideDown" ? "down" : "up",
    stakeText: `${formatBaseUnits(cost, CASH_DECIMALS)} ${symbol}`,
    priceCents: contracts > 0n ? Number((backing * 100n) / contracts) : null,
    here: hereOf(leg.marketId ?? "", marketId),
  };
}

export function viewOf(as: LedgerViewAs, result: LedgerViewResult | undefined, pending: boolean, marketId: MarketId | null, symbol: string): PartyView {
  const base = { value: as, label: LABELS[as], request: REQUEST };
  if (!result || pending) return { ...base, party: "", query: "", positions: [], status: { kind: "loading" } };
  if (!result.ok) return { ...base, party: "", query: "", positions: [], status: { kind: "error", text: result.technical } };
  const v = result.value;
  const positions = v.rows.map((r) => positionOf(r, marketId, symbol)).filter((p): p is PartyPosition => p !== null);
  // This Window's rows first; the rest of what the party holds follows, as the ledger returned it.
  positions.sort((a, b) => Number(b.here ?? false) - Number(a.here ?? false));
  return { ...base, party: v.party, query: JSON.stringify(v.request, null, 2), positions, note: v.note };
}
