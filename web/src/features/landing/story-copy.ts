/**
 * The landing's business story (C10f): the problem, who it is for, why Canton, and where it goes next. Every sentence
 * comes from the B1 drafts in `docs/business/` (`brief.md`, `materials/01`–`06`, `gtm.md`, `metrics.md`) and from
 * STATUS "MainNet and TestNet". No traction figure is written here: the venue's own counts are read live in the band and
 * the proof strip, and the only other numbers are cited outside facts or are labelled as targets.
 */
export const WHO_SEES_WHAT_PATH = "/who-sees-what";

export const LANDING_STORY = {
  why: {
    section: { index: "01", title: "Your position stays yours", desc: "On a public chain a call is published the moment it is placed. Here it is a contract between you and the venue." },
    cards: [
      {
        kicker: "The problem",
        title: "Public positions get copied",
        body: "On a public prediction market the owner, side and size of every position can be read straight away, and an industry sells that read. A trader with an edge pays for the leak, so serious size stays away.",
        facts: [
          { text: "Whale trackers alert on trades of $10,000 or more", source: "Polywhaler", href: "https://polywhaler.com/" },
          { text: "Copy-trading sites rank wallets by P&L and sell the follow", source: "Polycopy", href: "https://polycopy.app/best-polymarket-traders" },
          { text: "A 2026 study of leaderboard wallets found copiers used as exit liquidity", source: "CopyGrade", href: "https://copygrade.com/blog/we-scored-the-polymarket-leaderboard" },
        ],
      },
      {
        kicker: "Who it is for",
        title: "Desks whose size is the signal",
        body: "Traders at small crypto funds, prop desks and market makers who take or hedge short-horizon BTC, ETH and event risk, and for whom being seen is a cost. In production the operator is a licensed dealer: it quotes its clients and holds the other side, as a broker does today.",
        facts: [
          { text: "Not for sports or election betting: those subjects are never listed", source: null, href: null },
          { text: "Not anonymity from the venue: the venue onboards every account and keeps the full record", source: null, href: null },
        ],
      },
      {
        kicker: "Why Canton",
        title: "Private by the ledger, not the screen",
        body: "Every position is a Daml contract signed by two parties, you and the venue, and no other party's node ever receives it. An outsider's ledger query comes back empty, and the app runs that query live. The resolver and the venue sign each result together, so neither can forge it, and a Window resolves or voids exactly once.",
        facts: [
          { text: "Proved in Daml by Test.Privacy.testOutsiderSeesNothing", source: null, href: null },
          { text: "On a transparent chain the same position would be public in a block", source: null, href: null },
        ],
      },
    ],
    matrix: "Who sees what, contract by contract →",
  },
  next: {
    section: { index: "07", title: "From sandbox to MainNet", desc: "What runs today, what comes next, and how the desk reaches its first users." },
    phasesLabel: "Roadmap",
    phases: [
      {
        tag: "Now",
        title: "A local Canton sandbox",
        body: "Five Daml packages, the venue's firm quotes, three oracle parties and a resolver, batch settlement, seats with demo credits, and the web app. Each stage is proven end to end on a local sandbox, with its evidence note in the repository.",
      },
      {
        tag: "Next",
        title: "Canton DevNet",
        body: "The same five packages on a Noders DevNet node, a hosted address anyone can open without help, and the iPhone app on TestFlight.",
      },
      {
        tag: "After the hackathon",
        title: "MainNet",
        body: "Our own validator, which needs the Canton Foundation's approval, a sponsoring Super Validator and an allowlisted address; real collateral through the Canton Coin rail; then a pilot with a licensed operator.",
      },
    ],
    gtmLabel: "Go to market",
    users: [
      ["Small trading desks and prop traders", "Direct outreach, then a demo seat for everyone who replies"],
      ["Canton finance builders", "A critique of the privacy design, and a try"],
      ["Validators and wallets", "A forum post once the hosted demo is live, then a wallet integration"],
    ] as const,
    revenueLabel: "Who pays",
    revenue: [
      ["Traders", "A fee per fill, held in the leg, kept only when the market settles and refunded on a void: about 0.25% of the payout at even odds, falling towards zero at the ends. Plus the quoted spread."],
      ["The operator", "A software licence to run the desk in its own jurisdiction. A hypothesis, tested in interviews."],
    ] as const,
    targetsLabel: "Targets for October",
    targets: ["5 problem interviews with desk traders", "3 timed usability tests on the hosted demo", "A stranger's first call in under 60 seconds, without help"],
    targetsNote: "Targets, not results: the results are added from the interview notes as they happen.",
    pitch: "The full pitch →",
  },
} as const;
