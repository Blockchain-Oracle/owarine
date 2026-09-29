"use client";

import { marketIdFromDaml } from "@agari/core/market";
import type { MarketId } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useLedgerViews, type LedgerView, type LedgerViewAs, type LedgerViewResult } from "@agari/markets/react";
import { RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/chrome";
import { Button } from "@/components/ui/button";
import { PRIVACY } from "./copy";
import { ViewSwitcher, type PartyPosition, type PartyView } from "./ViewSwitcher";
import "./privacy.css";

const S = PRIVACY.switcher;
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

function viewOf(as: LedgerViewAs, result: LedgerViewResult | undefined, pending: boolean, marketId: MarketId | null, symbol: string): PartyView {
  const base = { value: as, label: LABELS[as], request: REQUEST };
  if (!result || pending) return { ...base, party: "", query: "", positions: [], status: { kind: "loading" } };
  if (!result.ok) return { ...base, party: "", query: "", positions: [], status: { kind: "error", text: result.technical } };
  const v = result.value;
  const positions = v.rows.map((r) => positionOf(r, marketId, symbol)).filter((p): p is PartyPosition => p !== null);
  // This Window's rows first; the rest of what the party holds follows, as the ledger returned it.
  positions.sort((a, b) => Number(b.here ?? false) - Number(a.here ?? false));
  return { ...base, party: v.party, query: JSON.stringify(v.request, null, 2), positions, note: v.note };
}

/**
 * The per-party view switcher on `/markets/<id>` (C-ADD-02), fed live by `/api/view`: the same active-contracts query
 * sent as Alice, Bob and an outsider (and as your own seat, once it holds a party), each panel exactly what the
 * participant returned and the literal request body in the Code Block. Nothing here filters; an empty list is the
 * ledger's answer.
 */
export function LiveViewSwitcher({ index, marketId, symbol, withSeat }: { index: string; marketId: MarketId | null; symbol: string; withSeat: boolean }) {
  const parties: LedgerViewAs[] = withSeat ? ["alice", "bob", "outsider", "me"] : ["alice", "bob", "outsider"];
  const results = useLedgerViews(parties);
  const views = parties.map((as, i) => viewOf(as, results[i]?.data, results[i]?.isFetching ?? true, marketId, symbol));
  const refetch = () => results.forEach((r) => void r.refetch());
  const busy = results.some((r) => r.isFetching);
  return (
    <section className="markets-section flex flex-col gap-4" aria-label={S.title}>
      <SectionHeader
        index={index}
        title={S.title}
        eyebrow={S.live}
        aside={
          <Button type="button" variant="ghost" size="xs" onClick={refetch} disabled={busy} aria-busy={busy}>
            <RefreshCw aria-hidden className={busy ? "animate-spin" : undefined} /> {S.again}
          </Button>
        }
      />
      <ViewSwitcher views={views} />
    </section>
  );
}
