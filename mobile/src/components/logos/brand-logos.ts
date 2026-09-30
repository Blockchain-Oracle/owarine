import type { ImageSource } from "expo-image";

/**
 * Real brand marks, never a generic icon where a brand is named, from the 21st logo catalogue (svgl). Each brand has a
 * mark per theme where its ink flips. The reference's wallet and chain marks (Phantom, Solflare, Backpack, Solana) are
 * gone with the wallet island. The venue's price sources (Coinbase, Kraken, Bitstamp, RedStone, Alpaca, Jupiter Price v3,
 * PreStocks) go by their plain names on the phone: no written permission for their marks is recorded in docs/plan, so
 * none is drawn (the Coinbase entry below is not used by any screen).
 */
export type BrandLogo = "x" | "coinbase";

export const BRAND_LOGOS: Record<BrandLogo, { light: ImageSource; dark: ImageSource }> = {
  x: { light: require("../../../assets/logos/x.svg"), dark: require("../../../assets/logos/x_dark.svg") },
  // One of the three exchanges whose 1-minute candle closes settle crypto Windows (`ATTESTED_SOURCE_LABEL.exchanges`);
  // svgl's mark is the brand's own blue tile, the same in both themes.
  coinbase: { light: require("../../../assets/logos/coinbase.svg"), dark: require("../../../assets/logos/coinbase.svg") },
};
