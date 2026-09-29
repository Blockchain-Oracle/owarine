"use client";

import { etDateOf, formatCadence, formatEtClock } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { MarketId } from "@agari/core/types";
import { useMarket } from "@agari/markets/react";
import { AlertTriangleIcon } from "lucide-react";
import { SectionHeader } from "@/components/chrome";
import { PROOF_CANTON, ResolutionTimeline, TrustBoundary, type ResolutionEvidence } from "@/features/canton-ux/proof";
import type { CantonProofView } from "./canton-proof";
import { PROOF } from "./copy";
import { OraclePrintsTable } from "./OraclePrintsTable";
import { ResolutionReceipt } from "./ResolutionReceipt";
import { ReverifyButton, type ReverifyResult } from "./ReverifyButton";
import "./proof-page.css";

/**
 * `/proof/<market>` (proof-analytics.md §2.6, on Canton): Masayume's `/status` page frame (numbered header, holding
 * states, the pipeline table) over the Window's oracle prints, the resolution timeline, the cream resolution receipt, and
 * the re-verify anyone can run. `view` and `evidence` are read server-side from the projection; null when it is down.
 */
export function ProofScreen({
  marketId,
  view,
  evidence = null,
  reverifyPreview,
}: {
  marketId: MarketId;
  view: CantonProofView | null | "unreachable";
  evidence?: ResolutionEvidence | null;
  reverifyPreview?: ReverifyResult;
}) {
  const market = useMarket(marketId);
  const window = market && isOk(market) ? market.value : null;
  const desc = window ? PROOF.window(window.asset, formatCadence(window.intervalSec), `${formatEtClock(window.expirySec)} ET · ${etDateOf(window.expirySec)}`) : undefined;
  const printed = view && view !== "unreachable" && (view.open.prints.some((p) => p.priceE8 !== null) || view.result.kind !== "pending");

  return (
    <div className="container status-page proof-page">
      <SectionHeader index={PROOF.section.index} title={PROOF.section.title} desc={desc} />
      <p className="proof-intro type-body text-ink-secondary">{PROOF.intro}</p>

      {view === "unreachable" && (
        <div className="status-holding" role="alert">
          <AlertTriangleIcon className="status-holding-icon warn" aria-hidden />
          <p className="status-holding-text">{PROOF.unreachable}</p>
        </div>
      )}

      {(view === null || (view !== "unreachable" && !printed)) && (
        <div className="status-holding" role="status">
          <p className="status-holding-text">{PROOF.none}</p>
        </div>
      )}

      {view && view !== "unreachable" && printed && (
        <div className="status-report proof-cx-grid">
          <OraclePrintsTable view={view} />
          <ResolutionReceipt view={view} />
        </div>
      )}

      {/* C-ADD-09: how the Window was decided, step by step from the projected Resolution, each step's ledger update named. */}
      {evidence && (
        <section className="proof-print cx-proof-timeline" aria-label={PROOF_CANTON.timeline}>
          <SectionHeader index="01" title={PROOF_CANTON.timeline} />
          <ResolutionTimeline evidence={evidence} />
        </section>
      )}

      {view && view !== "unreachable" && view.result.kind !== "pending" && (
        <section className="proof-print cx-proof-timeline" aria-label={PROOF.reverifyTitle}>
          <SectionHeader index="02" title={PROOF.reverifyTitle} desc={PROOF.reverifyBody} />
          <ReverifyButton marketId={marketId} preview={reverifyPreview} />
        </section>
      )}

      {/* C-ADD-11: the demo's trust boundary, said on the page that asks to be trusted. */}
      <div className="cx-proof-trust">
        <TrustBoundary />
      </div>
    </div>
  );
}
