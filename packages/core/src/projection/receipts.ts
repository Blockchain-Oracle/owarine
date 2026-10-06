/**
 * Settlement receipts → history rounds (C6d; engine 0.4.0 `PM.Publication.SettlementReceipt`, K-028/K-030). The ledger
 * writes one bilateral receipt per settled or claimed position, pair leg or ticket, so history has a ledger source:
 *
 *   pair legs  grouped per Window. A round the fill replay already built gets the receipts attached (the payout
 *              breakdown); a Window with receipts but no attributed fills becomes a round from the receipts alone.
 *   tickets    one round per receipt, tagged with its product; outcome from the ledger's `detail.result`.
 *
 * A receipt only exists once the position was paid out (or lost, or refunded), so its round's claim is `paid`. Pure.
 */
import type { MarketId, OutcomeIdx } from "../types/market";
import type { Signature } from "../types/primitives";
import type { ClaimLeg } from "../types/trading";
import type { ReceiptDetailFacts, RoundOutcome, RoundReceipt, SettledRound } from "./types";

/** Base units per lot at one `cashUnit`: a pair pays 1000 ticks × cashUnit. */
const PAIR_TICKS = 1000n;

export interface ReceiptFacts {
  receiptId: string;
  marketId: MarketId;
  product: string | null;
  outcomeIdx: OutcomeIdx;
  /** The Window's outcome as the receipt recorded it; null = void. */
  resolvedIdx: OutcomeIdx | null;
  lots: bigint;
  cashUnit: bigint;
  costBase: bigint;
  payoutBase: bigint;
  feeBase: bigint;
  detail: ReceiptDetailFacts | null;
  atMs: number;
  txHash: Signature;
  /** The Window the receipt names (a parlay: the leg that decided it). */
  market: { asset: string; intervalSec: number; expirySec: number; resolvedAtMs: number | null; question: string | null };
}

const sum = (xs: readonly ReceiptFacts[], f: (r: ReceiptFacts) => bigint) => xs.reduce((acc, r) => acc + f(r), 0n);

function receiptOf(rs: readonly ReceiptFacts[]): RoundReceipt {
  const first = rs[0]!;
  return {
    product: first.product, receiptIds: rs.map((r) => r.receiptId), costBase: sum(rs, (r) => r.costBase), payoutBase: sum(rs, (r) => r.payoutBase),
    feeBase: sum(rs, (r) => r.feeBase), detail: rs.length === 1 ? first.detail : null,
  };
}

function ticketOutcome(r: ReceiptFacts): RoundOutcome {
  const result = r.detail?.result;
  if (result === "won" || result === "lost" || result === "void") return result === "won" ? "win" : result === "lost" ? "loss" : "void";
  if (r.resolvedIdx === null) return "void";
  return r.payoutBase > r.costBase ? "win" : "loss";
}

function pairOutcome(rs: readonly ReceiptFacts[], pnl: bigint): RoundOutcome {
  if (rs.every((r) => r.resolvedIdx === null)) return "void";
  return rs.some((r) => r.resolvedIdx === r.outcomeIdx) && pnl >= 0n ? "win" : "loss";
}

function baseRound(first: ReceiptFacts, decimals: number, rs: readonly ReceiptFacts[]): Omit<SettledRound, "outcome" | "legs" | "sidesTraded"> {
  const receipt = receiptOf(rs);
  const atMs = Math.max(...rs.map((r) => r.atMs));
  return {
    marketId: first.marketId, asset: first.market.asset, intervalSec: first.market.intervalSec, expirySec: first.market.expirySec, decimals,
    stakeBase: receipt.costBase, proceedsBase: 0n, payoutBase: receipt.payoutBase, feeBase: receipt.feeBase, pnlBase: receipt.payoutBase - receipt.costBase,
    feeBps: 0, claim: "paid", source: "wallet", settledAtMs: first.market.resolvedAtMs ?? atMs, openedAtMs: Math.min(...rs.map((r) => r.atMs)),
    entryTxHash: first.txHash, fillCount: 0, shortCount: 0, receipt, ...(first.market.question ? { question: first.market.question } : {}),
  };
}

const receiptRaw = (r: ReceiptFacts) => r.lots * r.cashUnit * PAIR_TICKS;

/**
 * A replayed round whose held legs the receipts cover side for side takes the ledger's own figures: what each side was
 * paid, and the P&L from it. Partly covered (a leg refunded stale, which leaves no receipt), the replay's
 * `PM.Leg.legPayout` figures stand and the receipts ride along.
 */
function paidAsReceipted(round: SettledRound, rs: readonly ReceiptFacts[]): SettledRound {
  if (!round.legs?.length) return round;
  const sides = round.legs.map((leg) => rs.filter((r) => r.outcomeIdx === leg.outcomeIdx));
  const covered = round.legs.every((leg, i) => sum(sides[i]!, receiptRaw) === leg.amountRaw);
  if (!covered || sum(rs, receiptRaw) !== round.legs.reduce((total, leg) => total + leg.amountRaw, 0n)) return round;
  const legs = round.legs.map((leg, i) => ({ ...leg, payoutBase: sum(sides[i]!, (r) => r.payoutBase) }));
  const payoutBase = sum(rs, (r) => r.payoutBase);
  const pnlBase = round.proceedsBase + payoutBase - round.stakeBase;
  const outcome: RoundOutcome = round.outcome === "void" ? "void" : payoutBase === 0n ? "loss" : pnlBase >= 0n ? "win" : "loss";
  // The fee stays the replay's: it also counts fees kept on slices sold before expiry, which leave no receipt.
  return { ...round, legs, payoutBase, pnlBase, outcome };
}

/** Rounds from the fill replay, with receipts attached, plus the rounds only the receipts know about. */
export function withReceipts(rounds: readonly SettledRound[], receipts: readonly ReceiptFacts[], decimals: number): SettledRound[] {
  const pairs = new Map<string, ReceiptFacts[]>();
  const out: SettledRound[] = [];
  for (const r of receipts) {
    if (r.product !== null) continue;
    const list = pairs.get(r.marketId) ?? [];
    list.push(r);
    pairs.set(r.marketId, list);
  }
  for (const round of rounds) {
    const own = round.source === "wallet" ? pairs.get(round.marketId) : undefined;
    if (!own) {
      out.push(round);
      continue;
    }
    pairs.delete(round.marketId);
    const question = own[0]!.market.question;
    out.push({ ...paidAsReceipted(round, own), receipt: receiptOf(own), ...(question ? { question } : {}) });
  }
  for (const rs of pairs.values()) {
    const base = baseRound(rs[0]!, decimals, rs);
    const legs: ClaimLeg[] = rs.map((r) => ({ outcomeIdx: r.outcomeIdx, amountRaw: r.lots * r.cashUnit * PAIR_TICKS, payoutBase: r.payoutBase }));
    out.push({ ...base, outcome: pairOutcome(rs, base.pnlBase), legs, sidesTraded: [...new Set(rs.map((r) => r.outcomeIdx))] });
  }
  for (const r of receipts) {
    if (r.product === null) continue;
    out.push({ ...baseRound(r, decimals, [r]), outcome: ticketOutcome(r), legs: [], sidesTraded: [r.outcomeIdx] });
  }
  return out;
}
