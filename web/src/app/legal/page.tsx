import type { Metadata } from "next";
import { LEGAL, LegalScreen } from "@/features/legal";

export const metadata: Metadata = { title: LEGAL.title };

export default function Page() {
  return <LegalScreen />;
}
