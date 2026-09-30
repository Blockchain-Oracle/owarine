/**
 * The seat's words on the phone: the first-run demo-credits page, the Take a seat sheet and the account sheet say the
 * same thing in the same plain tone (plan, review hygiene: "demo credits, no cash value, test network"; no purchase
 * path of any kind).
 */
export const SEAT = {
  terms: {
    eyebrow: "Test network · demo credits only",
    title: "Start with demo",
    accent: "credits.",
    body:
      "This app runs on a Canton test network. Your seat trades with demo credits: they have no cash value, and nothing here can be bought, sold or withdrawn. Taking a seat keeps a key on this phone that signs your calls.",
    accept: "Accept and take a seat",
    browse: "Look around first",
  },
  sheet: {
    title: "Take a seat",
    lines: [
      "A seat is your account here. Its key is made on this phone and never leaves it.",
      "Demo credits only: no cash value, nothing to buy, sell or withdraw.",
      "A test network: anything can be reset.",
    ],
    taking: "Taking a seat…",
  },
  account: {
    copy: "Copy seat ID",
    copied: "Copied!",
    reset: "Reset seat",
    resetConfirm: "Reset for good",
    resetCancel: "Keep this seat",
    resetWarning: "Resetting forgets this seat's key, and this phone cannot get it back. A seat this phone took is closed: calls on Windows still trading are closed out at what you paid, fee included, and its credits go back to the venue. A seat joined from another device stays there.",
    /** The lease is the server's half: a ledger party for this key, leased over a signed request. */
    party: "Canton party",
    leaseReading: "Reading this seat's lease…",
    leasePoolFull: "Every seat is taken. This phone is in line and takes the next free one by itself.",
    leaseNotLive: "The key is on this phone. This network is not taking seats right now, so nothing can be placed.",
    leaseRefused: "The venue did not lease a party to this seat. Reset the seat or try again later.",
    leaseNone: "No party is leased to this seat right now, so it cannot trade. Leasing one takes a second.",
    lease: "Lease a party",
    leasing: "Leasing…",
  },
  menu: { seat: "Your seat" },
  /** The seat link screen's phone-only lines; the card's own words are web's (`SEAT.link` in canton-ux/seat/copy). */
  link: {
    screen: "Seat link",
    entry: "Use on another device",
    haveSeat: "Have a seat on the web? Link this phone",
    termsFirst: "Accept the demo-credits terms first: a linked phone trades the same demo credits.",
    termsLine: "Joining uses demo credits only: no cash value, nothing to buy, sell or withdraw.",
    accept: "Accept and continue",
    joinedDevice: "Your other device",
  },
  /** The funds sheet: the demo-credits grant, through a signed route once it is live; no faucet, no network fees. */
  funds: {
    eyebrow: "Demo credits · test network",
    title: "Demo credits",
    body: "A seat trades with demo credits on a Canton test network. They have no cash value, and nothing here can be bought, sold or withdrawn.",
    takeSeatFirst: "Take a seat first: demo credits go to a seat.",
    account: "Seat",
    copied: "Copied!",
    credits: "Demo credits",
    cashValue: "Cash value",
    none: "None",
    request: "Get demo credits",
  },
  /** Where the reference's tap-trading chip sat: the seat itself signs every call, so there is nothing to arm. */
  fast: { label: "one tap", why: "a seat already trades in one tap" },
  failed: (reason: string) => `This phone could not make a seat key: ${reason}`,
} as const;
