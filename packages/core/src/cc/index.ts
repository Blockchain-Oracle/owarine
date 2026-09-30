/**
 * The Canton Coin path as the screens see it (C7b): one capability constant and the pure words for what the rail does.
 * No I/O, no bigint on the wire (amounts here are decimal strings the screens format), no Decimal maths: the exact
 * conversion lives in `@agari/ledger` `units.ts` and in `daml/abu-pm-cc`.
 */

/**
 * Whether the Canton Coin path may be offered as working. It is `not-live` in code, not in an environment variable, so a
 * deployment cannot flip it by accident: the day DevNet proves a real deposit and a real withdrawal with a real wallet
 * (`docs/evidence/c7b-canton-coin.md`, "What waits for DevNet"), a commit changes this line together with the capability
 * registry (`docs/plan/capabilities.json` C-DAML-06) and the acceptance row. Until then every screen shows the path as
 * not live and every write refuses.
 */
export type CcRailCapability = "not-live" | "live";
export const CC_RAIL_CAPABILITY: CcRailCapability = "not-live";

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
