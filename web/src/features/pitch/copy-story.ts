/**
 * The folio's business slides (C10f): the problem, who it is for, and go-to-market. Sources, sentence by sentence:
 * `docs/business/materials/01-value-problem-statement.md` (the leak and its three cited trackers),
 * `materials/02-icp-audience.md` and `icp.md` (user, operator, not-for), `materials/04-gtm.md` and `gtm.md` (first 10
 * users, channels, who pays). No traction is claimed: interviews and usability tests appear only as targets.
 */
export const PITCH_STORY = {
  problem: {
    section: "THE PROBLEM",
    kicker: "Public positions get copied",
    h1a: "Your position is",
    h1b: "public in a ",
    emph: "block",
    lead: "On a public prediction market every position can be read straight away, and an industry sells that read: whale trackers alert on trades of $10,000 or more, and copy-trading sites rank wallets and sell the follow. A trader with an edge pays for the leak, so serious size stays away.",
    sources: "Polywhaler · Polycopy, cited in docs/business/brief.md",
    panelTitle: "WHAT A PUBLIC CHAIN SHOWS",
    panelBadge: "TO EVERYONE",
    rows: [
      ["Owner", "the wallet, and every call it ever made"],
      ["Side", "Up or Down, as placed"],
      ["Size", "exact, in the same block"],
      ["Exit", "when the trader sells, as it happens"],
      ["On Canton", "none of it, to any other party"],
    ] as const,
  },
  icp: {
    section: "WHO IT IS FOR",
    kicker: "Specific users, one specific pain",
    h1a: "For desks whose",
    h1b: "size is the ",
    emph: "signal",
    lead: "Traders at small crypto funds, prop desks and market makers, two to thirty people, who take or hedge short-horizon BTC, ETH and event risk. Today they split orders or stay off public venues to hide size. The trigger is a clear view into a known window that they cannot express at size without being read.",
    cells: [
      ["The user", "a desk trader for whom being seen is a cost"],
      ["The buyer", "a licensed dealer that quotes its clients and holds the other side"],
      ["Not for", "sports or election betting, or anonymity from the venue"],
    ] as const,
    note: "VALIDATION TARGET · 3 OF 5 INTERVIEWED TRADERS SAY VISIBILITY CHANGED HOW THEY SIZE",
  },
  gtm: {
    section: "GO TO MARKET",
    kicker: "Desks first, then Canton-native routes",
    h1a: "The first ten",
    h1b: "users, by ",
    emph: "name",
    lead: "We compare ourselves to an OTC desk, not to a betting site. Desks get a personal message and then a demo seat; Canton finance builders are asked to critique the privacy design; validators and wallets hear from a forum post once the hosted demo is live. After the hackathon: the AppsFactory accelerator, a wallet integration, and Featured App status once a MainNet node shows activity a reviewer can verify.",
    panelTitle: "FIRST 10 USERS",
    panelBadge: "OUTREACH DRAFTED",
    rows: [
      ["1–5", "desk and prop traders"],
      ["6–8", "Canton finance builders"],
      ["9–10", "validators and wallets"],
    ] as const,
    channelsTitle: "CHANNELS, IN ORDER",
    channels: [
      ["Direct", "15 messages, drafted"],
      ["Community", "HackCanton Telegram"],
      ["Forum", "the privacy matrix"],
      ["Later", "accelerator · Featured App"],
    ] as const,
  },
} as const;
