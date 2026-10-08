/** `/legal`: what the product owes its users to say, one short block each (K-003; revamped 8 Oct). */
export interface LegalLink {
  text: string;
  href: string;
}

export interface LegalSection {
  id: string;
  title: string;
  /** The one line shown while the block is closed. */
  gist: string;
  points: readonly string[];
  links?: readonly LegalLink[];
}

export const LEGAL = {
  title: "Legal",
  heading: "Legal",
  sticker: "TEST NETWORK",
  lede: "Owarine runs on Canton DevNet with test funds. Nothing here is money.",
  facts: ["No cash value", "Not financial advice", "Nothing for sale"],
  sections: [
    {
      id: "test-funds",
      title: "Test funds",
      gist: "Credits and test coins are worth nothing.",
      points: [
        "Demo credits and DevNet test funds have no cash value and cannot be withdrawn as money.",
        "DevNet is a test network: it can reset, and balances can go with it.",
        "A Window that cannot settle cleanly voids and refunds every stake.",
      ],
    },
    {
      id: "advice",
      title: "Not advice",
      gist: "Markets, Sensei and agents are for testing.",
      points: [
        "Nothing on Owarine is financial, investment, tax or legal advice.",
        "Sensei's answers and an agent's trades are automated and can be wrong.",
        "Pre-IPO names follow PreStocks' public prices; no share of any company is bought or sold here.",
      ],
    },
    {
      id: "data",
      title: "Your data",
      gist: "A seat key in your browser; the rest stays on the ledger.",
      points: [
        "Your seat's key lives in this browser. Clearing site data or resetting the seat removes it.",
        "Your trades are private to you and the venue on the ledger. A call you choose to publish is public.",
        "Sign in with X keeps your X id and handle in a signed cookie. Owarine reads your profile once and never posts as you.",
        "No ad trackers and no third-party analytics.",
      ],
    },
    {
      id: "regions",
      title: "Regions",
      gist: "Placing a call is held in some regions.",
      points: ["To tell where you are, the server looks up your connection's address in a local IP-to-country table. Nothing about the lookup is stored or sent anywhere."],
      links: [
        { text: "IP Geolocation by DB-IP", href: "https://db-ip.com" },
        { text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" },
      ],
    },
    {
      id: "sources",
      title: "Prices and news",
      gist: "Where the numbers come from.",
      points: [
        "Prints and prices: RedStone, Pyth, Coinbase, Kraken, Bitstamp, Bybit, Alpaca, Jupiter and PreStocks.",
        "Headlines: Finnhub.",
        "A feed can be late or wrong; a Window it cannot settle voids.",
      ],
    },
    {
      id: "credits",
      title: "Credits",
      gist: "Sounds, art, marks and fonts we build on.",
      points: [
        "Sounds: Kenney (CC0).",
        "3D objects: Microsoft Fluent Emoji (MIT).",
        "Company marks: simple-icons (CC0); Canton and Noders marks from their brand kits.",
        "Agent portraits: Notionists by Zoish via DiceBear (CC0).",
        "Fonts: Archivo, Inter, Sora, JetBrains Mono and Noto Serif JP (SIL OFL 1.1); m6x11plus by Daniel Linssen.",
        "Full notices ship in THIRD_PARTY_NOTICES.md with the source.",
      ],
      links: [
        { text: "Kenney", href: "https://kenney.nl" },
        { text: "Fluent Emoji", href: "https://github.com/microsoft/fluentui-emoji" },
        { text: "simple-icons", href: "https://simpleicons.org" },
        { text: "DiceBear", href: "https://www.dicebear.com/styles/notionists/" },
      ],
    },
  ] satisfies readonly LegalSection[],
  contact: { label: "Questions", text: "@owarine_app on X", href: "https://x.com/owarine_app" },
} as const;
