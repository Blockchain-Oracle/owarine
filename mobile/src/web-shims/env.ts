import type { WebEnv } from "../../../web/src/lib/env";
import { marketsEnv, SITE_URL } from "~/lib/env";

/**
 * Stands in for web/src/lib/env.ts (Next's NEXT_PUBLIC_* inlining) wherever web code the app reuses reads `webEnv`:
 * the Canton markets config and the app origin. No Solana RPC or websocket URL: nothing the phone bundles reads them
 * (only web's own wallet provider did), so web's remaining Solana fields are left out rather than faked.
 */
export type MobileWebEnv = Pick<WebEnv, "markets" | "appOrigin">;

export const webEnv: MobileWebEnv = {
  markets: marketsEnv,
  appOrigin: SITE_URL,
};
export type { WebEnv };
