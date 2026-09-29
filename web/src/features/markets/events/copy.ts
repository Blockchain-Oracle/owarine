/** Committee events on the board (C6e, K-070): the words of the event card, the board section and the event hero. */
export const EVENT_BOARD = {
  reading: "reading the board…",
  none: "No committee event is open right now. A new question lists here the moment the venue opens one.",
  meta: (label: string) => `Event · ${label}`,
  committee: "Committee",
  locks: (clock: string) => `trading ends ${clock}`,
  answers: (clock: string) => `answered after ${clock}`,
  opens: (clock: string) => `opens ${clock}`,
  locked: "Trading has ended. The committee answers after the close; YES pays if it attests yes.",
  settles: (quorum: string) => `Settles on the oracle committee's signed answers: ${quorum}, and a split answer voids and refunds.`,
  quorumUnknown: "a quorum of the oracle parties must agree",
  open: "Open",
  heroAsk: "Will it happen?",
  endsIn: "Trading ends in",
  howItSettles: "How it settles",
  steps: [
    "Buy YES or NO at the venue's price while trading is open.",
    "After the close each committee member posts a signed answer, naming the source it read.",
    "A unanimous quorum settles YES or NO; a split answer voids the event and every stake is refunded.",
  ],
} as const;

/** The ticket's and the hero's side words on an event: Up is YES, Down is NO (core `eventOutcomeOf`). */
export const EVENT_SIDE_WORD = { up: "Yes", down: "No" } as const;
