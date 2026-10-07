/**
 * The view switcher's read (plan §5): a live active-contracts query AS one party, with the literal request body echoed
 * back so the page can show exactly what was asked. The caller chooses among reserved personas and the seat's own
 * party only; the route maps `as` to a party, never the request.
 *
 * Honest wording on one shared participant: "queried as party X; the participant returns only contracts X is a
 * stakeholder of". It is the participant's filter, not a claim that the data never reached this node.
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import { eventFormat, type LedgerClient, type Party } from "@owarine/ledger";
import { entityOf } from "./contracts";

export const VIEW_TEMPLATES = [TEMPLATE_IDS.VenueCash, TEMPLATE_IDS.Quote, TEMPLATE_IDS.Leg, TEMPLATE_IDS.Resolution, TEMPLATE_IDS.MarketTerms] as const;

export interface ViewRow {
  template: string;
  contractId: string;
  signatories: string[];
  observers: string[];
  /** The contract's arguments exactly as the participant returned them (Daml JSON). */
  payload: unknown;
}

export interface PartyView {
  party: Party;
  /** The literal `POST /v2/state/active-contracts-page` body sent, minus paging fields. */
  request: { eventFormat: ReturnType<typeof eventFormat> };
  activeAtOffset: number;
  rows: ViewRow[];
  /** Rows past the display cap are counted, not sent. */
  total: number;
}

export const VIEW_ROW_CAP = 50;

export async function viewAs(client: LedgerClient, party: Party): Promise<PartyView> {
  const request = { eventFormat: eventFormat({ parties: [party], templateIds: [...VIEW_TEMPLATES] }) };
  const { contracts, activeAtOffset } = await client.activeContracts({ parties: [party], templateIds: [...VIEW_TEMPLATES] });
  const rows = contracts.slice(0, VIEW_ROW_CAP).map(({ createdEvent: e }) => ({
    template: entityOf(e.templateId),
    contractId: e.contractId,
    signatories: e.signatories,
    observers: e.observers ?? [],
    payload: e.createArgument,
  }));
  return { party, request, activeAtOffset, rows, total: contracts.length };
}

/** A Canton party id: `<hint>::<fingerprint>` (the fingerprint hex). */
const PARTY_ID = /^[^\s:]+::[0-9a-f]{8,}$/;

/**
 * The rows with every party id named by its role instead (C4d M4): signatories, observers and any party inside the
 * payload become `venue`, `alice`, `you`, `a seat`, … from `labels`, and any other party-shaped text `another party`.
 * The view shows WHO holds what by role; the ids themselves (the venue's above all) are not handed to an unauthenticated
 * page. The literal query body and the queried party stay as they were: that is the request this page shows.
 */
export function relabelView(view: PartyView, labels: ReadonlyMap<string, string>): PartyView {
  const name = (p: string) => labels.get(p) ?? "another party";
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return labels.has(v) || PARTY_ID.test(v) ? name(v) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return { ...view, rows: view.rows.map((r) => ({ ...r, signatories: r.signatories.map(name), observers: r.observers.map(name), payload: walk(r.payload) })) };
}
