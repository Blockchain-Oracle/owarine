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
 * An actor is not a browser: the indexer URL has to be absolute here (`http://host/api/index`). A relative or absent
 * `NEXT_PUBLIC_AGARI_INDEXER_URL` resolves against the web's origin (`opsIndexerUrl`), so the room can describe a dealt
 * deck after the reveal on a deploy that only set the web's own relative value (C9c, C9d, C10a). The ledger itself is
 * reached through `@agari/ledger` with this process's own credential, never through these fields.
 *
 * The price feed is this process's own `/prices/latest`. With no `NEXT_PUBLIC_PRICE_FEED_URL` on the ops container
 * every `getAssetPrice` answered null, so the strategy runner skipped every Window as "no fresh price" (S23).
 */
export function opsMarketsEnv(venueId?: string): MarketsEnv {
  const input = marketsEnvInputFrom(process.env);
  const ops = readOpsEnv();
  const indexerUrl = opsIndexerUrl(input.indexerUrl as string | undefined, process.env);
  const ledgerApiPath = absoluteLedgerPath(input.ledgerApiPath as string | undefined, indexerUrl);
  return parseMarketsEnv({
    ...input,
    indexerUrl,
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

/**
 * The projection API as ops reaches it: an absolute `NEXT_PUBLIC_AGARI_INDEXER_URL` as given; otherwise its path (or
 * `/api/index`) on the web's origin, taken from `AGARI_WEB_ORIGIN` (the web as ops can reach it, e.g. an internal
 * container URL), then the public `NEXT_PUBLIC_APP_ORIGIN` / `NEXT_PUBLIC_SITE_URL`, then the local web on :3000.
 */
export function opsIndexerUrl(configured: string | undefined, env: Record<string, string | undefined>): string {
  const value = configured?.trim();
  if (value && /^https?:\/\//.test(value)) return value;
  const path = value && value.startsWith("/") ? value : "/api/index";
  const origin = [env.AGARI_WEB_ORIGIN, env.NEXT_PUBLIC_APP_ORIGIN, env.NEXT_PUBLIC_SITE_URL]
    .map((candidate) => candidate?.trim())
    .find((candidate) => candidate && URL.canParse(candidate));
  return `${new URL(origin ?? "http://127.0.0.1:3000").origin}${path}`;
}
