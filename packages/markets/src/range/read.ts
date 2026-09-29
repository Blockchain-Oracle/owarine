/** The range reserve on Canton (C8c): the `range` ticket reserve, read and priced through `/api/ledger/tickets/*`. */
import { multiplierMilli, type RangeBasis, type RangeDeployment, type RangeIntent, type RangeMode, type RangeParams, type RangeQuote, type RangeReserveState, type RangeRound, type RangeSide } from "@agari/core/range";
import type { IntentJournal, PhaseListener } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import type { TickerSymbol } from "@agari/core/market";
import type { Address, Diagnosis, MarketId, Signature } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { nowMs } from "../provider/clock";
import { cantonNotLive } from "../stub/not-deployed";
import { allowAllStopGate } from "../submitter/stop-gate";
import { reserveAddressOf } from "../tickets/client";
import type { VaultContracts } from "../vault/contracts";
import { rangeOpenLane } from "./writes";

/** Kept for the reference's export: what a range surface says where the ticket desk is not reachable. */
export const RANGE_NOT_LIVE = cantonNotLive("range");

/** What the pricing reads off the Window: the opening print, where the book sits, the house's σ. */
export interface RangeWindowBasis {
  openingPrint: bigint;
  centerQE6: bigint;
  sigmaE8: bigint;
}

export interface RangePreview {
  stakeBase: bigint;
  probRaw: bigint;
  openingPrint: bigint;
  basis: RangeBasis;
}

export interface RangeBand {
  marketId: MarketId;
  asset: TickerSymbol;
  side: RangeSide;
  lowPrint: bigint;
  highPrint: bigint;
}

export interface RangeTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

export type RangeOpenOutcome =
  | { status: "confirmed"; txHash: Signature; roundId: bigint; stakeBase: bigint }
  /** The basis moved: the stake this payout now needs is above the one confirmed. Nothing was sent. */
  | { status: "requote"; stakeBase: bigint; maxPayoutBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Signature }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Signature };

/** The range reserve's id on Canton (derived; whether it is live is `getRangeReserveState`). */
export function resolveRangeDeployment(_env?: Partial<MarketsEnv>): RangeDeployment | null {
  return { chainId: 0, rangeReserve: reserveAddressOf("range"), fromBlock: 0n };
}

export { getRange, getRangeReserveState, getRangeSharesOf, listRangesOf } from "./reads";
export { previewRangeBasis, previewRangeOpen, quoteRangeOnchain, readRangeCapacity } from "./reads";

/** The program's preview as the one quote shape every ticket reads. */
export function toRangeQuote(preview: RangePreview, side: RangeSide, maxPayoutBase: bigint, one: bigint, decimals: number): RangeQuote {
  return {
    side,
    insideProbE6: side === "inside" ? (preview.probRaw * 1_000_000n) / one : 1_000_000n - (preview.probRaw * 1_000_000n) / one,
    probRaw: preview.probRaw,
    stakeBase: preview.stakeBase,
    maxPayoutBase,
    multiplierMilli: multiplierMilli(maxPayoutBase, preview.stakeBase),
    decimals,
    quotedAtMs: nowMs(),
  };
}

/** The open outside a session's submitter (scripts): the same ticket lane, journaled in `ctx.journal`, no daily stop. */
export function submitRangeOpen(ctx: RangeTxContext, intent: Extract<RangeIntent, { kind: "range-open" }>, onPhase?: PhaseListener): Promise<RangeOpenOutcome> {
  return rangeOpenLane({ wallet: ctx.wallet, journal: ctx.journal, stopGate: allowAllStopGate, nowMs }, intent, onPhase);
}
