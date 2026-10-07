/**
 * The agents' ledger reads (C8f), server-only: one snapshot per party of every abu-pm-agents template it sees plus its
 * `AgentGrant`s and cash, and the venue's registry (listings, the creator-signed strategies it observes, and how many
 * live consents each has). Shared by the web's seat routes and ops' actors, so both read the same contracts the same way.
 */
import { PRIVATE_BUCKET } from "@owarine/core/private";
import { AGENT_TEMPLATE_IDS, TEMPLATE_IDS } from "@owarine/daml";
import type { ActiveContract, DisclosedContract, LedgerClient, Party } from "@owarine/ledger";
import { activeOf, decodeVenueCash, templateSuffix, timeSec, type Active, type VenueCashC } from "../ops/canton/decode";
import {
  decodeAgentGrant, decodeCreatorLicense, decodeCreatorPayout, decodeDeskOffer, decodeGrantDesk, decodeStrategy, decodeStrategyListing, decodeSubscriberBook,
  decodeSubscriberInvite, decodeSubscription,
  type AgentGrantC, type CreatorLicenseC, type CreatorPayoutC, type DeskOfferC, type GrantDeskC, type StrategyC, type StrategyListingC, type SubscriberBookC,
  type SubscriberInviteC, type SubscriptionC,
} from "../ops/agents/decode";
import { strategyNumOf } from "../ops/agents/ids";
import { refuse } from "./rejection";

export const AGENT_SEAT_TEMPLATES = [
  TEMPLATE_IDS.AgentGrant, TEMPLATE_IDS.VenueCash,
  AGENT_TEMPLATE_IDS.GrantDesk, AGENT_TEMPLATE_IDS.SubscriberInvite, AGENT_TEMPLATE_IDS.SubscriberBook, AGENT_TEMPLATE_IDS.Subscription,
  AGENT_TEMPLATE_IDS.CreatorLicense, AGENT_TEMPLATE_IDS.Strategy, AGENT_TEMPLATE_IDS.StrategyListing, AGENT_TEMPLATE_IDS.CreatorPayout, AGENT_TEMPLATE_IDS.DeskOffer,
] as const;

/** A subscription with the time it was created (the consent's own `createdAt`). */
export type SubscriptionRow = Active<SubscriptionC> & { createdAtSec: number };

export interface AgentsSnapshot {
  party: Party;
  offset: number;
  grants: Active<AgentGrantC>[];
  cash: { cid: string; amount: bigint }[];
  grantDesks: Active<GrantDeskC>[];
  invites: Active<SubscriberInviteC>[];
  books: Active<SubscriberBookC>[];
  subscriptions: SubscriptionRow[];
  licenses: Active<CreatorLicenseC>[];
  strategies: Active<StrategyC>[];
  listings: Active<StrategyListingC>[];
  payouts: Active<CreatorPayoutC>[];
  deskOffers: Active<DeskOfferC>[];
}

function bucket<T>(contracts: readonly ActiveContract[], templateId: string, decode: (v: unknown) => T): Active<T>[] {
  const want = templateSuffix(templateId);
  const out: Active<T>[] = [];
  for (const c of contracts) {
    if (templateSuffix(c.createdEvent.templateId) !== want) continue;
    try {
      out.push(activeOf(c.createdEvent, decode));
    } catch {
      // a payload that does not decode is not ours to act on
    }
  }
  return out;
}

/**
 * The party's snapshot. With `fromOffset` (C8i, the lease's start) it is one lease's view: a grant it gave, a consent it
 * holds, a strategy it published and a fee payout made to it count only when created at or after that offset, so the
 * next visitor on a recycled seat never sees, claims or changes what an earlier visitor of the same party left. The
 * venue's standing offers (grant desk, invitation, book, licence, desk offer) and the seat's cash are the party's.
 */
