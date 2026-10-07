/**
 * The Canton Coin path as the screens see it (C7b): one capability constant and the pure words for what the rail does.
 * No I/O, no bigint on the wire (amounts here are decimal strings the screens format), no Decimal maths: the exact
 * conversion lives in `@owarine/ledger` `units.ts` and in `daml/abu-pm-cc`.
 */

/**
 * Whether the Canton Coin path may be offered as working. It lives in code, not in an environment variable, so a
 * deployment cannot flip it by accident. `live` since 7 Oct 2026: a real deposit, withdrawal and receive ran on Noders
 * DevNet with real DevNet coin (`docs/evidence/c7b-canton-coin.md`, "DevNet run, 2026-10-07"; C-DAML-06 and its
 * acceptance rows). A deployment without a listing or a registry still offers nothing: the panel says what is missing.
 */
export type CcRailCapability = "not-live" | "live";
export const CC_RAIL_CAPABILITY: CcRailCapability = "live";

/** What the path is waiting on, in the words the screens use. */
export const CC_RAIL_WAITING_ON = "a DevNet run of the token-standard transfer with a real wallet";

/** The rail's state of one withdrawal, as the screens name it. */
export type CcWithdrawalState = "sent" | "completed" | "refunded";

/** What the server reads about a seat's Canton Coin path. Amounts are integers as decimal strings. */
export interface CcRailView {
  capability: CcRailCapability;
  /** Why the path is not usable right now, in words; null when it is. */
  reason: string | null;
  listing: CcListingView | null;
  /** Cash units the venue owes this seat back in coin: what was deposited and not yet taken back. */
  allowanceUnits: string;
  /** The seat's cash, in units. */
  cashUnits: string;
  /** Token-standard holdings the seat owns, per instrument, in atomic units of 10^-10. */
  holdings: CcHoldingTotal[];
  deposits: { units: string; receivedAtomic: string; settledAtSec: number; ref: string }[];
  withdrawals: { units: string; sentAtomic: string; state: CcWithdrawalState; openedAtSec: number; ref: string }[];
  /** Withdrawals asked for and not yet answered by the venue. */
  proposals: { units: string; ref: string }[];
  /** The venue's latest reserve statement, when it has published one. */
  reserve: { covered: boolean; asOfSec: number; heldUnits: string; liabilityUnits: string } | null;
  /**
   * DevNet only (revamp 2b): the test coin one tap gives this seat (a Decimal string), or null when this deployment has no
   * faucet or the seat already holds the faucet's cap. DevNet coin has no value; the tap is how a visitor gets coin to deposit.
   */
  faucetCoin: string | null;
}

export interface CcListingView {
  listingId: string;
  instrumentAdmin: string;
  instrumentId: string;
  /** Cash base units per one whole coin, fixed for the life of the listing. */
  unitsPerCoin: string;
  minDepositUnits: string;
  maxDepositUnits: string;
  depositsOpen: boolean;
}

export interface CcHoldingTotal {
  instrumentAdmin: string;
  instrumentId: string;
  unlockedAtomic: string;
  lockedAtomic: string;
}
