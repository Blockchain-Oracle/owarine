/** The strategy registry on Canton (C8). Until it lands: no registry, refused writes; the pure helpers stay (D-015). */
import type { IntentJournal, PhaseListener, TxOutcome } from "@agari/core/ports";
import type { RegistryDeployment, StrategyIntent } from "@agari/core/strategies";
import type { Address } from "@agari/core/types";
import { refusedFor } from "../stub/product";
import type { VaultContracts } from "../vault/contracts";
import { STRATEGIES_NOT_LIVE } from "./reads";

export { downsample, readAgentContext } from "./agent-context";
export { openingOnFeedScale } from "./price-basis";
export { getStrategy, listLiveSubscribers, listStrategies, listStrategySubscribers, listSubscriptionsOf } from "./reads";
export { planRevision, STRATEGY_METADATA_MAX_BYTES, submitStrategyLane } from "./writes";

export interface StrategyTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

/** No strategy package on the participant yet. */
export function resolveRegistryDeployment(_chainId?: number): RegistryDeployment | null {
  return null;
}

/** The write without a session refuses rather than pretend. */
export async function submitStrategyTx(_ctx: StrategyTxContext, _intent: StrategyIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(STRATEGIES_NOT_LIVE);
}
