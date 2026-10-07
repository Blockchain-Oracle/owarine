import type { Metadata } from "next";
import { KitShowcase } from "./KitShowcase";

export const metadata: Metadata = { title: "Fixtures · Kit" };

/** Every kit component in one place, for design QA at 390 / 768 / 1440 in both themes. */
export default function KitPage() {
  return <KitShowcase />;
}
