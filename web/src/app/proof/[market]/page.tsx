import { isAddress, toMarketId } from "@agari/core/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PROOF, ProofScreen } from "@/features/proof";
import { readResolutionEvidence } from "@/features/proof/resolution-evidence.server";
import { MARKETS_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: PROOF.title };

/**
 * `/proof/<market>`: a malformed id goes back to the markets (routing law: nothing 404s). The resolution timeline is
 * read here, server-side, from the projection; the rest of the page reads on the client as before.
 */
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;
  if (!isAddress(market)) redirect(MARKETS_PATH);
  const marketId = toMarketId(market);
  return <ProofScreen marketId={marketId} evidence={await readResolutionEvidence(marketId)} />;
}
