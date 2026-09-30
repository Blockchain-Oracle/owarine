/**
 * The pre-open call's words (S18 lane 18f, D-088). In the reference a post-only call rests on a listed Window at the
 * user's own price. On Canton that is a bilateral `RestingCall` that does not exist yet: the submitter refuses a rest
 * (`packages/markets/src/submitter/create.ts`, `REST_NOT_LIVE`) and the schedule button carries the `rest-not-live`
 * blocker, so every line a user can reach says a listed Window takes calls from the bell, at the venue's firm quote.
 * The receipt and rows below describe a rested call, which Canton cannot produce yet. Split from `copy-ticket.ts` for
 * the 400-line rule; re-exported through `@/lib/copy`. Money and prices arrive formatted; nothing here does arithmetic.
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
    /** The strip's caption once the call is sized: what it would hold, and that it cannot rest on Canton yet. */
    rests: (cents: number) => `At ${cents}¢ · resting calls aren't on Canton yet; the Window takes calls from the bell`,
    restsUntilLock: (cents: number) => `At ${cents}¢ until the Window locks · resting calls aren't on Canton yet`,
    sizing: "Enter a stake to size the call",
    reading: "Reading the Series grid…",
    held: "Held",
    contracts: "Contracts",
    ifWrong: "If wrong",
    cta: (side: string) => `Schedule ${side} for`,
    ctaPlain: "Schedule a call",
    untilLock: "Keep it resting until the Window locks",
    untilLockNote: "Off, a call would expire 90 s after the bell; on, it would rest until the Window locks. Neither runs on Canton yet: nothing rests before the bell.",
    /** The promise, D-088 r2, as Canton runs today: nothing is signed or held on a listed Window (a Canton seat posts no bond). */
    footnote: (_bondText: string) =>
      "Resting calls aren't on Canton yet, so nothing here is signed and none of your credits are held. At the bell this Window trades like any other: your seat takes the venue's firm quote in one tap.",
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
    portfolio: "Portfolio",
    another: "Schedule another",
  },
  card: {
    clock: "listed",
    /** "Listed · opens Wed 09:30 ET". */
    headline: (opens: string) => `Listed · opens ${opens}`,
    why: "Calls open at the bell, at the venue's firm quote. Resting one at your own price before then isn't on Canton yet.",
    cta: "Schedule a call",
    hint: "not on Canton yet",
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
    expired: "Didn't fill",
    expiredWhy: "stake returns as venue credit",
    cancelled: "Cancelled",
    /** "UP at 55¢ · 10 contracts". */
    call: (side: string, cents: number, contractsText: string) => `${side} at ${cents}¢ · ${contractsText} contracts`,
    held: "Held",
    fillsBy: "fills by",
    cancel: "Cancel",
    cancelling: "Cancelling…",
  },
} as const;
