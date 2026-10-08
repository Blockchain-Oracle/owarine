import type { MarketId, OutcomeIdx } from "../types/market";
import type { Address, Signature } from "../types/primitives";
import type { ClaimLeg, VerdictOutcome } from "../types/trading";

/** Where a round's fills came from: the wallet's own orders, or the EventVault trading for it. */
export type LedgerSource = "wallet" | "vault";

/** The venue's four order sides as the indexer names them — YES is UP, NO is DOWN. */
export type LedgerSide = "BUY_YES" | "SELL_YES" | "BUY_NO" | "SELL_NO";

/** One fill seen from the wallet's own seat: the side it was on, the quantity, the YES-terms price. */
export interface LedgerFill {
  marketId: MarketId;
  side: LedgerSide;
  quantityRaw: bigint;
  /** Execution price in YES (UP) terms; a NO leg costs the complement (canon #20). */
  yesPriceRaw: bigint;
  /** The fee paid with a buy when the call filled (`PM.Leg.feePaid`); absent = none. */
  feeBase?: bigint;
  atMs: number;
  txHash: Signature;
}

/** What one held side cost, split the way the ledger splits a leg: backing and the fee escrowed with it. */
export interface SideCost {
  backingBase: bigint;
  feeBase: bigint;
}

/** A complete-set mint or merge through the router — it touches both outcomes at once. */
export interface LedgerSetAction {
  marketId: MarketId;
  kind: "mint" | "merge";
  amountRaw: bigint;
  atMs: number;
  txHash: Signature;
}

/** Everything a wallet did in one Window, replayed in order: what it holds now and what it paid and received. */
export interface MarketLedger {
  marketId: MarketId;
  heldUpRaw: bigint;
  heldDownRaw: bigint;
  /** Collateral paid for everything bought here, fees included, and the complement leg a short creates. */
  costBase: bigint;
  /**
   * What the legs still held on each side cost (`backingShare` and `feePaid`), reduced as the ledger reduces them on a
   * sale (`BuyQuote_Accept`: the sold slice takes the ceiling of each). A void returns exactly this. Absent on ledgers
   * not built by `buildLedgers`.
   */
  held?: { up: SideCost; down: SideCost };
  /** Every fee paid with a buy here; absent = none recorded. */
  feesBase?: bigint;
  /** Collateral received from sells and merges before settlement. */
  proceedsBase: bigint;
  /** Which sides the wallet ever bought — the words on a row that closed out before expiry. */
  sidesTraded: OutcomeIdx[];
  fillCount: number;
  /** Fills that sold beyond inventory — a collateral-backed short, booked as a buy of the complement. */
  shortCount: number;
  firstAtMs: number;
  lastAtMs: number;
  entryTxHash: Signature;
  /** Whose seat the fills sat in: the wallet's own venue orders, or the vault trading for it. */
  source?: LedgerSource;
}

/** `closed` — nothing was held at expiry; the round's whole result was realised on the book. */
export type RoundOutcome = VerdictOutcome | "closed";

/**
 * Whether a settled payout has reached the wallet. `unknown` is a valid state: the live balance
 * could not be read, and guessing "paid" would hide money still waiting to be claimed.
 */
export type ClaimState = "paid" | "to-collect" | "none" | "unknown";

/** The settlement facts a round needs from its market row. */
export interface RoundMarket {
  marketId: MarketId;
  asset: string;
  intervalSec: number;
  expirySec: number;
  decimals: number;
  settled: boolean;
  voided: boolean;
  winningOutcome: OutcomeIdx | null;
  resolvedAtMs: number | null;
}

/** One settled Window for one wallet, with every figure traceable to fills and the settlement rule. */
export interface SettledRound {
  marketId: MarketId;
  asset: string;
  intervalSec: number;
  expirySec: number;
  decimals: number;
  outcome: RoundOutcome;
  /** What was held at expiry, per side, with its payout — a losing leg listed at 0, never dropped. */
  legs: ClaimLeg[];
  sidesTraded: OutcomeIdx[];
  /** Everything paid in. */
  stakeBase: bigint;
  /** Everything taken out on the book before expiry. */
  proceedsBase: bigint;
  /** What settlement pays for the held legs (`PM.Leg.legPayout`): a win's quantity, a void's backing plus fee. */
  payoutBase: bigint;
  /** The fees the venue kept on this round: charged at the fill, returned on a void for the legs still held. */
  feeBase: bigint;
  /** proceeds + payout − stake. */
  pnlBase: bigint;
  feeBps: number;
  claim: ClaimState;
  /** A `paid` round the settler's `redeem_for` paid after the claim grace (D-032), not the wallet's own redeem. */
  paidByCrank?: boolean;
  /** Whose seat the round was traded from; vault rounds link no single transaction. */
  source: LedgerSource;
  settledAtMs: number | null;
  /** Last fill that flattened the position, when it closed on the book rather than at expiry. */
  closedAtMs?: number;
  openedAtMs: number;
  entryTxHash: Signature;
  fillCount: number;
  shortCount: number;
  /** 0.4.0 (K-028/K-030): the ledger's `SettlementReceipt`(s) behind this round, when the projection has them. */
  receipt?: RoundReceipt;
  /** A committee event's question (engine 0.4.0 `EventTerms`): the round reads as the question, its sides as YES/NO. */
  question?: string;
}

/** A ticket's settlement beyond the pair-leg figures (`PM.Publication.ReceiptDetail`). */
export interface ReceiptDetailFacts {
  reserveId: string;
  marketIds: string[];
  /** What the owner picked, as the ledger wrote it: "Inside 100..200", "Up,Down,Up", "Up 2.0x". */
  pick: string;
  stakeBase: bigint;
  toReserveBase: bigint;
  result: string;
}

/** What the ledger recorded when a round's positions settled or were claimed. */
export interface RoundReceipt {
  /** null = a pair leg; "range", "moonshot", "boost", "short", "parlay". */
  product: string | null;
  receiptIds: string[];
  costBase: bigint;
  payoutBase: bigint;
  /** Fee the venue recognised at settlement (a ticket's premium; 0 on a void). */
  feeBase: bigint;
  detail: ReceiptDetailFacts | null;
}

/** A wallet's complete projection: settled rounds newest first, plus what is still open. */
export interface WalletHistory {
  rounds: SettledRound[];
  openCount: number;
  fillCount: number;
  /** False when a paging cap was hit — the figures then cover a prefix of the history and say so. */
  complete: boolean;
  decimals: number;
}

export interface TraderRanking {
  owner: Address;
  pnlBase: bigint;
  /** Net over stake in basis points; null when nothing was staked. */
  roiBps: number | null;
  winRatePct: number;
  /** Rounds closed inside the window — the "calls" a rank is built from. */
  tradeCount: number;
  /** Rounds decided by settlement (win or loss), the streak's domain. */
  settledTrades: number;
  bestStreak: number;
  volumeBase: bigint;
}
