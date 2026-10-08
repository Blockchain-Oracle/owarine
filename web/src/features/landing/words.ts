/**
 * The landing's words (revamp step 3). Every claim is something the product does today on the Canton test network; the
 * roadmap says what is next and labels it so. Numbers on the page are read live (prices, settled Windows, the print mix),
 * never written here.
 */
export const WORDS = {
  nav: { markets: "Markets", how: "How it works", docs: "Docs", start: "Start trading" },
  hero: {
    kicker: "Private prediction markets on",
    title: ["Call the close.", "Nobody sees", "your bets."],
    line: "Up or down in minutes. Close in one tap.",
    assets: ["BTC", "ETH", "TSLA", "NVDA", "OPENAI", "SPACEX", "CC"],
    start: "Start trading",
    demo: "Try it with demo credits",
    stickers: { private: "Private", oracles: "3 oracles sign it" },
  },
  phone: {
    demo: "DEMO",
    tapUp: "UP",
    tapDown: "DOWN",
    close: "CLOSE",
    opened: (side: string, sym: string) => `${side} ${sym} opened`,
    closed: "Closed",
    waiting: "Next Window opens soon",
    open: "Open the live screen",
  },
  tape: { label: "Live now", next: "next Window" },
  loop: {
    kicker: "How it works",
    title: "Tap. Watch. Bank it.",
    steps: [
      {
        n: "01",
        title: "Call it",
        body: "UP if it closes above where the Window opened, DOWN if below. Firm price, on the spot.",
      },
      {
        n: "02",
        title: "Watch it breathe",
        body: "Your PnL rides the price line, tick by tick: exactly what closing pays right now.",
      },
      {
        n: "03",
        title: "Bank it, or let it ride",
        body: "One tap pays you out. Or hold: three oracles sign the close and it settles once.",
      },
    ],
  },
  private: {
    kicker: "Private by the ledger",
    title: "Your bet is between you and the venue.",
    body: "On public prediction markets, whale trackers and copy-traders read every position. On Canton yours is a contract between you and the venue. No one else's node ever gets it.",
    who: ["You", "The venue", "Everyone else"],
    rows: [
      { what: "Your position", sees: [true, true, false] },
      { what: "Side and size", sees: [true, true, false] },
      { what: "Your PnL", sees: [true, true, false] },
      { what: "The closing print", sees: [true, true, true] },
    ],
    proved: "An outsider's ledger query comes back empty. The app runs it live.",
    matrix: "How privacy works",
    mask: { title: "Privacy mode", body: "One tap swaps every balance for a sticker.", tap: "Tap to hide" },
  },
  markets: {
    kicker: "Everything on one screen",
    title: "Crypto, stocks, pre-IPO. Same two buttons.",
    cards: {
      crypto: { title: "Crypto", body: "24/7, every two and five minutes." },
      stocks: { title: "Stocks", body: "Fifteen-minute Windows through the NYSE session." },
      preipo: { title: "Pre-IPO", body: "Private companies and baskets, hourly, 24/7." },
      parlay: { title: "Parlays", body: "Two or three markets on one ticket. The odds multiply." },
      cc: { title: "Fund with Canton Coin", body: "Bring CC to your seat and take it back out." },
    },
    open: (n: number) => `${n} Window${n === 1 ? "" : "s"} open`,
  },
  more: {
    kicker: "Not only trading",
    cards: {
      games: { title: "Games", body: "Duels, Lucky, Line Rider. Same prices, same settlement.", href: "/games" },
      automate: { title: "Automate", body: "A desk trades a basket inside limits you set, and explains every move.", href: "/agents" },
      earn: { title: "Earn", body: "Back the reserves and share what they make.", href: "/earn" },
    },
  },
  proof: {
    kicker: "Settled in public, held in private",
    title: "Every close is signed.",
    body: "Three oracle parties sign every closing print. Positions stay private; prints and results are public.",
    sources: "Where the prints come from",
    settled: "Just settled",
    reading: "Reading the index…",
    none: "No settled Window indexed yet. The first lands at the next close.",
    outcome: { up: "Up won", down: "Down won", void: "Voided" },
    proof: "Print proof",
    windows: "Windows settled",
  },
  roadmap: {
    kicker: "Where it is",
    phases: [
      { tag: "Live now", title: "Canton DevNet", body: "Five Daml packages on a Noders node: quotes, oracles, seats, parlays and the Canton Coin rail." },
      { tag: "Next", title: "A hosted address and the phone app", body: "A public address anyone can open, and the phone apps." },
      { tag: "After", title: "MainNet", body: "Our own validator, real collateral in Canton Coin, then a licensed operator." },
    ],
    pitch: "Read the pitch",
  },
  final: { title: ["Call", "the close."], start: "Start trading", install: "Or add it to your home screen: no store, one tap away." },
  foot: {
    pages: [
      { label: "Trade", href: "/trade" },
      { label: "Markets", href: "/markets" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Proof", href: "/proof" },
      { label: "Pitch", href: "/pitch" },
      { label: "Get the app", href: "/download" },
    ],
    built: "Built on",
    line: "Owarine 終値 means closing price.",
  },
} as const;
