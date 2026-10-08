/**
 * Who sees what (C-ADD-11): every contract and the parties whose nodes receive it, read from the `signatory` and
 * `observer` lines in `daml/*\/daml/PM/**`, with the rows `daml/pm-tests/daml/Test/Privacy.daml` asserts marked. The
 * source of truth for the words is `docs/business/privacy-matrix.md`; this module is the same table as data, shared by
 * the How It Works summary and the phone (which resolves `@/` to `web/src`). Pure: no I/O.
 */

/** ✓ a stakeholder, receives it · — never receives it · W sees it only as a witness of its own settle, or disclosed for one command · own: only its own. */
export type Seen = "yes" | "no" | "witness" | "own";

export const PARTIES = ["Trader (owner)", "Other trader", "Venue", "Resolver", "Oracle parties", "Auditor", "Outsider"] as const;

export interface MatrixRow {
  contract: string;
  what: string;
  signatory: string;
  observer: string;
  /** One cell per entry of `PARTIES`. */
  seen: readonly [Seen, Seen, Seen, Seen, Seen, Seen, Seen];
  /** Asserted by a Daml Script test in `Test.Privacy`. */
  tested: boolean;
}

export interface MatrixGroup {
  title: string;
  package: string;
  rows: readonly MatrixRow[];
}

export const MATRIX: readonly MatrixGroup[] = [
  {
    title: "Markets and resolution",
    package: "abu-pm-main",
    rows: [
      { contract: "Series", what: "a lane's rules and price policy", signatory: "venue", observer: "resolver, auditor", seen: ["no", "no", "yes", "yes", "no", "yes", "no"], tested: true },
      { contract: "MarketTerms", what: "one Window's terms", signatory: "venue", observer: "resolver", seen: ["witness", "no", "yes", "yes", "no", "no", "no"], tested: true },
      { contract: "PriceQuote", what: "one oracle's signed print", signatory: "that oracle", observer: "venue, resolver", seen: ["no", "no", "yes", "yes", "own", "no", "no"], tested: true },
      { contract: "OpenPrint, Resolution", what: "the opening print and the result", signatory: "resolver and venue", observer: "—", seen: ["witness", "no", "yes", "yes", "no", "no", "no"], tested: true },
      { contract: "EventAttestation", what: "one attestor's event verdict", signatory: "attestor", observer: "venue, resolver", seen: ["no", "no", "yes", "yes", "own", "no", "no"], tested: false },
    ],
  },
  {
    title: "Money and positions",
    package: "abu-pm-main",
    rows: [
      { contract: "Quote, BuyQuote", what: "the venue's firm price to buy or to sell back", signatory: "venue", observer: "the quoted trader", seen: ["yes", "no", "yes", "no", "no", "no", "no"], tested: true },
      { contract: "Leg", what: "the position, both stakes and the fee", signatory: "venue, owner", observer: "—", seen: ["yes", "no", "yes", "no", "no", "no", "no"], tested: true },
      { contract: "VenueCash, VenueAccount", what: "the seat's demo credits", signatory: "venue, owner", observer: "—", seen: ["yes", "no", "yes", "no", "no", "no", "no"], tested: true },
      { contract: "Publication", what: "an opt-in leaderboard entry", signatory: "venue, owner", observer: "—", seen: ["yes", "no", "yes", "no", "no", "no", "no"], tested: true },
      { contract: "LpShare", what: "an Earn share of the reserve", signatory: "venue, provider", observer: "—", seen: ["yes", "no", "yes", "no", "no", "no", "no"], tested: true },
      { contract: "NavStatement", what: "the reserve's totals", signatory: "venue", observer: "auditor", seen: ["no", "no", "yes", "no", "no", "yes", "no"], tested: true },
    ],
  },
];

/** The other packages, where a row is better said in a sentence (`abu-pm-agents`, `abu-pm-tickets`, `abu-pm-games`). */
export const OTHER_PACKAGES: readonly (readonly [string, string])[] = [
  ["AgentGrant", "Signed by the owner and the venue; the agent runner observes the grant but never sees the owner's cash."],
  ["Subscription", "Signed by the venue and the subscriber; a strategy's creator never learns who subscribes."],
  ["DeskMandate, DeskDecision", "Signed by the owner and the venue; the desk's operator sees the mandate it runs and nothing else of the owner's."],
  ["RangeRound, ParlayTicket, BoostPosition", "Two stakeholders, the venue and the owner, like a Leg."],
  ["DuelMatch, DuelResult", "The named exception: the venue and both players sign, so both players see the match."],
];

/** Said before a judge asks: what the ledger's privacy does not cover in this demo. */
export const NOT_HIDDEN: readonly string[] = [
  "The venue sees every trade: it is the counterparty, as a broker is.",
  "The node that hosts the parties can read them. On a shared participant every party sits on one node its operator runs; the demo proves the model, not operational isolation.",
  "One ledger user acts for all the demo's parties on a shared participant, so the ledger cannot enforce which party a seat acts as; the app's code does, taking the party only from the seat's own lease, never from the request.",
  "The synchronizer sees metadata: sizes, timing and which participants are involved, not contents.",
  "The venue's database is the venue's view. Per-seat history routes answer only the seat's own records; others get 403.",
];

export interface RunStep {
  title: string;
  body: string;
  file: string;
  code: string;
  look: string;
}

/** The commands, as `docs/business/privacy-matrix.md` "Run it yourself" gives them. */
export const RUN_IT: readonly RunStep[] = [
  {
    title: "The Daml proof, with no running stack",
    body: "Builds every package and runs the Daml Script tests. Needs dpm on PATH and JAVA_HOME set to OpenJDK 21.",
    file: "daml/",
    code: "cd daml && dpm build --all && (cd pm-tests && dpm test)",
    look: "Test.Privacy:testOutsiderSeesNothing and Test.Privacy:testUserSeesOnlyOwn report ok.",
  },
  {
    title: "The live routes, against a sandbox",
    body: "Drives the real seat routes against a Canton sandbox and a production build of the web app.",
    file: "scripts/drive/seat-routes-it.ts",
    code: "pnpm --filter @owarine/scripts exec tsx drive/seat-routes-it.ts",
    look: "\"seat B's positions are empty\" and \"/api/view?as=outsider is empty and echoes its filtersByParty\" pass.",
  },
  {
    title: "The same request, on a running stack",
    body: "Asks the ledger as the outsider party, exactly as the app's \"Who can see this\" switch does.",
    file: "GET /api/view?as=outsider",
    code: "curl -s 'http://localhost:3150/api/view?as=outsider'",
    look: "rows: [] and the literal filtersByParty body naming the outsider party.",
  },
];

/** The How It Works summary: one line per kind of party, for a reader who will not open the full table. */
export const SUMMARY: readonly (readonly [string, string])[] = [
  ["You", "your quotes, your legs, your credits and your receipts"],
  ["The venue", "every leg, because it is the other side of each one"],
  ["Another trader", "nothing of yours: their query returns only their own"],
  ["Oracle parties and the resolver", "the prints and the result, never a position"],
  ["An outsider", "nothing at all: the ledger returns an empty list"],
];
