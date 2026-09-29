import type { Metadata } from "next";
import { SectionHeader } from "@/components/chrome";
import { OraclePrintsTable, PROOF, ResolutionReceipt, ReverifyButton } from "@/features/proof";
import "@/features/proof/proof-page.css";
import { REPORT_GONE, REPORT_GREEN, REPORT_TAMPERED, RESOLVED_VIEW, VOIDED_VIEW } from "./fixtures";

export const metadata: Metadata = { title: `Fixtures · ${PROOF.title}` };

const DEV = {
  resolved: "Resolved: three quotes at each boundary, the medians, the receipt, and a green re-verify",
  voided: "Voided: the close quotes further apart than the limit; re-verify with an exchange that no longer serves the candle",
  tampered: "A tampered archive: the hash differs from the quote's payloadHash",
} as const;

/** `/dev/proof`: the proof page's parts over canned projection rows, no database or ledger (the live page is `/proof/<market>`). */
export default function DevProofPage() {
  return (
    <div className="container status-page proof-page">
      <SectionHeader index="00" title={`${PROOF.title} · fixtures`} desc={PROOF.intro} />
      <div className="status-report">
        <SectionHeader index="01" title={DEV.resolved} />
        <div className="proof-cx-grid">
          <OraclePrintsTable view={RESOLVED_VIEW} />
          <ResolutionReceipt view={RESOLVED_VIEW} />
        </div>
        <ReverifyButton marketId={RESOLVED_VIEW.market} preview={REPORT_GREEN} />
        <SectionHeader index="02" title={DEV.voided} />
        <div className="proof-cx-grid">
          <OraclePrintsTable view={VOIDED_VIEW} />
          <ResolutionReceipt view={VOIDED_VIEW} />
        </div>
        <ReverifyButton marketId={VOIDED_VIEW.market} preview={REPORT_GONE} />
        <SectionHeader index="03" title={DEV.tampered} />
        <ReverifyButton marketId={RESOLVED_VIEW.market} preview={REPORT_TAMPERED} />
      </div>
    </div>
  );
}
