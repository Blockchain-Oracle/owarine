import { DEFAULT_CLUSTER, PROOF_BASE_PATH, type Cluster } from "../constants/chain";
import type { Address, Signature } from "../types/primitives";

/** The network, as a query parameter, only off the default one, so a DevNet receipt link stays short. */
function networkQuery(cluster: Cluster, joiner: "?" | "&"): string {
  return cluster === DEFAULT_CLUSTER ? "" : `${joiner}network=${cluster}`;
}

/**
 * The proof page for a ledger update: the raw proof every receipt links to. Canton updates are private, so there is no
 * public explorer page to send anyone to; the product's own `/proof` page re-reads the update. `explorerBase` stays a
 * parameter so a deployment can point it at an absolute origin.
 */
export function txUrl(signature: Signature, cluster: Cluster = DEFAULT_CLUSTER, explorerBase: string = PROOF_BASE_PATH): string {
  return `${explorerBase}?update=${encodeURIComponent(signature)}${networkQuery(cluster, "&")}`;
}

/** A seat's public page (the base58 seat key is the product's `Address`). */
export function addressUrl(address: Address, cluster: Cluster = DEFAULT_CLUSTER, explorerBase = ""): string {
  return `${explorerBase}/u/${address}${networkQuery(cluster, "?")}`;
}
