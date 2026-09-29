import type { Metadata } from "next";
import { PROOF_FEED, ProofFeedScreen } from "@/features/proof";
import { LedgerUpdatePlate } from "@/features/proof/LedgerUpdatePlate";
import { readLedgerUpdate } from "@/features/proof/resolution-evidence.server";

export const metadata: Metadata = { title: PROOF_FEED.title };

export const dynamic = "force-dynamic";

/**
 * `/proof` (S25): the settled Windows across every lane, each opening its `/proof/<market>` page. `?update=<id>` (a
 * receipt's ledger-update link) leads with that update as the venue's projection holds it.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ update?: string | string[] }> }) {
  const raw = (await searchParams).update;
  const update = typeof raw === "string" ? raw : null;
  const facts = update ? await readLedgerUpdate(update) : null;
  return <ProofFeedScreen lead={update && facts ? <LedgerUpdatePlate updateId={update} facts={facts} /> : undefined} />;
}
