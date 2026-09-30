/** The strategy registry on Canton (C8f, abu-pm-agents): listings, the seat's consents and its journaled writes. */
import type { IntentJournal, PhaseListener, TxOutcome } from "@agari/core/ports";
import type { RegistryDeployment, StrategyIntent } from "@agari/core/strategies";
import type { Address } from "@agari/core/types";
import { CLUSTER_ID } from "@agari/core/constants";
import { seriesIdFromDaml } from "@agari/core/market";
import { nowMs } from "../provider/clock";
import { peekClient } from "../runtime/read-runtime";
import { allowAllStopGate } from "../submitter/stop-gate";
import type { VaultContracts } from "../vault/contracts";
import { submitStrategyLane } from "./writes";

export { downsample, readAgentContext } from "./agent-context";
export { openingOnFeedScale } from "./price-basis";
export { getCreatorPayouts, getStrategy, installStrategyReader, listLiveSubscribers, listStrategies, listStrategySubscribers, listSubscriptionsOf, STRATEGIES_NOT_LIVE, type CreatorPayouts, type StrategyReader } from "./reads";
export { planRevision, STRATEGY_METADATA_MAX_BYTES, submitStrategyLane } from "./writes";
export { claimCreatorPayoutsLane, setStrategyRunnerLane, SAME_CASH } from "../submitter/agents-lane";

export interface StrategyTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

/**
 * The registry on this network: abu-pm-agents' `StrategyListing`s, named by a derived address-shaped id (never a chain
 * account). Whether the package is really on the participant is each read's own answer.
 */
export function resolveRegistryDeployment(chainId?: number): RegistryDeployment | null {
  const cluster = peekClient()?.cluster;
  return { chainId: chainId ?? (cluster ? CLUSTER_ID[cluster] : CLUSTER_ID.devnet), strategyRegistry: seriesIdFromDaml("agari-strategy:registry"), fromBlock: 0n };
}

/** A registry write from a journal and a seat (no session object): the same journaled lane. */
export async function submitStrategyTx(ctx: StrategyTxContext, intent: StrategyIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  return submitStrategyLane({ wallet: ctx.wallet, journal: ctx.journal, stopGate: allowAllStopGate, nowMs }, intent, onPhase);
}
