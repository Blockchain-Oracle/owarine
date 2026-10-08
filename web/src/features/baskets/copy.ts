/**
 * `/baskets` (S19, D-124): five baskets, each a small group of PreStocks companies bet on together. Plain words
 * throughout: "points", never dollars, for an index. Predict, or let a desk trade it (Automate); since 8 Oct there is no
 * "cover what you hold": a seat holds no stocks.
 */
export const BASKETS_COPY = {
  title: "Baskets",
  headingJp: "束ねて賭ける。",
  intro: "A basket is a small group of companies bet on together. Each one is scored as an index that started at 1,000 points, read from PreStocks in one go, and its Window runs around the clock.",
  eyebrow: "PRE-IPO · 24/7",
  alwaysOpen: "Trading 24/7",
  card: {
    members: (names: string) => `${names}, weighted equally`,
    count: (n: number) => `${n} companies · equal weight`,
    loading: "Reading",
    week: (pct: string) => `${pct} this week`,
    weekNone: "Week not charted yet",
    noQuotes: "No quotes yet",
    index: "Index",
    noIndex: "—",
    moved: (rangePct: string, window: string) => `${rangePct} range · last ${window}`,
    quiet: "Not enough reads yet to say how it moved",
    window: (cadence: string) => `Live · ${cadence}`,
    noWindow: "No Window trading right now",
    up: "Up",
    down: "Down",
    unquoted: "—",
    predict: "Predict",
    automate: "Automate",
    automateWhy: "A desk trades this basket for you, inside your limits",
    aria: (name: string) => `${name} basket`,
  },
  foot: "Predict uses demo credits on the Canton test network. Automate runs a practice desk; the live desk is planned. Not investment advice.",
  dev: {
    title: "Baskets",
    intro: "The composed mark at three sizes, a basket Window card trading and paused, the hero question in points, the source note for a basket and a pre-IPO name, the hub, and the /baskets card with and without a Window.",
    marks: "Composed mark — 16, 48 and 56 px discs (news, hub, card)",
    trading: "Basket Window — trading, quoted 54 / 48",
    paused: "Basket Window — paused, no signed source",
    hero: "Hero question — the line and the distance in points",
    source: "Source notes — a basket, then OPENAI-60m (no longer the Switchboard line)",
    hub: "Hub — the basket's Window and its members",
    indexCard: "/baskets card — a Window trading",
    indexCardNone: "/baskets card — no Window, no seat",
  },
} as const;
