/**
 * Per-party reads (plan §5): the seat's own active contracts, queried AS the seat's party, so the participant returns
 * only contracts that party is a stakeholder of. A 1.5 s in-process cache absorbs the several reads a screen mounts
 * together, and every write the seat makes through these routes invalidates it, so a user's own call shows at once.
 *
 * Market metadata (`MarketTerms`, `Resolution`) is not the seat's to see: it is read as the venue, read-only, because
 * the seat's position needs its Window's times and `Leg_Claim` needs the resolution as a disclosed contract. No command
 * is ever submitted as the venue from here.
 */
import { PRIVATE_BUCKET, PRIVATE_LEG_REF } from "@owarine/core/private";
import { TEMPLATE_IDS } from "@owarine/daml";
import { LedgerError, type ActiveContract, type CreatedEvent, type LedgerClient, type Party } from "@owarine/ledger";
import {
  buyQuoteView, cashView, isEntity, legView, quoteView, resolutionView, restingCallView, restingOfferView, termsView,
  type BuyQuoteView, type CashView, type LegView, type QuoteView, type ResolutionView, type RestingCallView, type RestingOfferView, type TermsView,
} from "./contracts";

export interface SeatSnapshot {
  party: Party;
  /** The offset the snapshot is active at. */
  offset: number;
  /** The seat's spendable cash: every bucket but `private` (C8d, L-39). */
  cash: CashView[];
  /** The seat's private bucket: spent only by a private call, moved only by the private route. Optional for hand-built snapshots. */
  privateCash?: CashView[];
  /** Every leg but its private calls, which only the private list shows (they are never sold, published or exited). */
  legs: LegView[];
  privateLegs?: LegView[];
  quotes: QuoteView[];
  /** Live buy-backs of the seat's legs (C7a exits). Optional so hand-built snapshots in tests stay valid. */
  buyQuotes?: BuyQuoteView[];
  /** The venue's offers to hold a resting call, not yet placed (C7c). Optional like `buyQuotes`. */
  restingOffers?: RestingOfferView[];
  /** The seat's resting calls, each holding its escrow (C7c). Optional like `buyQuotes`. */
  restingCalls?: RestingCallView[];
}

export const SEAT_CACHE_MS = 1_500;
const SEAT_TEMPLATES = [TEMPLATE_IDS.VenueCash, TEMPLATE_IDS.Leg, TEMPLATE_IDS.Quote, TEMPLATE_IDS.BuyQuote, TEMPLATE_IDS.RestingOffer, TEMPLATE_IDS.RestingCall];

export interface SeatReader {
  read(party: Party, o?: { fresh?: boolean }): Promise<SeatSnapshot>;
  /** After the seat's own write: the next read goes to the ledger. */
  invalidate(party: Party): void;
}

export function toSnapshot(party: Party, contracts: readonly ActiveContract[], offset: number): SeatSnapshot {
  const snap: SeatSnapshot = { party, offset, cash: [], privateCash: [], legs: [], privateLegs: [], quotes: [], buyQuotes: [], restingOffers: [], restingCalls: [] };
  for (const { createdEvent: e } of contracts) {
    if (isEntity(e, "VenueCash")) {
      // A seat also witnesses nothing else's cash, but the filter is stated anyway: only the party's own money counts.
      const owner = (e.createArgument as { owner?: unknown }).owner;
      if (owner !== party) continue;
      const cash = cashView(e);
      (cash.bucket === PRIVATE_BUCKET ? snap.privateCash! : snap.cash).push(cash);
    } else if (isEntity(e, "Leg")) {
      const leg = legView(e);
      if (leg.owner === party) (leg.ref === PRIVATE_LEG_REF ? snap.privateLegs! : snap.legs).push(stripOwner(leg));
    } else if (isEntity(e, "Quote")) {
      const quote = quoteView(e);
      if (quote.user === party) snap.quotes.push(stripUser(quote));
    } else if (isEntity(e, "BuyQuote")) {
      const { user, ...bq } = buyQuoteView(e);
      if (user === party) snap.buyQuotes!.push(bq);
    } else if (isEntity(e, "RestingOffer")) {
      const { owner, ...offer } = restingOfferView(e);
      if (owner === party) snap.restingOffers!.push(offer);
    } else if (isEntity(e, "RestingCall")) {
      const { owner, ...call } = restingCallView(e);
      if (owner === party) snap.restingCalls!.push(call);
    }
  }
  return snap;
}

