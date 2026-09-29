"use client";

import type { PrintWhich, ReplayState } from "@agari/markets";
import { ReverifyButton } from "@/features/proof/ReverifyButton";
import "@/features/proof/proof-page.css";
import { PROOF_CANTON } from "./copy";
import { ResolutionTimeline, type ResolutionEvidence } from "./ResolutionTimeline";
import "./proof-canton.css";

const R = PROOF_CANTON.reverify;

/** The timeline beside the reference `ReverifyButton` (unchanged: it posts the archived print again and reports why not). */
export function ProofEvidence({ evidence, marketId, which, replay }: { evidence: ResolutionEvidence; marketId: string; which: PrintWhich; replay: ReplayState | null }) {
  return (
    <div className="cx-proof-layout">
      <ResolutionTimeline evidence={evidence} />
      <aside className="cx-proof-aside" aria-label={R.title}>
        <span className="cx-panel-title">{R.title}</span>
        <p>{R.body}</p>
        <ReverifyButton marketId={marketId} which={which} state={replay} onStarted={() => undefined} />
      </aside>
    </div>
  );
}
