/** Words for the resolution evidence and the trust-boundary note (C-ADD-11, the proof page's Canton additions). */
export const PROOF_CANTON = {
  devTitle: "Proof on Canton",
  timeline: "How this Window was decided",
  openPrint: (price: string) => `Open print ${price}`,
  quoted: (n: number, price: string) => `Oracle ${n} quoted ${price}`,
  missed: (n: number) => `Oracle ${n} did not report`,
  missedBody: (deadline: string) => `No quote arrived before the ${deadline} deadline.`,
  median: (price: string) => `Median ${price}`,
  spread: (spread: string, limit: string) => `The quotes are ${spread} apart; the limit is ${limit}.`,
  noMedian: "No median",
  noMedianBody: "Two quotes are not a quorum, so no close price was taken.",
  resolved: (side: string) => `Resolved ${side}`,
  resolvedBody: (close: string, open: string, word: string) => `${close} closed ${word} the ${open} open.`,
  voided: "Voided",
  voidReason: { quorum: "Only two of three oracles reported before the deadline." },
  voidBody: "Every call on this Window gets its cost and fee back.",
  update: "Ledger update",
  party: "Party",
  reverify: {
    title: "Check it yourself",
    body: "The quotes and the result are ledger contracts with the update ids above. Re-verify replays the archived price against the same rule.",
  },
  trust: {
    title: "Trust boundary",
    statement: "One operator holds the ledger credential for all demo parties; the ledger still returns each party only its own contracts.",
    points: [
      "Between parties, privacy is the ledger's: Alice's query cannot return Bob's positions, and an outsider's returns nothing.",
      "From the operator, it is not: whoever holds the credential could act as any demo party. That is a demo shortcut, said plainly.",
      "With each person holding their own key, the operator could no longer act for them; this demo does not do that yet.",
    ],
    state: "Demo setup",
  },
} as const;