const stripOwner = ({ owner: _o, ...leg }: LegView & { owner: string }): LegView => leg;
const stripUser = ({ user: _u, ...quote }: QuoteView & { user: string }): QuoteView => quote;

export function createSeatReader(client: LedgerClient, o: { cacheMs?: number; now?: () => number } = {}): SeatReader {
  const cacheMs = o.cacheMs ?? SEAT_CACHE_MS;
  const now = o.now ?? Date.now;
  const cache = new Map<Party, { at: number; value: Promise<SeatSnapshot> }>();
  return {
    read(party, opts = {}) {
      const hit = cache.get(party);
      if (!opts.fresh && hit && now() - hit.at < cacheMs) return hit.value;
      const value = client.activeContracts({ parties: [party], templateIds: SEAT_TEMPLATES }).then((r) => toSnapshot(party, r.contracts, r.activeAtOffset));
      const entry = { at: now(), value };
      cache.set(party, entry);
      value.catch(() => cache.get(party) === entry && cache.delete(party));
      if (cache.size > 512) for (const [key, e] of cache) if (now() - e.at >= cacheMs) cache.delete(key);
      return value;
    },
    invalidate(party) {
      cache.delete(party);
    },
  };
}

export interface MarketReader {
  /** One Window's terms by contract id; terms are immutable, so a hit is kept for the process's life. */
  terms(termsCid: string): Promise<TermsView | null>;
  /** The Resolution of each terms contract that has one, with its disclosure blob. */
  resolutions(): Promise<Map<string, ResolutionView>>;
}

export const RESOLUTION_CACHE_MS = 3_000;

interface EventsByContractId {
  created?: { createdEvent: CreatedEvent; synchronizerId: string };
}

export function createMarketReader(client: LedgerClient, venue: Party, o: { cacheMs?: number; now?: () => number } = {}): MarketReader {
  const cacheMs = o.cacheMs ?? RESOLUTION_CACHE_MS;
  const now = o.now ?? Date.now;
  const terms = new Map<string, Promise<TermsView | null>>();
  let resolved: { at: number; value: Promise<Map<string, ResolutionView>> } | null = null;

  async function fetchTerms(cid: string): Promise<TermsView | null> {
    try {
      const r = await client.http.request<EventsByContractId>("POST", "/v2/events/events-by-contract-id", {
        json: { contractId: cid, eventFormat: { filtersByParty: { [venue]: { cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId: TEMPLATE_IDS.MarketTerms, includeCreatedEventBlob: false } } } }] } }, verbose: false } },
      });
      return r.created ? termsView(r.created.createdEvent) : null;
    } catch (error) {
      if (error instanceof LedgerError && error.kind === "not-found") return null;
      throw error;
    }
  }

  return {
    terms(cid) {
      let hit = terms.get(cid);
      if (!hit) {
        hit = fetchTerms(cid);
        terms.set(cid, hit);
        // Only a found contract is kept for good; a miss or an error is asked again next time.
        hit.then((v) => v === null && terms.delete(cid), () => terms.delete(cid));
      }
      return hit;
    },
    resolutions() {
      if (resolved && now() - resolved.at < cacheMs) return resolved.value;
      const value = client
        .activeContracts({ parties: [venue], templateIds: [TEMPLATE_IDS.Resolution], includeCreatedEventBlob: true })
        .then((r) => {
          const out = new Map<string, ResolutionView>();
          for (const c of r.contracts) if (isEntity(c.createdEvent, "Resolution")) {
            const view = resolutionView(c.createdEvent, c.synchronizerId);
            out.set(view.termsCid, view);
          }
          return out;
        });
      const entry = { at: now(), value };
      resolved = entry;
      value.catch(() => resolved === entry && (resolved = null));
      return value;
    },
  };
}
