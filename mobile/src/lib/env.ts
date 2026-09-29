import { marketsEnvInputFrom, parseMarketsEnv, type MarketsEnv } from "@agari/markets/env";

/**
 * The web deploy the app talks to; every API the app reads is a route on it. The Canton product's hosted domain is not
 * set here yet, so the default is web's own local default (`appOrigin`); a build points at the deploy with
 * EXPO_PUBLIC_SITE_URL (EAS profile env). Never the reference's Solana product.
 */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * The same Canton markets config web builds from NEXT_PUBLIC_* (`marketsEnvInputFrom`), fed from EXPO_PUBLIC_* names.
 * Each read is literal so Expo inlines it. A phone has no page origin, so the two same-origin paths are made absolute
 * against SITE_URL: the ledger routes (`/api/ledger`, the only way a client reaches the ledger) and the projection
 * (`/api/index`). No program ids, no Solana RPC, no addresses file: the participant, package and parties live on the
 * server.
 */
export const marketsEnv: MarketsEnv = parseMarketsEnv({
  ...marketsEnvInputFrom({
    NEXT_PUBLIC_CANTON_NETWORK: process.env.EXPO_PUBLIC_CANTON_NETWORK,
    NEXT_PUBLIC_AGARI_VENUE_ID: process.env.EXPO_PUBLIC_VENUE_ID,
    NEXT_PUBLIC_PRICE_FEED_URL: process.env.EXPO_PUBLIC_PRICE_FEED_URL,
    NEXT_PUBLIC_LADDER_URL: process.env.EXPO_PUBLIC_LADDER_URL,
    NEXT_PUBLIC_DAML_PACKAGE_NAME: process.env.EXPO_PUBLIC_DAML_PACKAGE_NAME,
  }),
  ledgerApiPath: process.env.EXPO_PUBLIC_LEDGER_API_URL || `${SITE_URL}/api/ledger`,
  indexerUrl: process.env.EXPO_PUBLIC_INDEXER_URL || `${SITE_URL}/api/index`,
});
