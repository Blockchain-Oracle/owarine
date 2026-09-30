import type { ImageSource } from "expo-image";

/**
 * Real brand marks, never a generic icon where a brand is named, from the 21st logo catalogue (svgl). Each brand has a
 * mark per theme where its ink flips. The reference's wallet and chain marks (Phantom, Solflare, Backpack, Solana) are
 * gone with the wallet island. Of the named price sources, the 21st catalogue (svgl, checked 30 Sep) carries only
 * Coinbase; Canton, Kraken, Bitstamp, RedStone, Switchboard and Jupiter are not in it, so they stay as their names.
 */
export type BrandLogo = "x" | "pyth" | "coinbase";

export const BRAND_LOGOS: Record<BrandLogo, { light: ImageSource; dark: ImageSource }> = {
  x: { light: require("../../../assets/logos/x.svg"), dark: require("../../../assets/logos/x_dark.svg") },
  // The reference's settlement-oracle mark (sponsor mark cleared for use 09-23), in onboarding.
  pyth: { light: require("../../../assets/logos/pyth-wordmark-ink.svg"), dark: require("../../../assets/logos/pyth-wordmark-light.svg") },
  // One of the three exchanges whose 1-minute candle closes settle crypto Windows (`ATTESTED_SOURCE_LABEL.exchanges`);
  // svgl's mark is the brand's own blue tile, the same in both themes.
  coinbase: { light: require("../../../assets/logos/coinbase.svg"), dark: require("../../../assets/logos/coinbase.svg") },
};
