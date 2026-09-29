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
    resetWarning: "Resetting forgets this seat's key. Its calls and credits stay with the old seat, and this phone cannot get them back.",
    /** The lease is the server's half (a ledger party for this key); it opens with the Canton adapter. */
    leaseNotLive: "The key is on this phone. Seats join the ledger when trading opens; until then nothing is placed.",
  },
  menu: { seat: "Your seat" },
  /** Where the reference's tap-trading chip sat: the seat itself signs every call, so there is nothing to arm. */
  fast: { label: "one tap", why: "a seat already trades in one tap" },
  failed: (reason: string) => `This phone could not make a seat key: ${reason}`,
} as const;
