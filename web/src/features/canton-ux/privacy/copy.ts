/** Words for the privacy surfaces: the "Who can see this" chip and the per-party view switcher (C-ADD-01, C-ADD-02). */
export type SeenKind = "position" | "quote" | "receipt";

export const PRIVACY = {
  devTitle: "Canton privacy",
  chip: {
    label: "Who can see this",
    short: (holder: string) => `${holder} + venue`,
    aria: (holder: string) => `Who can see this: ${holder === "You" ? "you" : holder} and the venue. Show details.`,
    venue: "The venue",
    venueRole: "the other side of every call",
    holderRole: {
      position: "holds this position",
      quote: "asked for this price",
      receipt: "was paid on this result",
    } satisfies Record<SeenKind, string>,
    foot: {
      position: "It is a contract between the two of you. The ledger sends it to no one else: not other traders, not the oracles.",
      quote: "A firm price made for you alone. It lasts 20 seconds and no one else ever sees it.",
      receipt: "The settled result stays between the same two. Nobody else can read it unless you share it.",
    } satisfies Record<SeenKind, string>,
  },
  switcher: {
    label: "Whose view of the ledger",
    intro: "The same query, sent at the same moment, once per party. Each one gets back only the contracts it is a party to.",
    returned: (n: number) => (n === 1 ? "The ledger returned 1 position" : `The ledger returned ${n} positions`),
    asParty: "Asked as",
    emptyTitle: "The ledger returned nothing for this party",
    emptyBody: "Not hidden by this page: the ledger itself sent back an empty list, because this party is on none of these contracts.",
    query: "The query, exactly as sent",
    queryLabel: (who: string) => `The ledger query sent as ${who}`,
    at: (cents: number) => `at ${cents}¢`,
    contract: "Contract",
    here: "This Window",
    asking: "Asking the ledger as this party…",
    failed: "The ledger did not answer for this party.",
    again: "Ask again",
    live: "Live from the ledger",
    title: "Who sees what on the ledger",
  },
} as const;
