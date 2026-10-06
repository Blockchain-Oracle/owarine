import { CLUSTER_LABEL, DEFAULT_CLUSTER, PROOF_BASE_PATH, type Cluster } from "@agari/core/constants";
import { DEVNET_DEFAULTS, parseMarketsEnv } from "./env";
import { peekClient } from "./runtime/read-runtime";

/** The Canton network the product targets. Receipt links carry it: build them with core `txUrl`/`addressUrl`. */
export const CLUSTER = DEFAULT_CLUSTER;
/** Our own ledger route handlers; the browser never holds a ledger endpoint or credential. */
export const LEDGER_API_PATH: string = DEVNET_DEFAULTS.ledgerApiPath;
/** Where a receipt's proof lives: the product's own `/proof` page (Canton updates are private; no public explorer shows them). */
export const EXPLORER_URL = PROOF_BASE_PATH;

/**
 * The network this app was configured for (C4f): the read runtime's (web's `NEXT_PUBLIC_CANTON_NETWORK`, the phone's
 * `EXPO_PUBLIC_CANTON_NETWORK`), else this build's `NEXT_PUBLIC_CANTON_NETWORK` (a server render before the runtime is
 * set), else DevNet, the default deploy. Every sentence that names the network reads it here, so a LocalNet build never
 * calls itself DevNet (C11b: The Call read "CANTON DEVNET" on localnet).
 */
export function configuredCluster(): Cluster {
  const configured = peekClient()?.cluster;
  if (configured) return configured;
  try {
    return parseMarketsEnv({ cluster: process.env.NEXT_PUBLIC_CANTON_NETWORK }).cluster;
  } catch {
    return DEFAULT_CLUSTER;
  }
}

/** "Canton LocalNet", "Canton DevNet", …: the configured network by name. */
export const networkLabel = (): string => CLUSTER_LABEL[configuredCluster()];
