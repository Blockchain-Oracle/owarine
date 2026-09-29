"use client";

import { SectionHeader } from "@/components/chrome";
import { PROOF_CANTON, ProofEvidence, TrustBoundary } from "@/features/canton-ux/proof";
import { FIXTURE_MARKET, RESOLVED, VOIDED } from "./fixtures";

/** `/dev/proof-canton`: resolution evidence resolved and voided, beside Re-verify, and the trust-boundary note. */
export function ProofCantonFixtures() {
  return (
    <div className="container flex flex-col gap-8 py-8">
      <SectionHeader index="00" eyebrow="Fixtures" title={PROOF_CANTON.devTitle} />
      <p className="type-caption text-ink-muted">Canned evidence only; the Re-verify button talks to this deployment&apos;s proof route.</p>
      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title="Resolved" eyebrow="three quotes · median · result" />
        <ProofEvidence evidence={RESOLVED} marketId={FIXTURE_MARKET} />
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title="Voided" eyebrow="no quorum, named" />
        <ProofEvidence evidence={VOIDED} marketId={FIXTURE_MARKET} />
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeader index="03" title="Trust boundary" eyebrow="desk panel grammar" />
        <TrustBoundary />
      </section>
    </div>
  );
}
