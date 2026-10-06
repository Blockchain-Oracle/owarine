import type { MarketId, OnchainSnapshot, OutcomeIdx } from "../types/market";
import type { ClaimLeg, Holdings, Verdict, VerdictOutcome } from "../types/trading";
import { apportionBase, winPayoutBase } from "./payout";

/** What each held side's legs cost their owner, backing plus fee (`PM.Leg`): exactly what a void returns. */
export interface PaidBySide {
  up: bigint;
  down: bigint;
}

export interface VerdictInput {
  marketId: MarketId;
  /** Head-fresh settlement state; the indexer's status lags the chain (canon #1). */
  settlement: Pick<OnchainSnapshot, "isResolved" | "isVoided" | "winningOutcome">;
  holdings: Holdings;
  feeBps: number;
  decimals: number;
  /** null when no entry cost is on record for this wallet. Backing plus the fee paid at the fill. */
  costBasisBase: bigint | null;
  /**
   * The ledger's own figure per side for a void (a claimable leg's payout, or a settlement receipt's): what each side's
   * legs cost. Omitted or null, a void apportions `costBasisBase` by size, which is exact when one side was held.
   */
  paidBySide?: PaidBySide | null;
  settledAtMs: number | null;
}

function heldSides(holdings: Holdings): Array<[OutcomeIdx, bigint]> {
  const held: Array<[OutcomeIdx, bigint]> = [
    [0, holdings.upRaw],
    [1, holdings.downRaw],
  ];
  return held.filter(([, amountRaw]) => amountRaw > 0n);
}

/** A void returns each leg's cost; null when neither the per-side figure nor the cost basis is known. */
function voidPayouts(input: VerdictInput, held: Array<[OutcomeIdx, bigint]>): bigint[] | null {
  if (input.paidBySide) return held.map(([outcomeIdx]) => (outcomeIdx === 0 ? input.paidBySide!.up : input.paidBySide!.down));
  if (input.costBasisBase === null) return null;
  return apportionBase(input.costBasisBase, held.map(([, amountRaw]) => amountRaw));
}

function heldLegs(input: VerdictInput): ClaimLeg[] | null {
  const held = heldSides(input.holdings);
  if (input.settlement.isVoided) {
    const payouts = voidPayouts(input, held);
    if (payouts === null) return null;
    return held.map(([outcomeIdx, amountRaw], i) => ({ outcomeIdx, amountRaw, payoutBase: payouts[i]! }));
  }
  return held.map(([outcomeIdx, amountRaw]) => ({ outcomeIdx, amountRaw, payoutBase: input.settlement.winningOutcome === outcomeIdx ? winPayoutBase(amountRaw) : 0n }));
}

function outcomeOf(voided: boolean, payoutBase: bigint, pnlBase: bigint): VerdictOutcome {
  if (voided) return "void";
  if (payoutBase === 0n) return "loss";
  return pnlBase >= 0n ? "win" : "loss";
}

/** True when `deriveVerdict` can price this Window: anything but a void, or a void whose legs' cost is known. */
export function verdictPriceable(input: Pick<VerdictInput, "settlement" | "costBasisBase" | "paidBySide">): boolean {
  return !input.settlement.isVoided || Boolean(input.paidBySide) || input.costBasisBase !== null;
}

/**
 * One verdict per wallet per window: a wallet holding both sides gets ONE stamp on the net figure with both
 * legs listed, never a win card and a loss card side by side. Null while unsettled, when nothing was held, or for a
 * void whose legs' cost is unread (`verdictPriceable`): a refund is never guessed.
 */
export function deriveVerdict(input: VerdictInput): Verdict | null {
  if (!(input.settlement.isResolved || input.settlement.isVoided)) return null;
  const legs = heldLegs(input);
  if (legs === null || legs.length === 0) return null;
  const payoutBase = legs.reduce((sum, leg) => sum + leg.payoutBase, 0n);
  // A void returns exactly what the legs cost, so the ledger's refund is also the cost basis when none was on record.
  const costBasisBase = input.costBasisBase ?? (input.settlement.isVoided && input.paidBySide ? payoutBase : null);
  const pnlBase = costBasisBase === null ? payoutBase : payoutBase - costBasisBase;
  return {
    marketId: input.marketId,
    outcome: outcomeOf(input.settlement.isVoided, payoutBase, pnlBase),
    pnlBase,
    payoutBase,
    costBasisBase,
    legs,
    feeBps: input.feeBps,
    decimals: input.decimals,
    settledAtMs: input.settledAtMs,
  };
}
