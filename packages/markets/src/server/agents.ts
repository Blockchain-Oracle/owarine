/**
 * The seat's side of grants and the strategy registry (C8f): placeholder the agents lane replaces. The factory's
 * config is fixed here so `web/src/lib/ledger.server.ts` can build it once per process.
 */
import type { LedgerClient, Party } from "@agari/ledger";
import type { OpsClient } from "./ops-client";
import type { CommandJournal } from "./writes";

export interface AgentsSeatConfig {
  client: LedgerClient;
  /** Read-only: the venue's listings, offers and aggregate counts. Nothing is ever submitted as the venue from here. */
  venueParty: Party;
  /** The agent-runner party (house strategy runner, X executor, desk operator: K-087); null = none on this deployment. */
  agentRunner: Party | null;
  journal: CommandJournal;
  /** The venue's side: enrolling a seat's standing offers (`/internal/agents/enrol`). */
  ops: OpsClient;
  now?: () => number;
}

export function createAgentsSeat(cfg: AgentsSeatConfig) {
  return { config: cfg };
}

export type AgentsSeat = ReturnType<typeof createAgentsSeat>;
