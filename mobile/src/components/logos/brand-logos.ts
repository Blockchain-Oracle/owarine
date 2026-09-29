import type { ImageSource } from "expo-image";

/**
 * Real brand marks, never a generic icon where a brand is named, from the 21st logo catalogue (svgl). Each brand has a
 * mark per theme where its ink flips. The reference's wallet and chain marks (Phantom, Solflare, Backpack, Solana) are
 * gone with the wallet island; Canton and the exchange marks arrive through `21st logo` (UX lane).
 */
export type BrandLogo = "x" | "pyth";

export const BRAND_LOGOS: Record<BrandLogo, { light: ImageSource; dark: ImageSource }> = {
  x: { light: require("../../../assets/logos/x.svg"), dark: require("../../../assets/logos/x_dark.svg") },
  // The reference's settlement-oracle mark (sponsor mark cleared for use 09-23), in onboarding.
  pyth: { light: require("../../../assets/logos/pyth-wordmark-ink.svg"), dark: require("../../../assets/logos/pyth-wordmark-light.svg") },
};
