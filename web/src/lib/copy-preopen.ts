/**
 * The pre-open call's words (S18 lane 18f, D-088). A post-only call rests on a listed Window at the user's own price and
 * fills within the first minute after the bell if the venue's price comes to it. On Canton it is a bilateral
 * `RestingCall` (abu-pm-main 0.5.1, K-235): the seat's stake is held inside the contract, the venue fills it at exactly
 * the price named, in whole or in part, and an unfilled call returns the stake as venue credit. A Canton seat posts no
 * bond, so no line here mentions one. Split from `copy-ticket.ts` for the 400-line rule; re-exported through `@/lib/copy`.
 * Money and prices arrive formatted; nothing here does arithmetic.
 */
export const PREOPEN = {
  ticket: {
    /** The head line above the composer: "Listed · opens Wed 09:30 ET". */
    listed: (opens: string) => `Listed · opens ${opens}`,
    priceLabel: "Your price",
    priceAria: (side: string) => `Price per ${side} contract, in cents`,
    priceChips: "Quick prices",
    step: { down: "1¢ less", up: "1¢ more" },
    /** The price is what a contract costs the caller and what it implies: "55¢ a contract · pays 1.00 if right". */
    pays: (symbol: string) => `pays 1 ${symbol} a contract if right`,
    /** The strip's caption once the call is sized. */
    rests: (cents: number) => `Rests at ${cents}¢ · fills in the first minute after the bell if the venue's price comes to you`,
    restsUntilLock: (cents: number) => `Rests at ${cents}¢ · until the Window locks, if the venue's price ever comes to you`,
    sizing: "Enter a stake to size the call",
    reading: "Reading the Series grid…",
    held: "Held",
    contracts: "Contracts",
    ifWrong: "If wrong",
    cta: (side: string) => `Schedule ${side} for`,
    ctaPlain: "Schedule a call",
    untilLock: "Keep it resting until the Window locks",
    untilLockNote: "Off, an unfilled call expires 90 s after the bell and the stake comes back. On, it rests through the Window and may be taken whenever the venue's price reaches yours.",
    /** The promise, D-088 r2: every clause is true of the contract as deployed. A Canton seat posts no bond. */
    footnote:
      "Your seat signs. Your stake is held from now until it fills, you cancel, or it expires, and then comes back as venue credit. No fill is promised: the venue takes a resting call at your price only when its own price reaches it, and nothing fills before the open. An unfilled call loses nothing if the Window voids.",
    /** The outcome line after a rest lands. */
    resting: (contractsText: string, side: string, cents: number) => `Resting ${contractsText} ${side} at ${cents}¢`,
    restingToast: (contractsText: string, side: string, cents: number) => `Scheduled ${contractsText} ${side} at ${cents}¢ — resting for the open`,
    /** `rest-would-cross`: the venue's ladder already prices the other side there, so the call would take instead of rest. */
    crossing: (other: string, otherCents: number, side: string, maxCents: number) =>
      maxCents >= 1 ? `The venue quotes ${other} at ${otherCents}¢ — rest ${side} at ${maxCents}¢ or less, or wait for the bell` : `The venue quotes ${other} at ${otherCents}¢ — nothing rests under that; wait for the bell`,
  },
  receipt: {
    eyebrow: "Scheduled",
    window: "Window",
    price: "Your price",
    contracts: "Contracts",
    held: "Held",
    fillsBy: "Fills",
    bell: "within the first minute after the bell, or the stake comes back",
    lock: "any time until the Window locks",
    opens: (when: string) => `opens ${when}`,
    tx: "scheduled tx",
    cancel: "Cancel the call",
    cancelling: "Cancelling…",
    cancelled: "Cancelled — the stake is back in your venue credit.",
    /** The seat cancelled a call that had already ended: nothing was sent. */
    ended: "That call already ended: it filled, expired or was cancelled.",
    portfolio: "Portfolio",
    another: "Schedule another",
  },
  card: {
    clock: "listed",
    /** "Schedule a call · opens Wed 09:30 ET". */
    headline: (opens: string) => `Schedule a call · opens ${opens}`,
    why: "Rest a post-only call at your price now; it fills within the first minute after the bell if the venue's price comes to you.",
    cta: "Schedule a call",
    hint: "post-only · your price",
    aria: (asset: string) => `Schedule a call on this ${asset} Window`,
  },
  /** The closed hero while a listed Window is selected (D-088): its head names the Window under the last price. */
  hero: {
    listedWindow: (cadence: string, opens: string) => `${cadence} Window · opens ${opens}`,
  },
  /** The schedule seam on the closed surfaces (the asset hero's foot, the ticket placeholder, the next-Window card). */
  seam: {
    cta: "Schedule a call",
    /** "5m · opens Wed 09:30 ET": which listed Window the call goes on. */
    which: (cadence: string, opens: string) => `${cadence} · opens ${opens}`,
    /** Nothing is listed yet: the roller lists the next session's first Windows at the close (D-090). */
    listsAtClose: (clock: string) => `Lists at the close · ${clock}`,
    listsBeforeOpen: (opens: string) => `Lists before the open · ${opens}`,
    aria: (asset: string, cadence: string, opens: string) => `Schedule a call on the ${asset} ${cadence} Window that opens ${opens}`,
  },
  rows: {
    restingForOpen: "Resting for the open",
    resting: "Resting",
    /** Ended states (the portfolio keeps them): filled, filled in part, swept unfilled, cancelled by the seat. */
    filled: "Filled",
    partlyFilled: "Partly filled",
    expired: "Didn't fill",
    expiredWhy: "stake returns as venue credit",
    cancelled: "Cancelled",
    cancelledWhy: "stake is back as venue credit",
    filledWhy: "filled at your price",
    /** A call filled in part: how much of it filled, before what came back. */
    partlyWhy: (filledText: string, totalText: string) => `${filledText} of ${totalText} contracts filled at your price`,
    returned: "Back in venue credit",
    /** "UP at 55¢ · 10 contracts". */
    call: (side: string, cents: number, contractsText: string) => `${side} at ${cents}¢ · ${contractsText} contracts`,
    held: "Held",
    fillsBy: "fills by",
    cancel: "Cancel",
    cancelling: "Cancelling…",
  },
} as const;
