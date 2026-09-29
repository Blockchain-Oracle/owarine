import { parseMarketsEnv, type MarketsEnv } from "@agari/markets/env";
import { z } from "zod";

const webOnlySchema = z.object({
  appOrigin: z.url().default("http://localhost:3000"),
});

export interface WebEnv extends z.infer<typeof webOnlySchema> {
  markets: MarketsEnv;
}

// Every NEXT_PUBLIC_* variable is referenced literally so Next can inline it into the client bundle (the names are
// `marketsEnvInputFrom`'s). Each one is optional: with no .env at all the app boots against Canton DevNet defaults, and
// the browser reaches the ledger only through our own `/api/ledger` routes, so no ledger credential is ever public.
export const webEnv: WebEnv = {
  markets: parseMarketsEnv({
    cluster: process.env.NEXT_PUBLIC_CANTON_NETWORK,
    ledgerApiPath: process.env.NEXT_PUBLIC_LEDGER_API_PATH,
    indexerUrl: process.env.NEXT_PUBLIC_AGARI_INDEXER_URL,
    venueId: process.env.NEXT_PUBLIC_AGARI_VENUE_ID,
    priceFeedUrl: process.env.NEXT_PUBLIC_PRICE_FEED_URL,
    ladderUrl: process.env.NEXT_PUBLIC_LADDER_URL,
    packageName: process.env.NEXT_PUBLIC_DAML_PACKAGE_NAME,
  }),
  ...webOnlySchema.parse({
    appOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN || undefined,
  }),
};
