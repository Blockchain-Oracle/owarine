import { marketsEnvInputFrom, parseMarketsEnv, type MarketsEnv } from "@agari/markets";
import { readOpsEnv } from "./env";

/**
 * The markets runtime's config for an ops actor: the process environment, as the web reads it, with the actor's own
 * venue id on top when it has one.
 *
 * Every ported actor used to call `parseMarketsEnv({ venueId })` and nothing else, so the indexer URL, the price
 * feed and the program ids in the environment were never read. The strategy runner booted, found its key and its
 * live subscriber, and reported "no indexer configured" with the indexer configured. With nothing set this returns
 * exactly what that call returned, so an actor that worked keeps working.
 *
 * An actor is not a browser: `NEXT_PUBLIC_AGARI_INDEXER_URL` has to be absolute here (`http://host/api/index`). The
 * ledger itself is reached through `@agari/ledger` with this process's own credential, never through these fields.
 *
 * The price feed is this process's own `/prices/latest`. With no `NEXT_PUBLIC_PRICE_FEED_URL` on the ops container
 * every `getAssetPrice` answered null, so the strategy runner skipped every Window as "no fresh price" (S23).
 */
export function opsMarketsEnv(venueId?: string): MarketsEnv {
  const input = marketsEnvInputFrom(process.env);
  const ops = readOpsEnv();
  const ledgerApiPath = absoluteLedgerPath(input.ledgerApiPath as string | undefined, input.indexerUrl as string | undefined);
  return parseMarketsEnv({
    ...input,
    priceFeedUrl: input.priceFeedUrl ?? `http://127.0.0.1:${ops.httpPort}`,
    ...(ledgerApiPath ? { ledgerApiPath } : {}),
    ...(venueId ? { venueId } : {}),
  });
}

/**
 * The web's public routes (`/api/venue/facts`, which every Window description reads) for a process that is not a
 * browser. A relative `NEXT_PUBLIC_LEDGER_API_PATH` (or none, `/api/ledger`) would resolve against
 * `127.0.0.1:$PORT`, which in ops is not the web, so the room could not describe a dealt deck after the reveal
 * (C9c). With an absolute indexer URL the web's origin is known: the same origin serves both.
 */
export function absoluteLedgerPath(ledgerApiPath: string | undefined, indexerUrl: string | undefined): string | undefined {
  if (ledgerApiPath && !ledgerApiPath.startsWith("/")) return ledgerApiPath;
  if (!indexerUrl || !/^https?:\/\//.test(indexerUrl)) return ledgerApiPath;
  return `${new URL(indexerUrl).origin}${ledgerApiPath ?? "/api/ledger"}`;
}
