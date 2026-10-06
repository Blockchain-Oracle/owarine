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
 * C10f re-points the deck at the B1 business story (`docs/business/materials/01`–`06`, `gtm.md`, `metrics.md`):
 * the problem, who it is for, the answer, go-to-market and who pays live in `copy-story.ts`; this file keeps the
 * reference's slides with every status word checked against `docs/plan/capabilities.json` (nothing says LIVE until a
 * DevNet acceptance row exists) and the roadmap ending at MainNet, the post-hackathon step (STATUS "MainNet and TestNet").
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
    h1a: "Call the move.",
    h1b: "Keep it ",
    emph: "private",
    lead: "A private event-risk desk on Canton. The venue quotes a firm price, your seat accepts it, and the position is a Daml contract only you and the venue can see. Three oracle parties sign the close, a separate resolver decides it, and the venue pays you without a signature.",
    leadStrong: "Proven end to end on a local Canton sandbox.",
    pills: ["Private by the ledger", "Web · PWA", "Built on Canton"],
    glanceTitle: "AT A GLANCE",
    glanceBadge: "CANTON TEST NETWORK",
    rows: {
      betOn: ["You call", "Stocks, BTC, ETH, events · up or down"],
      where: ["Where", "Web · installed PWA"],
      engine: ["Engine", "abu-pm-main · our Daml package"],
      custody: ["Privacy", "Two stakeholders per position"],
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
    lead: "Agari is a source-led port of Masayume, this builder's crypto prediction market on another chain: its shell, its ticket, its type and spacing, its words. Agari itself first shipped on another chain as well: prior work, disclosed at the tag hackcanton-s3-start. What is underneath is new and was written in the delivery window: five Daml packages for the quotes, the legs, the signed prints, resolution and settlement, a JSON Ledger API client, and the venue's operations. The Daml is the only thing that decides an outcome.",
    panelTitle: "ABU-PM-MAIN · THE ENGINE",
    panelBadge: "ON A CANTON SANDBOX",
    rows: [
      ["Positions", "UP · DOWN, a leg per call"],
      ["Pricing", "Firm quotes over a price ladder"],
      ["Settlement", "The signed print at the close"],
      ["Who decides", "The resolver, from an oracle quorum"],
      ["Held as", "A contract only you and the venue see"],
      ["Ledger", "Canton · no network fee"],
    ] as const,
  },

  edge: {
    section: "OUR ANSWER",
    kicker: "Not a betting site made private",
    h1a: "A private",
    emph: "event-risk desk",
    lead: "An OTC desk for event windows. The venue is the counterparty, as a dealer is: it quotes both sides, holds its side of every leg, and settles in a batch. The trader gets a firm price, a position nobody else can see or copy, an exit before the close, and a result anyone at the table can re-derive.",
    cells: [
      ["Firm quote", "the venue's price for your exact size, held while you take it"],
      ["Private leg", "a Daml contract only you and the venue sign and see"],
      ["Sell back", "a firm bid from the venue before the close"],
      ["Re-derivable close", "three oracle parties, a quorum of two, a separate resolver"],
    ] as const,
    live: "ALL FOUR RUN END TO END ON A LOCAL SANDBOX",
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
    lead: "Prints from three oracle parties, a quorum for every close, a resolver that resolves each Window once, and every leg settled in a batch — each one on a Canton sandbox ledger and written into the evidence with its counts, the failures beside the successes. The run below is our own drivers on a local sandbox, not users: two 1-minute lanes and two 5-minute lanes, the worker killed mid-Window and resumed.",
    rowsTitle: "A TEST RUN · OUR OWN DRIVERS",
    rowsBadge: "CANTON SANDBOX · 29 SEP",
    rows: [
      ["Lanes", "BTC and ETH · 1m and 5m · 4 Series"],
      ["Prints", "324 signed · 3 of 3 on every boundary"],
      ["Trades", "160 accepted · 320 legs settled"],
      ["Recovery", "worker killed · rebuild equals live"],
    ] as const,
    leftLabel: "WINDOWS RESOLVED ON THE SANDBOX",
    leftSub: "each from an oracle quorum, each exactly once · a driver run, listed in docs/evidence/c3-gate-2026-09-29.md",
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
      ["Seat", "a Canton party · demo credits", "LOCAL SANDBOX"],
      ["Key", "made in the browser · cannot leave", "LOCAL SANDBOX"],
      ["Card or bank", "on-ramp", "LATER · NOT LIVE"],
    ] as const,
  },

  mobile: {
    section: "MOBILE",
    kicker: "Users live in apps",
    h1a: "Where the users",
    emph: "are",
    lead: "People spend their time in apps, so the web app installs as one: the reel is phone-first, the bottom pill nav is the reference's, and it runs full-screen from the home screen. The native iPhone app is ported to Canton too: it typechecks and builds, and it goes to TestFlight once its App Store Connect record exists. The download page says which.",
    pills: ["Installable PWA", "iPhone app ported", "TestFlight: next"],
  },

  agents: {
    section: "AI AGENTS",
    kicker: "The next users are agents",
    h1a: "Sensei can read.",
    h1b: "Agents act in a ",
    emph: "grant",
    lead: "Sensei runs on a model through the Vercel AI SDK, so the model is a setting rather than a code change. It reads the same Windows and quotes the page already holds, explains a market in plain words, and says so when there is no edge; without a key it says which variable would wake it. It never places a call. An agent can, but only through a capped, revocable Daml grant the owner signs, and the agent never sees the owner's cash.",
    panelTitle: "SENSEI AND AGENTS · WHAT THEY MAY DO",
    panelBadge: "LOCAL SANDBOX",
    rows: [
      ["Read", "Live Windows + the quotes"],
      ["Explain", "A market read, in plain words"],
      ["Refuse", "No edge → it says so"],
      ["Sensei executes", "Never — you place the call"],
      ["An agent executes", "In a capped grant"],
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
    exact: "5",
    exactLabel: "problem interviews with desk traders — a target for October, not a result",
    exactSource: "docs/business/metrics.md · results only from interview notes",
    partial: "partial day — the scan hit a paging cap",
    lead: "Counted live from the venue's own projection at /leaderboard, not self-reported. These are the venue's seats, not only ours — Agari reads the whole ledger view and ranks it, so the number is honest about how small a test-network venue this age is. The third figure is a target and says so.",
  },

  revenue: {
    section: "LONG-TERM REVENUE",
    kicker: "How this could pay, long term",
    h1a: "The fee is ",
    emph: "in the rules",
    modelTitle: "THE MODEL",
    modelRows: [
      ["Fee", "Held in each leg, per fill"],
      ["Rate", "≈ 0.25% of the payout at even odds"],
      ["Kept", "Only at a settle; refunded on a void"],
      ["Plus", "The quoted spread"],
    ] as const,
    seamTitle: "THE SEAM · IN CODE",
    seamBadge: "NO REAL MONEY",
    seamRows: [
      ["Traders", "Fee per fill + the spread"],
      ["Operator", "Licence · a hypothesis"],
      ["Today", "Paid in demo credits"],
      ["Real money", "Canton Coin rail, MainNet"],
    ] as const,
    lead: "No projection, on purpose. The Daml rules already carry the fee a venue would charge: held in each leg, earned only when the Window settles, and returned with the stake on a void. The default rate is 100 bps on t × (1 − t), so it is largest at even odds and falls to zero at the ends. The rate is read from the ledger and printed on the receipt, so the number a caller was charged is the number the ledger says. Real money waits for the Canton Coin rail; until there is real flow, there is no honest figure to multiply.",
  },

  whyCanton: {
    section: "TECHNICAL · WHY CANTON",
    kicker: "Built on Canton and Daml",
    h1a: "Only possible",
    h1b: "on ",
    emph: "Canton",
    lead: "A position must be seen by its owner and the venue and by nobody else. On Canton each Leg is a contract with exactly those two signatories, so no other party's node ever receives it — an outsider's query comes back empty, and the app shows that query live. Daml choices enforce the money rules, an oracle quorum decides the close, and there is no network fee. On a transparent chain the same position would be public in a block.",
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
      tokensValue: "Two signatories per Leg",
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
    now: { tag: "NOW", title: "A local Canton sandbox", body: "Five Daml packages and their generated client, the ops that list, print, resolve and settle, seats, the ticket, the exit, specialist tickets, agents on grants, the desk, the games and the proof page — each proven end to end on a local sandbox, with its evidence note." },
    next: { tag: "NEXT", title: "Canton DevNet", body: "The same five packages on a Noders DevNet node, a hosted address anyone can open without help, the iPhone app on TestFlight, and the first interviews and usability tests." },
    then: { tag: "AFTER THE HACKATHON", title: "MainNet", body: "Our own validator, which needs the Canton Foundation's approval, a sponsoring Super Validator and an allowlisted address; real collateral through the Canton Coin rail; then a pilot with a licensed operator." },
    foot: "MAINNET IS THE POST-HACKATHON STEP",
  },

  close: {
    section: "THE ASK",
    kicker: "The ask",
    h1a: "Nobody else can",
    emph: "see it",
    lead: "A desk whose positions nobody else can read, with prices anyone at the table can re-derive. The Daml is the quotes, the legs, the prints and the settlement; the venue pays without the trader signing; and every claim in this deck has its evidence note in the repository.",
    ask: "Entered in HackCanton League Season 3, Track 2 (Financial Applications). Verify us live at",
  },
} as const;
