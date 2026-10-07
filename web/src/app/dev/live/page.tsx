import type { Metadata } from "next";
import { LiveShowcase } from "./LiveShowcase";

export const metadata: Metadata = { title: "Fixtures · Live engine" };

/** Revamp step 2: Coinbase spot → canvas chart → live PnL on the venue's ladder → one-tap Close. */
export default function LivePage() {
  return <LiveShowcase />;
}
