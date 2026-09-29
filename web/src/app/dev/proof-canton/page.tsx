import type { Metadata } from "next";
import { PROOF_CANTON } from "@/features/canton-ux/proof";
import { ProofCantonFixtures } from "./ProofCantonFixtures";

export const metadata: Metadata = { title: `Fixtures · ${PROOF_CANTON.devTitle}` };

export default function ProofCantonFixturesPage() {
  return <ProofCantonFixtures />;
}
