import { LEVERAGE_NOT_DEPLOYED } from "@agari/core/leverage";

/**
 * `/short` — A-1b, the inverse position.
 *
 * The reference has no short: its leverage is a chip inside the Up/Down ticket and a row in the portfolio's bet
 * list, which frames a boost as amplifying a call held to the bell. Nothing here overrides those words — the
 * ticket's chips and `LeverageBetRow` keep the reference's copy exactly. These are the words for the surface the
 * reference does not have, in the venue's own voice.
 *
 * The premium and the knock-out line are the reserve's parameters, not constants, so every sentence that names
 * one takes it from the reserve that is actually deployed. On Canton (`abu-pm-tickets` `PM.Tickets.Boost`, K-029) a
 * position is marked at the venue ladder's fair price (`packages/markets/src/leverage/reads.ts`, re-read every 5 s),
 * closes at the venue's firm buy-back quote, is knocked out only by the venue with an oracle quorum at a barrier pinned
 * at issue, and a void returns the whole stake — there is no book, so no sentence here names one.
 */
export const SHORT = {
  title: "Short",
  eyebrow: "Sell the fall · exit whenever",
  lede: "A short here is a Down position the reserve holds for you. It is marked at the venue's published price every few seconds, you can close it whenever the venue is quoting, and the most you can lose is what you put in.",
  sections: {
    open: { number: "01", title: "Open a short", desc: "Pick the stock, pick the window, size it. The venue prices it from its published ladder before your seat signs." },
    positions: { number: "02", title: "Your shorts", desc: "What each one is worth right now, and how far it is from the line it knocks out at." },
    how: { number: "03", title: "How a short works here" },
  },

  picker: {
    stock: "What to short",
    window: "How long",
    noneTitle: "Nothing listed to short yet",
    noneBody: "Windows appear here as the venue lists them, with the time each one opens.",
    filterAria: "Show",
    filter: { all: "All", stock: "Stocks", allDay: "24/7" },
    cadenceAria: "Window length",
    kind: { stock: "Stock", preIpo: "Pre-IPO · 24/7", basket: "Basket · 24/7" },
    liveNow: "Live",
    groupLive: "Trading now",
    groupLater: (sessionLabel: string) => `Stocks · ${sessionLabel}`,
    groupLaterBare: "Opens later",
    opens: (when: string) => `Opens ${when}`,
    closed: "Closed",
    noQuotes: "no quotes",
    loading: "Reading the board…",
    /** The Down ask in cents: what a dollar of Down costs right now. */
    cost: (cents: number) => `${cents}¢`,
    costPending: "…",
    costNone: "—",
    costLabel: "Down",
    windows: (n: number) => (n === 1 ? "1 window" : `${n} windows`),
    left: "left",
  },

  ticket: {
    title: "Size the short",
    amount: "Your stake",
    max: "Max",
    wallet: (amount: string, symbol: string) => `${amount} ${symbol} in your seat`,
    walletPending: "reading your balance…",
    connect: "Take a seat to open a short.",
    multiple: "Multiple",
    /** `owner_open` requires `leverage_bps > LEVERAGE_ONE_BPS`, so 1× is not a short the reserve will hold. */
    multipleHint: (premiumPct: string) => `The reserve fronts the rest of the position and charges ${premiumPct} on what it fronts. Your loss is still capped at your stake.`,
    pickWindow: "Pick a window first.",
    opensTitle: (name: string, when: string) => `${name} opens ${when}`,
    opensBody: "A short opens once its Window is trading. Until then you can schedule a plain Down call: it rests at your price and fills after the bell if the venue's price comes to it.",
    scheduleDown: "Schedule a Down call",
    thinNone: "Nobody is offering Down on this Window right now.",
    thinSome: (max: string, symbol: string) => `The venue quotes up to about ${max} ${symbol} at this multiple.`,
    useMax: (max: string, symbol: string) => `Use ${max} ${symbol}`,
    thinExit: "The venue could not quote this position back whole, so the reserve will not open it. Try a smaller stake or a lower multiple.",
    enterAmount: "Enter a stake.",
    pricing: "Pricing on the venue's ladder…",
    refused: "The reserve refused this short — see why above.",
    /** The chain sizes to the venue's lot, so the charge can be under the typed stake. */
    sized: (charged: string, symbol: string) => `Sized to the venue's lot: ${charged} ${symbol} is charged, the rest stays in your seat.`,
    requote: (contracts: string) => `The venue's price moved — your stake now buys ${contracts} contracts. Confirm again at the new size.`,
    paused: "The reserve is paused: no new shorts. Live ones still settle, close and knock out.",
    cells: { contracts: "Contracts", entry: "Entry", back: "Back if it falls" },
    knockNote: (line: string, symbol: string) => `Knocks out at ${line} ${symbol}.`,
    cta: (asset: string, x: number) => `Short ${asset} ${x}× for`,
    ctaPlain: "Short",
    busy: "Opening…",
    opened: (contracts: string, asset: string) => `Short open: ${contracts} contracts of ${asset} Down.`,
  },

  positions: {
    connect: "Take a seat to see your shorts.",
    empty: "No short open.",
    emptyBody: "Open one above and it appears here, marked at the venue's price.",
    totals: (priced: number, live: number) => (priced === live ? `${live} open` : `${live} open · ${priced} priced`),
    staked: "Staked",
    worth: "Worth now",
    unpriced: "No venue quote to mark against",
    unpricedWhy: "The venue is not quoting this Window right now, so there is no honest mark and no exit. It marks at settlement.",
    entry: "Entry",
    now: "Now",
    size: "Size",
    /** The number an owner acts on: how far the mark may fall before the venue may knock the position out. */
    drop: (pct: string) => `${pct} fall reaches the line`,
    atLine: "At the line — the venue may knock this out on an oracle quorum",
    noLine: "No line · nothing fronted",
    line: (amount: string, symbol: string) => `line ${amount} ${symbol}`,
    close: "Close",
    closing: "Closing…",
    settle: "Settle",
    settling: "Settling…",
    claim: "Claim",
    claiming: "Claiming…",
    owed: (amount: string, symbol: string) => `${amount} ${symbol} waiting to be claimed`,
    settledTitle: "Closed shorts",
    result: { closed: "Closed", knockedOut: "Knocked out", won: "Won", lost: "Lost", settled: "Settled" },
    back: (amount: string, symbol: string) => `${amount} ${symbol} back`,
    nothingBack: "Nothing back",
    closedToast: (amount: string, symbol: string) => `Closed: ${amount} ${symbol} back to your seat.`,
  },

  /** The three cards under §03. The premium and the line are the reserve's parameters, so they are passed in. */
  how: (premiumPct: string, maintenancePct: string) => [
    {
      n: "①",
      t: "A position, not a bet",
      d: "Shorting buys Down contracts and leaves them with the reserve. What they are worth moves with the venue's published price, re-read every few seconds, and you can sell them back to the venue at its firm quote whenever it is quoting — you do not have to wait for the bell.",
    },
    {
      n: "②",
      t: "The reserve fronts the rest",
      d: `The reserve puts up the rest of the position and charges ${premiumPct} on what it fronts. That premium is inside your stake, and your stake is the most you can lose.`,
    },
    {
      n: "③",
      t: "The line it knocks out at",
      d: `The reserve is repaid before you are. The line is fixed when the short opens, at ${maintenancePct} of what the reserve fronted, and only the venue can knock the position out — with the Window's oracle quorum printing past it. Your card shows the fall that reaches that line. A void returns your whole stake.`,
    },
  ],

  notDeployed: {
    eyebrow: "Inverse",
    title: "Short",
    body: "A Down position the reserve holds and marks at the venue's published price, with a knock-out line and an exit whenever the venue is quoting.",
    why: LEVERAGE_NOT_DEPLOYED,
    dependency: "the Boost contracts of abu-pm-tickets on this network (proven on the local sandbox, not yet on DevNet)",
  },
} as const;
