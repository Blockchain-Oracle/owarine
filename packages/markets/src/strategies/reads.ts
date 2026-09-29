/**
 * The strategy registry on Canton (C8f, abu-pm-agents): the public listings through our route
 * (`/api/ledger/agents/strategies`, read as the venue, read-only) and the seat's own consents
 * (`/api/ledger/agents/subscriptions`, read AS the leased party). A process with its own ledger access (the web's
 * server half, ops' runner) installs its reader instead (`installStrategyReader`). A creator never learns who
 * subscribes: outside the runner and the venue, a strategy's subscribers are a count.
 */
import { err, ok, type Reading } from "@agari/core/schemas";
import type { StrategyRecord, StrategySubscription } from "@agari/core/strategies";
import type { Address } from "@agari/core/types";
import { strategiesReplyWire, subscriptionsReplyWire } from "../provider/agents-wire";
import { nowMs } from "../provider/clock";
import { ledgerRequest } from "../provider/ledger-api";
import { cantonNotLive } from "../stub/not-deployed";

/** Why a registry write refuses outside a seat's lane. */
export const STRATEGIES_NOT_LIVE = cantonNotLive("strategies (no seat lane)");

export interface StrategyReader {
  listStrategies(): Promise<Reading<StrategyRecord[] | null>>;
  listSubscriptionsOf?(wallet: Address, strategyIds: readonly bigint[]): Promise<Reading<StrategySubscription[]>>;
  /** Consents on record with a live grant to the runner: only the runner or the venue can read these. */
  listLiveSubscribers?(strategyId: bigint): Promise<Reading<StrategySubscription[]>>;
  listStrategySubscribers?(strategyId: bigint): Promise<Address[]>;
}

let reader: StrategyReader | null = null;
/** Installs (or with null removes) the process's own registry reader. */
export function installStrategyReader(next: StrategyReader | null): void {
  reader = next;
}

/** Every listed strategy. `null` inside the reading where the registry is not on this participant. */
export async function listStrategies(): Promise<Reading<StrategyRecord[] | null>> {
  if (reader) return reader.listStrategies();
  const r = await ledgerRequest("/agents/strategies", { method: "GET", wire: strategiesReplyWire, seat: false });
  if (!r.ok) return r.diagnosis.kind === "not-deployed" ? ok(null, nowMs()) : err(r.diagnosis);
  return ok(r.value.strategies.map(({ textId: _t, ...s }) => s as StrategyRecord), nowMs());
}

export async function getStrategy(strategyId: bigint): Promise<Reading<StrategyRecord | null>> {
  const all = await listStrategies();
  if (!all.ok) return all;
  return ok(all.value?.find((s) => s.strategyId === strategyId) ?? null, all.asOfMs);
}

/** The seat's own consents (copy, mirror or fade) among `strategyIds` (all of them when empty). */
export async function listSubscriptionsOf(wallet: Address, strategyIds: readonly bigint[]): Promise<Reading<StrategySubscription[]>> {
  if (reader?.listSubscriptionsOf) return reader.listSubscriptionsOf(wallet, strategyIds);
  const r = await ledgerRequest("/agents/subscriptions", { method: "GET", wire: subscriptionsReplyWire, query: { ids: strategyIds.join(",") } });
  if (!r.ok) return r.diagnosis.kind === "signer-required" ? ok([], nowMs()) : err(r.diagnosis);
  return ok(r.value.subscriptions.map((s) => ({ ...s, subscriber: s.subscriber as Address })), nowMs());
}

/** Live consents to act on: the runner's (or the venue's) read. A seat's session cannot list other seats. */
export async function listLiveSubscribers(strategyId: bigint): Promise<Reading<StrategySubscription[]>> {
  if (reader?.listLiveSubscribers) return reader.listLiveSubscribers(strategyId);
  return ok([], nowMs());
}

/** Everyone with a consent on record for this strategy, as the runner or the venue reads them. */
export async function listStrategySubscribers(strategyId: bigint): Promise<Address[]> {
  if (reader?.listStrategySubscribers) return reader.listStrategySubscribers(strategyId);
  return [];
}
