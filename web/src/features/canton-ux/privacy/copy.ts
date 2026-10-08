/** Words for the privacy surfaces: the "Who can see this" chip (C-ADD-01). */
export type SeenKind = "position" | "quote" | "receipt";

export const PRIVACY = {
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
} as const;
