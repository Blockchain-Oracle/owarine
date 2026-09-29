import { CLUSTER_ID, type Cluster } from "@agari/core/constants";
import { seriesIdFromDaml } from "@agari/core/market";
import type { VaultDeployment } from "@agari/core/vault";
import type { MarketsEnv } from "../env";
import { peekClient } from "../runtime/read-runtime";

/**
 * The trading balance on Canton (C8f): the seat's own `VenueCash` is the balance, and its `AgentGrant`s (opened and
 * topped up through the venue's `GrantDesk`, abu-pm-agents) are the delegated powers. There is no vault account to
 * locate, so the deployment is a stable, derived description of that one fact: its ids are address-shaped names of
 * the grant desk, never a chain account, and `fromBlock` is the ledger's start. A read that needs the ledger answers
 * for itself whether the package is on the participant.
 */
export const VAULT_NOT_LIVE = "vault: the grant desk (abu-pm-agents) is not on this participant";

const named = (what: string) => seriesIdFromDaml(`agari-vault:${what}`);

export function cantonVaultDeployment(chainId: number): VaultDeployment {
  return { chainId, eventVault: named("grant-desk"), seat: named("seat-cash"), config: named("grant-caps"), collateral: named("venue-cash"), fromBlock: 0n };
}

const chainIdOf = (env?: Partial<MarketsEnv>): number => {
  if (env?.chainId) return env.chainId;
  const cluster = (env?.cluster ?? peekClient()?.cluster) as Cluster | undefined;
  return cluster ? CLUSTER_ID[cluster] : CLUSTER_ID.devnet;
};

/** The grant desk's description on this network. */
export function resolveVaultDeployment(env?: Partial<MarketsEnv>): VaultDeployment | null {
  return cantonVaultDeployment(chainIdOf(env));
}

/** The awaited form; the same answer (whether the package is really there is each read's own answer). */
export async function loadVaultDeployment(env?: Partial<MarketsEnv>): Promise<VaultDeployment | null> {
  return resolveVaultDeployment(env);
}
