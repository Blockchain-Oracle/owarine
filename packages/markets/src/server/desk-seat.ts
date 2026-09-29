/**
 * The owner's side of the live desk (C8f, `DeskMandate`): placeholder the desk lane replaces. The factory's config is
 * fixed here so `web/src/lib/ledger.server.ts` can build it once per process.
 */
import type { LedgerClient, Party } from "@agari/ledger";
import type { OpsClient } from "./ops-client";
import type { CommandJournal } from "./writes";

export interface DeskSeatConfig {
  client: LedgerClient;
  /** Read-only: markets, marks and the venue's offers. Nothing is ever submitted as the venue from here. */
  venueParty: Party;
  /** The desk's operator (the agent-runner party, K-087); null = no live desks on this deployment. */
  operator: Party | null;
  /** The oracle parties whose `DeskMark`s make a desk's reference (quorum 2 of 3). */
  attestors: readonly Party[];
  journal: CommandJournal;
  ops: OpsClient;
  now?: () => number;
}

export function createDeskSeat(cfg: DeskSeatConfig) {
  return { config: cfg };
}

export type DeskSeat = ReturnType<typeof createDeskSeat>;
