/** Test funds: a bounded devnet SOL treasury for fees and a server-sent tUSDC mint, both behind one free signature (D-034). */
export const FUNDING = {
  pill: {
    title: "Tap to add money.",
    unit: (symbol: string) => symbol,
    plus: "+",
    aria: "Your balance — tap to add money",
  },
  modal: {
    eyebrow: "Add funds · devnet",
    title: "Get test funds",
    body: "SOL pays network fees. We add a little first when your wallet is below 0.005 SOL, then add free credits for trading. One free signature covers both. You can start with an empty wallet.",
    sequence: (amount: string, symbol: string) => `1. Add SOL if needed → 2. Add ${amount} ${symbol}`,
    gasPolicy: "Below 0.005 SOL: top up to 0.02 SOL, at most once per 24 hours while funds last. With enough SOL, skip straight to credits.",
    connectFirst: "Connect a wallet first.",
    account: "Your account",
    copied: "copied ✓",
    request: (_amount: string, _symbol: string) => "Get test funds",
    requesting: "Adding demo credits…",
    done: (amount: string, symbol: string) => `${amount} ${symbol} added to your wallet.`,
    trade: "Trade from wallet →",
    close: "Close add funds",
    needMore: "External SOL faucets ↗",
    gasFirst: "Need SOL for fees while our allocation is unavailable? Use an external faucet:",
  },
  /** The Canton grant: demo credits into the seat's party, through the seat's lease (plan §4). No faucet, no fees. */
  seat: {
    eyebrow: "Demo credits · test network",
    title: "Demo credits",
    body: "A seat trades with demo credits on a Canton test network. They have no cash value, and nothing here can be bought, sold or withdrawn. The venue credits a seat when it first leases a party.",
    takeSeatFirst: "Take a seat first: demo credits go to a seat.",
    account: "Seat",
    party: "Party",
    credits: "Demo credits",
    cashValue: "Cash value",
    none: "None",
    lease: "Lease a party",
    request: "Get demo credits",
    requesting: "Asking the venue…",
    funded: "The venue credited this seat. Credits are granted once per lease.",
    unfunded: "The grant has not landed on this seat yet. Asking again renews the lease and asks the venue to fund it.",
    unleased: "This seat has no party right now, so there is nothing to credit. Lease one first.",
    trade: "Trade →",
  },
  welcome: {
    eyebrow: "You're funded",
    title: (amount: string, symbol: string) => `${amount} ${symbol} is in your seat`,
    body: "On the house. These are demo credits on a test network, not real money. You're ready to take your first side.",
    cta: "Let's go →",
    close: "Close",
  },
} as const;

/** The reference's `yosuku:open-funds` / `yosuku:credited`, under our name. Anything may open the modal; only a credit fires the welcome. */
export const OPEN_FUNDS_EVENT = "agari:open-funds";
export const CREDITED_EVENT = "agari:credited";
