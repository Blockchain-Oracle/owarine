import type { Metadata } from "next";
import { PRIVACY } from "@/features/canton-ux/privacy";
import { PrivacyFixtures } from "./PrivacyFixtures";

export const metadata: Metadata = { title: `Fixtures · ${PRIVACY.devTitle}` };

export default function CantonPrivacyFixturesPage() {
  return <PrivacyFixtures />;
}
