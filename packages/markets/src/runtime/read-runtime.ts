/**
 * The shared read runtime (one per browser tab or server process).
 *
 * It holds the configured Canton network and the product's own endpoints, and has no signer and no ledger
 * credential. Every signer lives in its own `SubmitterSession` (../sessions), so a read-endpoint change can never move
 * a write's authority. It is a descriptor, not a connection.
 */
import { CLUSTER_ID } from "@owarine/core/constants";
import { cantonVaultDeployment } from "../vault/deployment";
import type { Cluster } from "@owarine/core/constants";
import type { ArenaDeployment } from "@owarine/core/games";
import type { LeverageDeployment } from "@owarine/core/leverage";
import type { MakerDeployment } from "@owarine/core/maker";
import type { ParlayDeployment } from "@owarine/core/parlay";
import type { PrivateDeployment } from "@owarine/core/private";
import type { RangeDeployment } from "@owarine/core/range";
import type { Address } from "@owarine/core/types";
import type { VaultDeployment } from "@owarine/core/vault";
import type { MarketsEnv } from "../env";
import { mark } from "../perf/milestones";

/** What the runtime is pointed at. */
export interface ReadClient {
  cluster: Cluster;
  /** Our own ledger route handlers (`/api/ledger`); the browser never talks to a participant directly. */
  ledgerApiPath: string;
  /** The configured venue id (`NEXT_PUBLIC_OWARINE_VENUE_ID`); null until the venue boots. */
  venueId: Address | null;
  /** `/api/index` base; null = no projection, lists read `indexer-down`. */
  indexerUrl: string | null;
  /** The ops HTTP base serving `/prices/latest` and `/prices/stream`; null = no spot. */
  priceFeedUrl: string | null;
  /** ops' venue price-ladder stream; null until C4. */
  ladderUrl: string | null;
  /** The Daml package name the adapter queries. */
  packageName: string;
}

let client: ReadClient | null = null;
let version = 0;
const listeners = new Set<() => void>();
const teardowns = new Set<() => void>();

/** Builds the module-level runtime. Every consumer (web, ops, scripts) shares this one instance. */
export function configureMarkets(env: MarketsEnv): void {
  client = {
    cluster: env.cluster,
    ledgerApiPath: env.ledgerApiPath,
    venueId: env.venueId ?? null,
    indexerUrl: env.indexerUrl ?? null,
    priceFeedUrl: env.priceFeedUrl ?? null,
    ladderUrl: env.ladderUrl ?? null,
    packageName: env.packageName,
  };
  version += 1;
  mark("runtime.configured");
  for (const listener of listeners) listener();
}

/** Configures once per process; safe to call from every entry point. */
export function ensureMarkets(env: MarketsEnv): void {
  if (!client) configureMarkets(env);
}

export function getClient(): ReadClient {
  if (!client) throw new Error("markets port not configured — call configureMarkets(env) first");
  return client;
}

/** The configured runtime, or null before `configureMarkets` (a script or test reading with the DevNet defaults). */
export function peekClient(): ReadClient | null {
  return client;
}

/** Bumps whenever the runtime is rebuilt so React providers can re-key. */
export function exchangeVersion(): number {
  return version;
}

export function subscribeExchange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Registers work that must run before the runtime is closed (closing the ladder stream, from C4). */
export function onRuntimeClose(teardown: () => void): () => void {
  teardowns.add(teardown);
  return () => teardowns.delete(teardown);
}

export async function closeRuntime(): Promise<void> {
  client = null;
  for (const teardown of [...teardowns]) teardown();
}

/**
 * Product deployments on the configured network. Every product read branches on these, and each is null until its
 * Daml package is on the participant and its money gate has passed (C7a vault, C8 products, C9 arena).
 */
/** C8f: the grant desk (abu-pm-agents) with the seat's cash as the balance; see `vault/deployment.ts`. */
export const getVaultDeployment = (): VaultDeployment | null => (client ? cantonVaultDeployment(CLUSTER_ID[client.cluster]) : null);
export const getParlayDeployment = (): ParlayDeployment | null => null;
export const getRangeDeployment = (): RangeDeployment | null => null;
export const getMakerDeployment = (): MakerDeployment | null => null;
export const getLeverageDeployment = (): LeverageDeployment | null => null;
export const getPrivateDeployment = (): PrivateDeployment | null => null;
export const getArenaDeployment = (): ArenaDeployment | null => null;
