/**
 * The folio's words — every claim on this deck is sourced, and the source is named
 * beside it here so a reviewer can check the sentence against the evidence.
 *
 * Sources: `docs/plan/00-plan.md` §0 (the hackathon, the user, the approved decisions),
 * `context/03-prediction-markets-and-stock-derivatives-landscape.md` §Announcement stats
 * (the 63% / 17% Allium figures on tokenised stock), `docs/evidence/c3-gate-2026-09-29.md`
 * (the Canton sandbox run on the proof and usage slides: 126 Windows resolved, 324 oracle prints,
 * 160 trades, the worker killed and resumed), the three oracle parties (Coinbase, Kraken and Bitstamp
 * candle closes), `docs/plan/decisions.md` D-084 (what is deferred and therefore says NOT LIVE),
 * D-088 (the call before the bell), `git log` (the builder).
 *
 * Identity: the deck names Masayume once, on the engine slide, because that slide is where
 * the lineage belongs — it is the one place in the product that says where this came from.
 */
export const PITCH = {
  brand: "agari",
  builtOn: "Built on Canton",
  prev: "prev",
  next: "next",
  slideLabel: (n: number) => `slide ${n}`,
  mock: "MOCK · ILLUSTRATIVE",
  concept: "CONCEPT",
  conceptNotLive: "CONCEPT · NOT LIVE",

  cover: {
    section: "COVER",
    h1a: "The bell rings.",
    h1b: "The market stays ",
    emph: "open",
    lead: "Call whether a stock closes its Window higher or lower than it opened. From the web, or the app you install from it. It settles on a signed price the ledger checks itself, and only you and the venue can see your position — your seat signs every call.",
    leadStrong: "Running on a Canton test network.",
    pills: ["Canton test network", "Web · PWA", "Built on Canton"],
    glanceTitle: "AT A GLANCE",
    glanceBadge: "CANTON TEST NETWORK",
    rows: {
      betOn: ["You call", "Nine US names, up or down"],
      where: ["Where", "Web · installed PWA"],
      engine: ["Engine", "abu-pm-main · our Daml package"],
      custody: ["Privacy", "Per-party, by the ledger"],
      onboarding: ["Onboarding", "Take a seat · demo credits"],
      builtOn: "Built on",
      chain: "Canton",
    },
  },

  engine: {
    section: "THE ENGINE",
    kicker: "Built from Masayume's source",
    h1a: "We ported the product.",
    h1b: "We wrote the ",
    emph: "engine",
    lead: "Agari is a source-led port of Masayume, this builder's crypto prediction market on another chain: its shell, its ticket, its type and spacing, its words. What is underneath is new. Masayume rented a third party's exchange; here one Daml package is the quotes, the Windows, the signed prints and the settlement — written for this venue, run on a Canton sandbox, and the only thing that decides an outcome.",
    panelTitle: "ABU-PM-MAIN · THE ENGINE",
    panelBadge: "ON A CANTON SANDBOX",
    rows: [
      ["Positions", "UP · DOWN, a leg per call"],
      ["Pricing", "Firm quotes over a price ladder"],
      ["Settlement", "The signed print at the close"],
      ["Who decides", "The resolver, from an oracle quorum"],
      ["Held as", "A contract only you and the venue see"],
      ["Chain", "Canton · no network fee"],
    ] as const,
  },

  gap: {
    section: "THE PROBLEM",
    kicker: "A market that is shut most of the week",
    h1a: "The bell rings and",
    h1b: "everything goes ",
    emph: "dark",
    lead: "US exchanges trade 32.5 hours of the 168 in a week. Tokenised stock does not stop — 63% of its volume trades while those exchanges are closed, and 17% at the weekend. A holder who wants to change exposure at 9pm on a Sunday can only sell, and every venue built on stock hours is a blank screen when they look.",
  },

  edge: {
    section: "OUR EDGE",
    kicker: "Same market, better hours",
    h1a: "The winner wins on",
    emph: "experience",
    lead: "TikTok, WhatsApp, Instagram — all the same category. Experience decides who wins. Agari puts the Window at the front of your screen and keeps it there after the bell: a tap, a call resting for tomorrow's open, a room, a receipt. Private by the ledger, so it is safe to be everywhere.",
    cells: [
      ["One tap", "a stake-first ticket, the real quote for your size"],
      ["After the bell", "the board never empties — rest a call at your price for the open"],
      ["The Room + Sensei", "callers only, gated by a ledger read · a market read on Claude"],
      ["Receipts", "opening print, closing print, oracle parties — clickable"],
    ] as const,
    live: "ALL FOUR LIVE TODAY",
  },

  x: {
    section: "DISTRIBUTION · X",
    kicker: "Next: where the crowd already is",
    h1a: "X is the tape.",
    h1b: "So we'll call ",
    emph: "there",
    lead: "Reply to a market post and the call is placed — that is a stage after this one, not this one. The design is already in the Daml grants: a grant that lets a relay open a position you own and nothing else, capped and revocable, so a bot near your money is safe. No Agari X account exists yet; creating one is the owner's call.",
    pills: ["After the deadline", "Un-drainable by design", "Not live"],
  },

  proof: {
    section: "PROOF",
    kicker: "Why these claims can be trusted",
    h1a: "Every claim is a",
    h1b: "record you can ",
    emph: "open",
    lead: "Prints from three oracle parties, a quorum for every close, a resolver that resolves each Window once, and every leg settled in a batch — each one on a Canton sandbox ledger and written into the evidence with its counts, the failures beside the successes. This week's run: two 1-minute lanes and two 5-minute lanes, the worker killed mid-Window and resumed.",
    rowsTitle: "THIS WEEK · IN THE LEDGER",
    rowsBadge: "CANTON SANDBOX · 29 SEP",
    rows: [
      ["Lanes", "BTC and ETH · 1m and 5m · 4 Series"],
      ["Prints", "324 signed · 3 of 3 on every boundary"],
      ["Trades", "160 accepted · 320 legs settled"],
      ["Recovery", "worker killed · rebuild equals live"],
    ] as const,
    leftLabel: "WINDOWS RESOLVED ON THE SANDBOX",
    leftSub: "each from an oracle quorum, each exactly once · every one listed in docs/evidence",
    rightLabel: "CLAIMS WITHOUT A RECORD",
    rightSub: "failed attempts are logged in the same ledger, next to the ones that worked",
    provenance: "ENGINE · abu-pm-main",
    status: "live health at /status",
  },

  onboard: {
    section: "ONBOARDING",
    kicker: "What it takes to get in today",
    h1a: "A seat and a",
    h1b: "tap to ",
    emph: "start",
    lead: "Take a seat: the browser makes a signing key that cannot leave it, and the venue leases the seat a Canton party with demo credits in it. No wallet app, no extension, no network fee. A card on-ramp and social sign-in are a later stage, and they are labelled that way in the product too, never dressed up as live.",
    cells: [
      ["Seat", "a Canton party · demo credits", "LIVE"],
      ["Key", "made in the browser · cannot leave", "LIVE"],
      ["Card or bank", "on-ramp", "LATER · NOT LIVE"],
    ] as const,
  },

  mobile: {
    section: "MOBILE",
    kicker: "Users live in apps",
    h1a: "Where the users",
    emph: "are",
    lead: "People spend their time in apps, so the web app installs as one: the reel is phone-first, the bottom pill nav is the reference's, and the whole thing runs full-screen from the home screen. Native builds are blocked until native source exists — the ledger says so, and so does the download page.",
    pills: ["Installable PWA", "Phone-first reel", "Native: blocked"],
  },

  agents: {
    section: "AI AGENTS",
    kicker: "The next users are agents",
    h1a: "Sensei can read.",
    h1b: "It can't ",
    emph: "trade",
    lead: "Sensei runs on Claude through the Vercel AI SDK, so the model is a setting rather than a code change. It reads the same live Windows and quotes the page already holds, explains a market in plain words, and says so when there is no edge. It never places a call — you do. Without a key it says exactly which variable would wake it.",
    panelTitle: "SENSEI · WHAT IT MAY DO",
    panelBadge: "LIVE",
    rows: [
      ["Read", "Live Windows + the quotes"],
      ["Explain", "A market read, in plain words"],
      ["Refuse", "No edge → it says so"],
      ["Execute", "Never — you place the call"],
      ["Agents · MCP", "LATER"],
    ] as const,
  },

  demand: {
    section: "REAL USAGE",
    kicker: "Do not trust us, trust the ledger",
    h1a: "Real usage, read live",
    h1b: "from the ",
    emph: "venue",
    reading: "reading the venue…",
    unavailable: "venue unreadable right now",
    wallets: "seats ranked on the venue, last 24h",
    walletsSource: "/api/leaderboard · the venue's projection, replayed",
    calls: "Windows closed on the venue, last 24h",
    callsSource: "same reading · cached three minutes",
    exact: "4",
    exactLabel: "Series on the Canton sandbox — BTC and ETH × two cadences",
    exactSource: "docs/evidence/c3-gate-2026-09-29.md",
    partial: "partial day — the scan hit a paging cap",
    lead: "Counted live from the venue's own projection at /leaderboard, not self-reported. These are the venue's seats, not only ours — Agari reads the whole ledger view and ranks it, so the number is honest about how small a test-network venue this age is.",
  },

  revenue: {
    section: "LONG-TERM REVENUE",
    kicker: "How this could pay, long term",
    h1a: "The fee is ",
    emph: "in the rules",
    modelTitle: "THE MODEL",
    modelRows: [
      ["Rail", "A fee held in each leg"],
      ["Rate", "Per market, read from the ledger"],
      ["Set by", "The venue party"],
      ["Status", "Demo credits only"],
    ] as const,
    seamTitle: "THE SEAM · IN CODE",
    seamBadge: "NO REAL MONEY",
    seamRows: [
      ["Where", "abu-pm-main · the leg"],
      ["Today", "Paid in demo credits"],
      ["Flip", "The Canton Coin rail"],
      ["Creators", "Same seam · later"],
    ] as const,
    lead: "No projection, on purpose. The Daml rules already carry the fee a venue would charge: held in each leg, earned only when the Window settles, and returned with the stake on a void. The rate is read from the ledger and printed on the receipt, so the number a caller was charged is the number the ledger says. Real money waits for the Canton Coin rail; until there is real flow, there is no honest figure to multiply.",
  },

  whyCanton: {
    section: "TECHNICAL · WHY CANTON",
    kicker: "Built on Canton and Daml",
    h1a: "Only possible",
    h1b: "on ",
    emph: "Canton",
    lead: "A call is a private bet: only the caller and the venue should see it, and nobody should pay a fee to place it. On Canton each position is a contract visible to its own party and the venue, Daml choices enforce the rules, an oracle quorum decides the close, and there is no network fee.",
    panelTitle: "THE CANTON STACK · IN CODE",
    panelBadge: "ALL ON THE LEDGER",
    labels: {
      venue: "Venue",
      venueValue: "abu-pm-main",
      settlement: "Settlement",
      settlementValue: "Same package · resolve + settle",
      oracle: "Prints",
      oracleValue: "Three oracle parties · quorum 2",
      tokens: "Privacy",
      tokensValue: "Per party",
      indexer: "Indexer",
      indexerValue: "Projector over the ledger stream",
      gas: "Network fees",
      gasValue: "None on Canton",
    },
  },

  team: {
    section: "THE TEAM",
    kicker: "The team",
    h1a: "Built by a builder",
    h1b: "who ",
    emph: "ships",
    name: "Abubakr Jimoh",
    role: "Founder & full-stack builder",
    body: "The whole Canton port: a Daml package written for this venue, three oracle parties and a resolver, seats that lease a party, the venue's quotes and settlement, a projector over the ledger — and the product itself. Shipped to here.",
  },

  roadmap: {
    section: "ROADMAP",
    kicker: "Path to production",
    h1a: "Now. Next. ",
    emph: "Then",
    now: { tag: "NOW", title: "Canton sandbox, running", body: "The Daml package and its generated client, the ops that list, print, resolve and settle, seats, the stake-first ticket, per-party privacy on every position, Sensei and the Room, and the proof page." },
    next: { tag: "NEXT", title: "The deferred stages", body: "The maker vault, agents and copy-trading, specialist tickets, the X rail and Blinks, and the games — every one a stage the ledger already names and dates." },
    then: { tag: "THEN", title: "Canton DevNet, then real money", body: "The same venue on Canton DevNet, then real collateral through the Canton Coin rail, a licensed halt feed, and price policies that outlive a trial." },
    foot: "EVERY NEXT ITEM IS A STAGE THE LEDGER ALREADY NAMES",
  },

  close: {
    section: "THE ASK",
    kicker: "The ask",
    h1a: "Only you can",
    emph: "cash out",
    lead: "One Daml package is the quotes, the Windows, the prints and the settlement. Agari puts it where people already are — a tap, a reel, a room, a receipt, and a phone that keeps working after the bell. Private throughout, on a Canton test network.",
    ask: "Entered in HackCanton League Season 3, Track 2 (Financial Applications). Verify us live at",
  },
} as const;
