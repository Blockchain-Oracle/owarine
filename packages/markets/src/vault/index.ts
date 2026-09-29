/**
 * The trading balance on Canton is `VenueCash` with `AgentGrant`s (C7a). Until it is on the participant: no vault,
 * zeros, refused writes (D-015). Pure pieces stay live: the history projection, the grant cap pre-check, the refusal
 * wording and the journal summary.
 */
export { type Sent, type VaultContracts } from "./contracts";
export { listVaultTallies, tallyToLedger, vaultRound, VAULT_TX_SENTINEL, type VaultTallies, type VaultTally } from "./history";
export {
  getVaultGrant,
  getVaultHoldings,
  getVaultSnapshot,
  loadVaultDeployment,
  recoverVaultExecution,
  resolveVaultDeployment,
  type RecoveredVaultExecution,
  type VaultExecutionEvidence,
} from "./read";
export { localCosigner, type CosignResult, type SponsorCosigner } from "./cosign";
export { VAULT_ERROR_RANGE, vaultDiagnosis, vaultFailureDiagnosis, WINDOW_PREDATES_VAULT, type VaultFailure } from "./errors";
export { capRefusalText, grantBuyRefusal, type GrantBuyCheck } from "./refusal";
export { summarizeVault, submitVaultTx } from "./write";
export { submitVaultOrder } from "./order";
