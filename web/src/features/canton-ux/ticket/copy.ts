import type { WritePhase } from "@owarine/core/ports";

/** Words for the ticket's Canton additions: write progress and the firm-quote ring (C-ADD-08, L-32, D-081). */
export const QUOTE_TTL_SEC = 20;

export const TICKET_CANTON = {
  devTitle: "Ticket on Canton · three directions",
  progressLabel: "Placing your call",
  steps: [
    { label: "Price", hint: "held for you" },
    { label: "Sent", hint: "to the ledger" },
    { label: "Confirming", hint: "the venue accepts" },
    { label: "Placed", hint: "on the ledger" },
  ],
  status: {
    composing: "Holding your price…",
    submitted: "Sent to the ledger…",
    confirming: "Waiting for the venue to accept…",
    confirmed: "Placed. Ledger update",
    reverted: "The venue did not accept this call. Nothing was spent.",
    unknown: "No answer yet. We are checking the ledger, so don't place it again: your history will show it either way.",
  } satisfies Record<WritePhase, string>,
  step: (n: number, total: number, label: string) => `Step ${n} of ${total}: ${label}`,
  /** Where the composing ticket's prices come from (plan §6): said once, in the ticket's footnote. */
  ladder: "Prices shown are the venue's price ladder (indicative, not a public order book); the firm price is held when you place.",
  ring: {
    held: (sec: number) => `Price held for ${sec} s`,
    heldShort: "Price held",
    price: (cents: number) => `${cents}¢`,
  },
  expired: {
    title: "That price ran out before it was used. Nothing was placed.",
    fresh: (from: number, to: number) => `The price is now ${to}¢ (was ${from}¢).`,
    cta: (side: string, cents: number) => `Buy ${side} at ${cents}¢ for`,
  },
  receipt: {
    title: "Your call",
    update: "Ledger update",
    updateAria: (id: string) => `Ledger update ${id}: open it on the proof page`,
    market: "Window",
    side: "Side",
    price: "Price",
    stake: "Stake",
    maxLoss: "Most you can lose",
    done: "Done",
    close: "Close",
    ranOut: (from: number, to: number) => `${to}¢ now · ${from}¢ ran out`,
  },
  /** The cash-out's write (C7a): the same four steps, in a sale's words. */
  sale: {
    progressLabel: "Selling back",
    steps: [
      { label: "Price", hint: "held for you" },
      { label: "Sent", hint: "to the ledger" },
      { label: "Confirming", hint: "the venue buys back" },
      { label: "Sold", hint: "on the ledger" },
    ],
    status: {
      composing: "Holding your price…",
      submitted: "Sent to the ledger…",
      confirming: "Waiting for the venue to buy it back…",
      confirmed: "Sold. Ledger update",
      reverted: "The venue did not take this sale. Nothing was sold.",
      unknown: "No answer yet. We are checking the ledger, so don't sell it again: your history will show it either way.",
    } satisfies Record<WritePhase, string>,
  },
  demo: {
    play: "Place it",
    fail: "Make the venue refuse it",
    again: "Run again",
  },
} as const;
