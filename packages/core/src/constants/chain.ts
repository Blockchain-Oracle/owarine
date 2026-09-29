/**
 * The Canton networks the product runs on. The name `Cluster` is kept so the call sites that bind a signed text or a
 * commitment to one network keep their shape; the values are Canton's. DevNet (the Noders participant) is the demo of
 * record; `localnet` is the local sandbox / LocalNet. MainNet and TestNet are listed because Canton has them, not
 * because a lane runs there yet.
 */
export type Cluster = "mainnet" | "testnet" | "devnet" | "localnet";

export const DEFAULT_CLUSTER: Cluster = "devnet";

/**
 * Numeric network ids, for the fields that bind a signature or commitment to one network (deck commitments, room tokens,
 * desk messages), so a signature for one network never verifies on another. Canton has no numeric chain id, so these are
 * this product's own, chosen in the 200s so they can never equal an id the reference signed on Solana (101, 103, 104).
 */
export const CLUSTER_ID: Readonly<Record<Cluster, number>> = { mainnet: 201, testnet: 202, devnet: 203, localnet: 204 };

export const CLUSTER_LABEL: Readonly<Record<Cluster, string>> = {
  mainnet: "Canton MainNet",
  testnet: "Canton TestNet",
  devnet: "Canton DevNet",
  localnet: "Canton LocalNet",
};

export function clusterOfId(id: number): Cluster | null {
  return (Object.keys(CLUSTER_ID) as Cluster[]).find((cluster) => CLUSTER_ID[cluster] === id) ?? null;
}

/** "Canton DevNet" for a known id; the bare number otherwise, so a signed text never names a network it isn't. */
export function clusterLabelOfId(id: number): string {
  const cluster = clusterOfId(id);
  return cluster ? CLUSTER_LABEL[cluster] : `network ${id}`;
}

/**
 * Where a receipt's raw proof lives. Canton has no public explorer that can show a private contract, so a receipt links
 * to the product's own proof page, which re-reads the update as the parties that can see it. A same-origin path.
 */
export const PROOF_BASE_PATH = "/proof";
