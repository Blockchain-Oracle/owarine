/**
 * /how-it-works — the words. The page is Masayume's, section for section; every protocol fact under those headings
 * is Agari's (`anchor/programs/agari-events`, `services/ops/config/price-sources.json`), and two sections Masayume's
 * 24/7 venue had no use for — sessions and lanes, halts and voids — are added in its own grammar (D-081, D-093).
 */
export const HOW_IT_WORKS = {
  title: "How It Works",
  lead: "Call where a price closes its Window, at the venue's firm quote, in a position only you and the venue can see. Settled on a price three oracle parties sign, on the Canton ledger.",
  back: "Back to Markets",
  sections: {
    steps: "Getting Started",
    example: "Payout Example",
    sessions: "Sessions & Lanes",
    mechanics: "Key Mechanics",
    leg: "The Leg and Who Sees It",
    builtOn: "Built On",
    pricing: "How a Price Is Made",
    fees: "Fee Structure",
    settlement: "Settlement Process",
    asides: "Halts, Voids & Your Money",
    architecture: "Ledger Architecture",
    baskets: "Baskets",
    desk: "How the Desk Decides",
    faq: "FAQ",
  },
  /** S21 (D-126): the desk is the one place real money moves, so the page says how it decides, step by step. */
  deskLead:
    "A desk holds a basket for you while an assistant looks after it. You decide what to own and sign every owner call with your seat; the desk decides only when; on Canton the money limits are planned as Daml choices that refuse anything past them. Practice desks run today as paper ledgers. Here is the order it works in, and which step is the one question a model answers.",
  deskKinds: {
    arithmetic: "Arithmetic",
    ai: "The one AI question",
    program: "The rules on the ledger",
  } as const,
  deskEnforcesTitle: "What the rules enforce",
  deskNeverTitle: "What the desk never does",
  deskNetwork: "Practice moves no money. A live desk is planned: it will trade this venue's own markets once the Canton Coin rail lands.",
  /** The lead of the Owarine-only section: stocks have a clock, and the clock is the product. */
  sessionsLead:
    "A stock exchange keeps hours, so the venue does too. Windows are listed in three lanes on the NYSE clock, and which lanes are on the board right now depends on the hour you are reading this.",
  sessionWordsTitle: "What the clock says",
  sessionWordsBody:
    "The session chip, the marquee and every card say the same word about the hour, with a countdown to the boundary that matters. Nothing is ever just “closed”.",
  /** Doc 05 §No fake-data: an editorial example is labelled as one, never shown as a live quote. */
  exampleTag: "Worked example — not a live quote",
  example: {
    up: "UP price",
    down: "DOWN price",
    max: "Max payout / contract",
    buy: "You buy",
    contracts: "100 UP @ 64¢ each",
    outcome: "TSLA closes at or above the line",
    get: "You get",
    payout: "100 credits",
    profit: "(+36 credits, less the fee paid with the fill)",
  },
  formula: {
    identity: "price(DOWN) = 1 − price(UP)",
    cost: "cost = contracts × price",
    payout: "payout if right = contracts × 1.00",
  },
  cta: {
    title: "Ready to predict?",
    body: "Get demo credits, pick a side, and see if you can beat the venue.",
    action: "Go to Markets",
  },
} as const;
