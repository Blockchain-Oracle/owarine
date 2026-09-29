import type { VaultDeployment } from "@agari/core/vault";
import type { MarketsEnv } from "../env";
import { cantonNotLive } from "../stub/not-deployed";

/** The reason every trading-balance read that needs `VenueCash`, and every vault write, states until C7a. */
export const VAULT_NOT_LIVE = cantonNotLive("vault");

/** No trading-balance package on the participant yet: null, the port's honest "no vault" (never a guess). */
export function resolveVaultDeployment(_env?: Partial<MarketsEnv>): VaultDeployment | null {
  return null;
}

/** The awaited form every surface that must know for sure uses; the same answer until C7a. */
export async function loadVaultDeployment(_env?: Partial<MarketsEnv>): Promise<VaultDeployment | null> {
  return null;
}
