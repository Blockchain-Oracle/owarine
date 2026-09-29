/**
 * The seat modals' words. The frame and every key are RainbowKit 2.2.11's `en_US` strings as Masayume showed them; on
 * Canton the connected account is a guest seat (plan §2, §4), so the sentences say "seat" where they said "wallet".
 * The keys stay, because the phone's sheets read the same object.
 */
export const WALLET_MODAL = {
  title: "Take a Seat",
  close: "Close",
  back: "Back",
  groups: { installed: "Canton DevNet", browser: "More ways in" },
  recent: "Recent",
  newTo: "New to Canton seats?",
  learnMore: "Learn More",
  learnMoreUrl: "https://docs.digitalasset.com/overview/3.4/explanations/canton/parties-users.html",
  intro: {
    title: "What is a Seat?",
    description:
      "A seat is your place at the venue. This browser makes a signing key for it, and the venue gives it a Canton party to trade as. No extension, no seed phrase, no account to create.",
    assetsTitle: "Your Own Party on Canton",
    assetsBody: "Your calls, cash and positions are contracts only your seat's party and the venue can see.",
    loginTitle: "A Key That Stays Here",
    loginBody: "The key is made in this browser and cannot be exported. Reset the seat and it is gone for good.",
    get: "Take a Seat",
  },
  get: {
    title: "Take a Seat",
    action: "TAKE",
    lookingTitle: "Not what you're looking for?",
    lookingBody: "A Canton wallet connector joins the guest seat here once it is live.",
  },
  status: {
    opening: (wallet: string) => `Taking a ${wallet.toLowerCase()}...`,
    notInstalled: (wallet: string) => `${wallet} is not available here`,
    confirm: "Making this browser's seat key",
    retry: "RETRY",
    install: "LEARN MORE",
    loading: "Loading",
  },
  profile: { copy: "Copy Address", copied: "Copied!", disconnect: "Reset Seat" },
  seat: {
    party: "Canton party",
    leaseNotLive: "Not leased yet: the venue's seat lease is not live (C1 stub)",
  },
} as const;

export interface KnownWallet {
  /** The connector's name, which is how an available one is recognised. */
  name: string;
  icon: string;
  /** What the connector offers (RainbowKit's `get.*.description`). */
  kind: string;
  href: string;
}

/**
 * Connectors offered when not available here, in RainbowKit's "Browser" group and on the Get step. Empty until the
 * Grofty connector lands (plan §F); the guest seat needs nothing installed.
 */
export const KNOWN_WALLETS: readonly KnownWallet[] = [];

/** The guest seat, the one connector live today. */
export const SEAT_CONNECTOR = { id: "guest-seat", name: "Guest Seat", icon: "/wallet/seat.svg" } as const;