export function toAgentsSnapshot(party: Party, all: readonly ActiveContract[], offset: number, fromOffset = 0): AgentsSnapshot {
  const scoped = new Set([TEMPLATE_IDS.AgentGrant, AGENT_TEMPLATE_IDS.Subscription, AGENT_TEMPLATE_IDS.Strategy, AGENT_TEMPLATE_IDS.CreatorPayout].map(templateSuffix));
  const contracts = fromOffset <= 0 ? all : all.filter((c) => !scoped.has(templateSuffix(c.createdEvent.templateId)) || Number(c.createdEvent.offset) >= fromOffset);
  const subsWant = templateSuffix(AGENT_TEMPLATE_IDS.Subscription);
  const subscriptions: SubscriptionRow[] = [];
  for (const c of contracts) {
    if (templateSuffix(c.createdEvent.templateId) !== subsWant) continue;
    try {
      subscriptions.push({ ...activeOf(c.createdEvent, decodeSubscription), createdAtSec: timeSec(c.createdEvent.createdAt, "createdAt") });
    } catch {
      // skip
    }
  }
  const cash = bucket<VenueCashC>(contracts, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === party && c.data.bucket !== PRIVATE_BUCKET).map((c) => ({ cid: c.cid, amount: c.data.amount }));
  return {
    party,
    offset,
    grants: bucket(contracts, TEMPLATE_IDS.AgentGrant, decodeAgentGrant),
    cash,
    grantDesks: bucket(contracts, AGENT_TEMPLATE_IDS.GrantDesk, decodeGrantDesk).filter((d) => d.data.owner === party),
    invites: bucket(contracts, AGENT_TEMPLATE_IDS.SubscriberInvite, decodeSubscriberInvite).filter((i) => i.data.subscriber === party),
    books: bucket(contracts, AGENT_TEMPLATE_IDS.SubscriberBook, decodeSubscriberBook).filter((b) => b.data.subscriber === party),
    subscriptions,
    licenses: bucket(contracts, AGENT_TEMPLATE_IDS.CreatorLicense, decodeCreatorLicense).filter((l) => l.data.creator === party),
    strategies: bucket(contracts, AGENT_TEMPLATE_IDS.Strategy, decodeStrategy),
    listings: bucket(contracts, AGENT_TEMPLATE_IDS.StrategyListing, decodeStrategyListing),
    payouts: bucket(contracts, AGENT_TEMPLATE_IDS.CreatorPayout, decodeCreatorPayout).filter((p) => p.data.creator === party),
    deskOffers: bucket(contracts, AGENT_TEMPLATE_IDS.DeskOffer, decodeDeskOffer).filter((o) => o.data.owner === party),
  };
}

/** Everything of the agents' templates `party` sees, one snapshot (blobs when a disclosure may be needed); `fromOffset` scopes it to a lease. */
export async function readAgentsAs(client: LedgerClient, party: Party, o: { blobs?: boolean; fromOffset?: number } = {}): Promise<AgentsSnapshot> {
  const r = await client.activeContracts({ parties: [party], templateIds: [...AGENT_SEAT_TEMPLATES], includeCreatedEventBlob: o.blobs ?? false });
  return toAgentsSnapshot(party, r.contracts, r.activeAtOffset, o.fromOffset ?? 0);
}

/** A contract as a disclosure (its created-event blob, read by a stakeholder). */
export function disclosureOf(c: ActiveContract): DisclosedContract | null {
  const e = c.createdEvent;
  return e.createdEventBlob ? { createdEventBlob: e.createdEventBlob, templateId: e.templateId, contractId: e.contractId, synchronizerId: c.synchronizerId } : null;
}

export interface RegistryEntry {
  listing: Active<StrategyListingC>;
  /** The creator-signed Strategy this listing mirrors (the venue observes it), when on the ledger. */
  strategy: Active<StrategyC> | null;
  /** The listing's disclosure, for a subscriber's `Subscriber_Subscribe`. */
  disclosure: DisclosedContract | null;
  /** Live consents on record for this strategy (a count; who stays between venue and subscriber). */
  subscribers: number;
  numId: bigint;
  /** Where the Strategy (else the listing) was last created: a creator's label applies only from its lease on (C8i). */
  createdOffset: number;
}

export interface Registry {
  atMs: number;
  entries: RegistryEntry[];
  byNum: Map<string, RegistryEntry>;
  /** Every subscription the reading party sees, by strategy text id. */
  subscriptions: SubscriptionRow[];
}

