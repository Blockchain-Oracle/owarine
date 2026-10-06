/**
 * Contracts by id (C4g). A Window's `MarketTerms` is never archived, so paging the template returns every Window the venue
 * ever ran: on Noders DevNet 415 KB after 4 h, re-read in full by the resolver, the pricer and the lane feeders each time
 * a new Window appeared (every minute on the 1-minute lanes). Terms are immutable, so an actor learns each new one once,
 * by id (`/v2/events/events-by-contract-id`, about 2 KB), and keeps it.
 */
import { LedgerError, type ContractId } from "@agari/ledger";
import { TEMPLATE_IDS } from "@agari/daml";
import { activeOf, decodeTerms, type Active, type TermsC } from "./decode";
import type { RoleSession } from "./session";

interface EventsByContractId {
  created?: { createdEvent: Parameters<typeof activeOf>[0]; synchronizerId: string };
}

/** One contract of `templateId` by id, as the session's party sees it; null when it is unknown or not visible to it. */
export async function readById<T>(s: RoleSession, templateId: string, cid: ContractId, decode: (v: unknown) => T): Promise<Active<T> | null> {
  try {
    const r = await s.client.http.request<EventsByContractId>("POST", "/v2/events/events-by-contract-id", {
      json: { contractId: cid, eventFormat: { filtersByParty: { [s.party]: { cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob: false } } } }] } }, verbose: false } },
    });
    return r.created ? activeOf(r.created.createdEvent, decode) : null;
  } catch (error) {
    // CONTRACT_EVENTS_NOT_FOUND: not a contract of this template, not visible to the party, or pruned.
    if (error instanceof LedgerError && error.kind === "not-found") return null;
    throw error;
  }
}

/** Adds to `known` the terms of every id in `cids` it lacks, each read by id; returns how many it learned. */
export async function learnTerms(s: RoleSession, known: Map<ContractId, TermsC>, cids: Iterable<ContractId>): Promise<number> {
  const missing = [...new Set(cids)].filter((c) => !known.has(c));
  const got = await Promise.all(missing.map((c) => readById(s, TEMPLATE_IDS.MarketTerms, c, decodeTerms)));
  let learned = 0;
  for (const t of got) if (t) (known.set(t.cid, t.data), learned++);
  return learned;
}
