/** Test funds: a bounded devnet SOL treasury for fees and a server-sent tUSDC mint, both behind one free signature (D-034). */
export const FUNDING = {
  pill: {
    title: "Tap to add money.",
    unit: (symbol: string) => symbol,
    plus: "+",
    aria: "Your balance — tap to add money",
  },
  modal: {
    eyebrow: "Add funds · test network",
    title: "Get test funds",
    body: "Canton charges no network fee, so there is nothing to top up first. The venue adds free demo credits to your seat for trading. You can start with an empty seat.",
    sequence: (amount: string, symbol: string) => `No network fee → Add ${amount} ${symbol}`,
    gasPolicy: "No fee top-up: Canton charges no network fee. Demo credits go straight to your seat, at most once per 24 hours while they last.",
    connectFirst: "Take a seat first.",
    account: "Your account",
    copied: "copied ✓",
    request: (_amount: string, _symbol: string) => "Get test funds",
    requesting: "Adding demo credits…",
    done: (amount: string, symbol: string) => `${amount} ${symbol} added to your seat.`,
    trade: "Trade from your seat →",
    close: "Close add funds",
    needMore: "How seats work ↗",
    gasFirst: "Canton charges no network fee, so no outside faucet is needed. Demo credits come only from the venue:",
  },
  /** The Canton grant: demo credits into the seat's party, through the seat's lease (plan §4). No faucet, no fees. */
  seat: {
    title: "Add funds",
    takeSeatFirst: "Funds go to a seat. Take one to start.",
    account: "Seat",
    party: "Party",
    credits: "Test credits",
    tag: "Canton DevNet · no cash value",
    lease: "Lease a party",
    request: "Get test credits",
    requesting: "Asking the venue…",
    /** The phone's funds screen still says this once the grant lands (mobile app/funds.tsx). */
    funded: "Credited. A seat is granted once.",
    unfunded: "Not credited yet. Tap to ask again.",
    unleased: "No party on this seat yet. Lease one first.",
    trade: "Trade",
  },
  /**
   * The Canton Coin path (C7b): real value in and out of the venue through the token standard. The words say what is true
   * now: while the capability is not-live nothing here can be deposited or withdrawn, and the panel says why.
   */
  cc: {
    eyebrow: "Canton Coin",
    title: "Canton Coin",
    notLive: "Not live",
    ready: "Live",
    checking: "Checking",
    checkingHeadline: "Checking Canton Coin availability…",
    unavailable: "Unavailable",
    unavailableHeadline: "Canton Coin availability could not be checked. Trying again shortly.",
    notLiveHeadline: "Canton Coin deposits are not live on this network yet.",
    notLiveBody:
      "The venue is built to hold real Canton Coin against your credits: you send it through the Canton token standard, the venue credits your seat at a fixed, stated rate, and you can take back what you put in. That path has been proved in tests, not on a network with a real wallet, so it stays off until it has.",
    waitingOn: (what: string) => `Waiting on ${what}.`,
    unlisted: "The venue has not listed Canton Coin yet.",
    closed: "The venue is not taking new Canton Coin deposits. You can still take back what you deposited.",
    rate: (perCoin: string, unit: string) => `Fixed rate: 1 Canton Coin = ${perCoin} ${unit}. It does not move while this listing stands.`,
    step: (step: string) => `Amounts are exact, in steps of ${step} Canton Coin. Anything finer is sent back to you, never rounded.`,
    bounds: (min: string, max: string) => `Each deposit is between ${min} and ${max} Canton Coin.`,
    onlyDeposited: "Only Canton Coin you deposited and have not taken back can leave. Winnings stay as credits.",
    allowance: (n: string, unit: string) => `You can take back up to ${n} ${unit} as Canton Coin.`,
    holds: (n: string) => `Your seat holds ${n} Canton Coin.`,
    reserveCovered: (held: string, owed: string, unit: string) => `The venue holds ${held} ${unit} of coin against ${owed} owed. Covered.`,
    reserveShort: (held: string, owed: string, unit: string) => `Not covered: the venue holds ${held} ${unit} of coin against ${owed} owed.`,
    noReserve: "The venue has not published a reserve statement yet.",
    waitingForVenue: "Your withdrawal is with the venue.",
    inFlight: "A transfer to you is waiting for you to accept it.",
    depositLabel: "Deposit Canton Coin",
    depositCta: (amount: string) => `Deposit ${amount}`,
    withdrawLabel: "Take back as Canton Coin (credits)",
    withdrawCta: (_units: string, coin: string) => `Take back ${coin} CC`,
    sending: "Sending…",
    tapCta: (amount: string) => `Get ${amount} test Canton Coin`,
    tapNote: "DevNet coin, no value.",
    rateShort: (perCoin: string, unit: string) => `1 CC = ${perCoin} ${unit}`,
    rules: "How Canton Coin works here",
    tapped: "Minted on DevNet. It shows in your seat in a moment.",
    receiveCta: (amount: string) => `Receive ${amount} Canton Coin`,
    received: "Received. The coin is in your seat.",
    requested: "Sent. The venue answers within a minute or so.",
    failed: "That did not go through. Nothing moved.",
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
export const OPEN_FUNDS_EVENT = "owarine:open-funds";
export const CREDITED_EVENT = "owarine:credited";
