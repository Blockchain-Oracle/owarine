import { CLUSTER_ID, DEFAULT_CLUSTER, type Cluster } from "@agari/core/constants";
import { addressSchema } from "@agari/core/types";
import { z } from "zod";

/**
 * The defaults a deploy with no env boots against: Canton DevNet, the product's own ledger routes on the same origin,
 * and the main Daml package. No ledger credential ever appears here: the browser reaches the ledger only through our
 * route handlers (plan §1, §3), so every field is safe to inline into a client bundle.
 */
export const DEVNET_DEFAULTS = {
  cluster: DEFAULT_CLUSTER,
  ledgerApiPath: "/api/ledger",
  packageName: "abu-pm-main",
} as const;

/** An absolute URL, or a same-origin path such as `/api/index` (resolved against the page's origin in the browser). */
const urlOrPath = z
  .string()
  .refine((value) => value.startsWith("/") || URL.canParse(value), "an absolute URL or a same-origin path like /api/index");

export const marketsEnvSchema = z.object({
  /** The Canton network the participant is on (`Cluster` keeps its name; the values are Canton's). */
  cluster: z.enum(["mainnet", "testnet", "devnet", "localnet"]).default(DEVNET_DEFAULTS.cluster),
  /** Our own ledger route handlers (`/api/ledger/*`): the only way the browser reaches the ledger. */
  ledgerApiPath: urlOrPath.default(DEVNET_DEFAULTS.ledgerApiPath),
  /**
   * The projection API (`/api/index/*`): an absolute URL, or a same-origin path such as `/api/index` (the default in
   * web). A path resolves against the page's origin in the browser, and against this server over loopback on the
   * server (`indexer-base.ts`).
   */
  indexerUrl: urlOrPath.optional(),
  /** The venue's id as the app keys it (a base58 value derived from the venue party); absent until the venue boots (C2). */
  venueId: addressSchema.optional(),
  /** ops' spot SSE endpoint (`/prices/latest`, `/prices/stream`). */
  priceFeedUrl: z.url().optional(),
  /** ops' venue price-ladder SSE endpoint (the indicative ladder the ticket walks); absent until C4. */
  ladderUrl: z.url().optional(),
  /** The Daml package name the adapter queries (package names are participant-wide, plan "Daml model"). */
  packageName: z.string().min(1).default(DEVNET_DEFAULTS.packageName),
});

export type MarketsEnvParsed = z.infer<typeof marketsEnvSchema>;

/** The ledger-port config. `chainId` is the numeric network id product types still bind (D-012), derived, never configured. */
export type MarketsEnv = MarketsEnvParsed & { chainId: number };
export type MarketsEnvInput = z.input<typeof marketsEnvSchema>;

/** Parses the ledger-port config with DevNet defaults: every field is optional. */
export function parseMarketsEnv(raw: Partial<Record<keyof MarketsEnvInput, unknown>> = {}): MarketsEnv {
  const defined = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = marketsEnvSchema.parse(defined);
  return { ...parsed, chainId: CLUSTER_ID[parsed.cluster as Cluster] };
}

/**
 * The env-var names a web or ops process maps into `parseMarketsEnv`. Kept as literal property reads so Next.js
 * inlines the `NEXT_PUBLIC_*` values into client bundles. None of them is a secret.
 */
export function marketsEnvInputFrom(source: Record<string, string | undefined>): Partial<Record<keyof MarketsEnvInput, unknown>> {
  return {
    cluster: source.NEXT_PUBLIC_CANTON_NETWORK,
    ledgerApiPath: source.NEXT_PUBLIC_LEDGER_API_PATH,
    indexerUrl: source.NEXT_PUBLIC_AGARI_INDEXER_URL,
    venueId: source.NEXT_PUBLIC_AGARI_VENUE_ID,
    priceFeedUrl: source.NEXT_PUBLIC_PRICE_FEED_URL,
    ladderUrl: source.NEXT_PUBLIC_LADDER_URL,
    packageName: source.NEXT_PUBLIC_DAML_PACKAGE_NAME,
  };
}
