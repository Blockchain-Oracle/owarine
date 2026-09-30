"use client";

import type { MarketId } from "@agari/core/types";
import { useLedgerViews, type LedgerViewAs } from "@agari/markets/react";
import { RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/chrome";
import { Button } from "@/components/ui/button";
import { PRIVACY } from "./copy";
import { viewOf } from "./party-views";
import { ViewSwitcher } from "./ViewSwitcher";
import "./privacy.css";

const S = PRIVACY.switcher;

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
