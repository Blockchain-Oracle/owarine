"use client";

import { ReverifyButton, type ReverifyResult } from "@/features/proof/ReverifyButton";
import "@/features/proof/proof-page.css";
import { PROOF_CANTON } from "./copy";
import { ResolutionTimeline, type ResolutionEvidence } from "./ResolutionTimeline";
import "./proof-canton.css";

const R = PROOF_CANTON.reverify;

/** The timeline beside the reference `ReverifyButton` (re-pointed: it re-verifies the Window's evidence and lists every check). */
export function ProofEvidence({ evidence, marketId, preview }: { evidence: ResolutionEvidence; marketId: string; preview?: ReverifyResult }) {
  return (
    <div className="cx-proof-layout">
      <ResolutionTimeline evidence={evidence} />
      <aside className="cx-proof-aside" aria-label={R.title}>
        <span className="cx-panel-title">{R.title}</span>
        <p>{R.body}</p>
        <ReverifyButton marketId={marketId} preview={preview} />
      </aside>
    </div>
  );
}