/** The registry as `reader` sees it (the venue sees everything; a runner or creator sees what it is a stakeholder of). */
export async function readRegistry(client: LedgerClient, reader: Party, nowMs: number): Promise<Registry> {
  const r = await client.activeContracts({
    parties: [reader],
    templateIds: [AGENT_TEMPLATE_IDS.StrategyListing, AGENT_TEMPLATE_IDS.Strategy, AGENT_TEMPLATE_IDS.Subscription],
    includeCreatedEventBlob: true,
  });
  const snap = toAgentsSnapshot(reader, r.contracts, r.activeAtOffset);
  const blobs = new Map(r.contracts.map((c) => [c.createdEvent.contractId, disclosureOf(c)]));
  const offsets = new Map(r.contracts.map((c) => [c.createdEvent.contractId, Number(c.createdEvent.offset)]));
  const counts = new Map<string, number>();
  for (const s of snap.subscriptions) counts.set(s.data.strategyId, (counts.get(s.data.strategyId) ?? 0) + 1);
  const strategyByCid = new Map(snap.strategies.map((s) => [s.cid, s]));
  const strategyById = new Map(snap.strategies.map((s) => [s.data.strategyId, s]));
  // A self-hosting reader that is the creator sees its Strategy but no listing: list it from the Strategy itself.
  const listed = new Set(snap.listings.map((l) => l.data.strategyId));
  const selfListed: Active<StrategyListingC>[] = snap.strategies
    .filter((s) => !listed.has(s.data.strategyId))
    .map((s) => ({ cid: "", data: { venue: s.data.venue, creator: s.data.creator, strategyId: s.data.strategyId, strategyCid: s.cid, runner: s.data.runner, envelope: s.data.envelope, fee: s.data.fee, specHash: s.data.specHash, version: s.data.version, active: s.data.active, publishedAtSec: s.data.publishedAtSec } }));
  const entries = [...snap.listings, ...selfListed].map((listing): RegistryEntry => {
    const strategy = strategyByCid.get(listing.data.strategyCid) ?? strategyById.get(listing.data.strategyId) ?? null;
    return {
      listing,
      strategy,
      disclosure: listing.cid ? (blobs.get(listing.cid) ?? null) : null,
      subscribers: counts.get(listing.data.strategyId) ?? 0,
      numId: strategyNumOf(listing.data.strategyId),
      createdOffset: offsets.get(strategy?.cid ?? listing.cid) ?? 0,
    };
  });
  return { atMs: nowMs, entries, byNum: new Map(entries.map((e) => [e.numId.toString(), e])), subscriptions: snap.subscriptions };
}

/** A creator party's current lessee: shown by its address for strategies created from its lease's start on (C8i). */
export type CreatorLabels = ReadonlyMap<string, { address: string; fromOffset: number }>;

/** The creator a registry entry shows: the lessee's address only when the strategy was created in that lease (C8i). */
export function creatorLabel(e: RegistryEntry, labels: CreatorLabels): string {
  const label = labels.get(e.listing.data.creator);
  return label && e.createdOffset >= label.fromOffset ? label.address : e.listing.data.creator;
}

/**
 * Who may run a creator's strategy (C8i, security review finding 5): the house runner only. A seat's party is pooled
 * and recycled, so subscribers' grants naming it as runner would survive into the next visitor's lease; a creator who
 * asks to run its own bot from its seat is refused, with the reason, before anything is sent.
 */
export function runnerOf(seat: { party: Party; address: string }, requested: string, houseRunner: Party | null): Party {
  const own = requested === seat.address || requested === seat.party;
  if (houseRunner !== null && requested === houseRunner) return houseRunner;
  throw refuse("grant-refused", own ? "a seat's party is recycled with the seat, so it cannot run a strategy: the house runner runs it" : "a strategy runs on the house runner");
}

/**
 * The agent a seat may grant (C8i, finding 5): the house agent-runner party only, which is the strategy runner, the X
 * executor and the desk operator (K-087). Any other party named in a request is refused: a grant to a pooled seat
 * party would outlive the lease.
 */
export function grantAgentOf(requested: string, houseRunner: Party | null): Party {
  if (houseRunner !== null && requested === houseRunner) return houseRunner;
  throw refuse("grant-refused", "a grant names this venue's agent (the house runner, also the X executor)");
}
