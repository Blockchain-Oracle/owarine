import { isAddress, toMarketId } from "@agari/core/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PROOF, ProofScreen } from "@/features/proof";
import { readCantonProof } from "@/features/proof/canton-proof.server";
import { readResolutionEvidence } from "@/features/proof/resolution-evidence.server";
import { MARKETS_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: PROOF.title };

/**
 * `/proof/<market>`: a malformed id goes back to the markets (routing law: nothing 404s). The prints, the Resolution and
 * its timeline are read here, server-side, from the projection; the re-verify runs on demand from the page.
 */
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;
  if (!isAddress(market)) redirect(MARKETS_PATH);
  const marketId = toMarketId(market);
  const [view, evidence] = await Promise.all([readCantonProof(marketId), readResolutionEvidence(marketId)]);
  return <ProofScreen marketId={marketId} view={view} evidence={evidence} />;
}
