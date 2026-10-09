import type { Metadata } from "next";
import { PitchDeck } from "@/features/pitch/PitchDeck";

export const metadata: Metadata = {
  title: "Pitch",
  description: "Owarine's five-slide pitch: private predictions on Canton DevNet, who we are building for, and the road to TestNet and mobile.",
  alternates: { canonical: "/pitch" },
  openGraph: { title: "Owarine · Pitch", description: "The product today and the plan beyond HackCanton.", url: "/pitch", type: "website" },
  twitter: { card: "summary_large_image", title: "Owarine · Pitch", description: "The product today and the plan beyond HackCanton." },
};

export default function Page() {
  return <PitchDeck />;
}
