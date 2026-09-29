/**
 * The view switcher's read (plan §5): a live active-contracts query AS one party, with the literal request body echoed
 * back so the page can show exactly what was asked. The caller chooses among reserved personas and the seat's own
 * party only; the route maps `as` to a party, never the request.
 *
 * Honest wording on one shared participant: "queried as party X; the participant returns only contracts X is a
 * stakeholder of". It is the participant's filter, not a claim that the data never reached this node.
 */
import { TEMPLATE_IDS } from "@agari/daml";
import { eventFormat, type LedgerClient, type Party } from "@agari/ledger";
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
