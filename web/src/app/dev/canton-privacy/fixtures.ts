import type { PartyView } from "@/features/canton-ux/privacy";
import { ALICE, BOB, contractId, FIXTURE_OFFSET, OUTSIDER } from "../canton-ids";

/**
 * `/dev/canton-privacy`: what the ledger returns to Alice, Bob and an outsider for one active-contracts query at one
 * offset. Alice holds two legs, Bob one, the outsider none. Positions and ids are fixture values.
 */
const REQUEST = "POST /v2/state/active-contracts-page";
const LEG_TEMPLATE = "#abu-pm-main:Pm.Leg:Leg";

/** The body the ledger client sends (`packages/ledger/src/client.ts` activeContractsPage), pretty-printed. */
export function queryBody(party: string): string {
  return JSON.stringify(
    {
      eventFormat: {
        filtersByParty: {
          [party]: { cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId: LEG_TEMPLATE, includeCreatedEventBlob: false } } } }] },
        },
        verbose: false,
      },
      activeAtOffset: FIXTURE_OFFSET,
      maxPageSize: 100,
    },
    null,
    2,
  );
}

export const VIEWS: readonly PartyView[] = [
  {
    value: "alice",
    label: "Alice",
    party: ALICE,
    request: REQUEST,
    query: queryBody(ALICE),
    positions: [
      { contractId: contractId("a1c3"), market: "TSLA · 5m Window", side: "up", stakeText: "5.00 tUSDC", priceCents: 62 },
      { contractId: contractId("a1c4"), market: "NVDA · 1h Window", side: "down", stakeText: "12.50 tUSDC", priceCents: 41 },
    ],
  },
  {
    value: "bob",
    label: "Bob",
    party: BOB,
    request: REQUEST,
    query: queryBody(BOB),
    positions: [{ contractId: contractId("b0b1"), market: "TSLA · 5m Window", side: "down", stakeText: "3.00 tUSDC", priceCents: 38 }],
  },
  { value: "outsider", label: "Outsider", party: OUTSIDER, request: REQUEST, query: queryBody(OUTSIDER), positions: [] },
];
