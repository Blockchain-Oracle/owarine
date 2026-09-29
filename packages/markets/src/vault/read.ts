/**
 * The trading balance reads behind the port (C7a: `VenueCash` and `AgentGrant`). No deployment → the port's honest
 * null and zeros; a grant by id is a plain-promise read and rejects with the not-live reading (D-015).
 */
import type { Reading } from "@agari/core/schemas";
import type { Address, OnchainSnapshot } from "@agari/core/types";
import type { VaultGrant, VaultHoldings, VaultSnapshot } from "@agari/core/vault";
import { notDeployedError } from "../stub/not-deployed";
import { absent } from "../stub/product";
import { VAULT_NOT_LIVE } from "./deployment";

export { loadVaultDeployment, resolveVaultDeployment } from "./deployment";
export { recoverVaultExecution, type RecoveredVaultExecution, type VaultExecutionEvidence } from "./recovery";

/** A grant that is not one: slot 0 on every holding. */
const NO_GRANT = 0n;

/** The balance and the live grant per kind: null while there is no vault package on the participant. */
export const getVaultSnapshot = (_wallet: Address): Promise<Reading<VaultSnapshot | null>> => absent(null);

/** What the trading balance holds for the wallet on one Window: nothing, with no vault. */
export const getVaultHoldings = (_wallet: Address, onchain: OnchainSnapshot): Promise<Reading<VaultHoldings>> =>
  absent({ marketId: onchain.marketId, upRaw: 0n, downRaw: 0n, upGrantId: NO_GRANT, downGrantId: NO_GRANT });

/** One grant as the vault records it. Rejects until `AgentGrant` exists (C7a). */
export async function getVaultGrant(_grantId: bigint): Promise<VaultGrant> {
  throw notDeployedError(VAULT_NOT_LIVE);
}
