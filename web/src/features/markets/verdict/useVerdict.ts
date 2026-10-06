"use client";

import { deriveVerdict, verdictPriceable, type PaidBySide } from "@agari/core/claims";
import { ONCHAIN_POLL_MS, VERDICT_POLL_MS } from "@agari/core/constants";
import { combineReadings, isOk, mapReading, type Reading } from "@agari/core/schemas";
import type { SettledRound, WalletHistory } from "@agari/core/projection";
import type { Address, ClaimableRow, EventMarket, MarketId, Resolution, Verdict } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { marketsProvider } from "@agari/markets";
import { keys, useClaimables, useHoldings, useMarket, useOnchain, usePositions, useReadingQuery, useTick, useWalletHistory } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useVenue } from "../useVenue";

export type VerdictPhase = "open" | "settling" | "settled";

export interface VerdictState {
  phase: VerdictPhase;
  market: Reading<EventMarket | null> | null;
  /** null until the window is settled; a settled reading holds null when the wallet held nothing in it. */
  verdict: Reading<Verdict | null> | null;
  resolution: Reading<Resolution> | null;
}

const RENDER_TICK_MS = 1_000;
/** How long a held Window's verdict waits for its settled record before it says the entry cost is unread (C4f). */
const COST_WAIT_MS = 30_000;

/** The settlement tx lands a beat after the status flips, so the record is polled until it carries one. */
function useSettledResolution(marketId: MarketId | null, settled: boolean): Reading<Resolution> | null {
  return useReadingQuery(keys.resolution(marketId), () => marketsProvider.getResolution(marketId as MarketId), {
    enabled: marketId !== null && settled,
    pollMs: (reading) => (reading && isOk(reading) && reading.value.settlementTxHash !== null ? false : VERDICT_POLL_MS),
  });
}

/**
 * The venue's settlement fee for one Window. Canton takes none (the fee is charged with the stake when the call fills and
 * returned on a void), so this reads 0; the receipt and The Call say a win is paid in full once it has answered.
 */
export function useSettlementFee(marketId: MarketId | null, settled: boolean): Reading<number> | null {
  return useReadingQuery([...keys.fee(marketId), "bps"], () => marketsProvider.settlementFeeBps(marketId as MarketId), {
    enabled: marketId !== null && settled,
  });
}

/** Per side, what the ledger itself says each held leg pays back on a void: a claimable row's legs, then a settled round's. */
export function voidPaidBySide(marketId: MarketId, claimables: readonly ClaimableRow[] | null, rounds: readonly SettledRound[] | null): PaidBySide | null {
  const bySide = (legs: readonly { outcomeIdx: number; payoutBase: bigint }[]): PaidBySide =>
    legs.reduce((acc, leg) => (leg.outcomeIdx === 0 ? { ...acc, up: acc.up + leg.payoutBase } : { ...acc, down: acc.down + leg.payoutBase }), { up: 0n, down: 0n });
  const row = claimables?.find((r) => r.marketId === marketId && (r.kind === "void" || r.kind === "stale-refund"));
  if (row) return bySide(row.legs);
  const round = rounds?.find((r) => r.marketId === marketId && r.outcome === "void");
  return round ? bySide(round.legs) : null;
}

/**
 * A settled Window's entry cost as the ledger recorded it (C4f): the round's stake, which is its settlement receipts' cost
 * (backing plus the fee paid at the fill, `PM.Leg`) when the fills are not on the tape, net of anything sold back before
 * the close — `toVerdict`'s cost basis, so the verdict's P&L is the record's. Null while the history has no round for it.
 */
export function settledCostBasis(marketId: MarketId, history: WalletHistory | null): bigint | null {
  const round = history?.rounds.find((r) => r.marketId === marketId);
  return round ? round.stakeBase - round.proceedsBase : null;
}

/**
 * True while a held, non-void Window's cost is not known yet but the ledger's record of it is still on its way: the legs
 * left the positions at the settle, and the receipt reaches the history a beat later. Waiting there is the truth; "no
 * entry cost on record" is said only when a complete history has read the Window and still has no cost for it.
 */
export function awaitingSettledCost(input: { costBasisBase: bigint | null; heldRaw: bigint; voided: boolean; history: WalletHistory | null; marketId: MarketId }): boolean {
  if (input.costBasisBase !== null || input.heldRaw === 0n || input.voided) return false;
  if (input.history === null) return true;
  return input.history.complete && !input.history.rounds.some((r) => r.marketId === input.marketId);
}

/** Watches one window for its wallet: polls the chain every few seconds once expiry passes, then derives the one verdict. */
export function useVerdict({ marketId, wallet }: { marketId: MarketId | null; wallet: Address | null }): VerdictState {
  useTick(RENDER_TICK_MS);
  const nowMs = marketsProvider.nowMs();
  const market = useMarket(marketId);
  const expirySec = market?.ok && market.value ? market.value.expirySec : null;
  const pastExpiry = expirySec !== null && nowMs >= secToMs(expirySec);

  // The poll cadence depends on the previous answer; the ref carries it across renders without an extra state round-trip.
  const settledRef = useRef(false);
  const onchain = useOnchain(marketId, settledRef.current ? false : pastExpiry ? VERDICT_POLL_MS : ONCHAIN_POLL_MS);
  const snapshot = onchain?.ok ? onchain.value : null;
  const settled = snapshot !== null && (snapshot.isResolved || snapshot.isVoided);
  settledRef.current = settled;

  const holdings = useHoldings(wallet, settled ? snapshot : null, false);
  const positions = usePositions(wallet);
  const fee = useSettlementFee(marketId, settled);
  const resolution = useSettledResolution(marketId, settled);
  // The ledger's own figures (C9e): a claimable leg's payout before the settler pays, the settled round's after it.
  const { venueId } = useVenue();
  const claimables = useClaimables(settled ? wallet : null, venueId);
  const history = useWalletHistory(wallet, settled);
  // Once read, a Window's costs never change; kept so the gap between the settler paying and the history catching up never
  // turns a priced verdict back into a wait.
  const known = useRef<{ marketId: MarketId | null; costBasisBase: bigint | null; paidBySide: PaidBySide | null }>({ marketId: null, costBasisBase: null, paidBySide: null });
  if (known.current.marketId !== marketId) known.current = { marketId, costBasisBase: null, paidBySide: null };

  // C4f: a held Window's cost is on its settlement receipt, which reaches the history a beat after the settle. The verdict
  // waits for it (re-reading the history every few seconds) for at most COST_WAIT_MS, then says the cost is unread. A
  // private call's Window never enters the seat's history (K-317), so the bound is what ends its wait.
  const settledSince = useRef<{ marketId: MarketId | null; atMs: number | null }>({ marketId: null, atMs: null });
  if (settledSince.current.marketId !== marketId) settledSince.current = { marketId, atMs: null };
  if (settled && settledSince.current.atMs === null) settledSince.current.atMs = nowMs;
  const waitOpen = settledSince.current.atMs !== null && nowMs - settledSince.current.atMs < COST_WAIT_MS;
  const rounds = history?.ok ? history.value : null;
  const liveCost = positions?.ok ? (positions.value.find((p) => p.marketId === marketId)?.costBasisBase ?? null) : null;
  const heldRaw = holdings?.ok ? holdings.value.upRaw + holdings.value.downRaw : 0n;
  const awaitingRecord =
    settled && waitOpen && marketId !== null && !(history !== null && !history.ok) &&
    awaitingSettledCost({ costBasisBase: liveCost ?? settledCostBasis(marketId, rounds) ?? known.current.costBasisBase, heldRaw, voided: snapshot?.isVoided ?? false, history: rounds, marketId });
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!awaitingRecord || wallet === null) return;
    const id = setInterval(() => void queryClient.invalidateQueries({ queryKey: keys.history(wallet) }), VERDICT_POLL_MS);
    return () => clearInterval(id);
  }, [awaitingRecord, wallet, queryClient]);

  const verdict = useMemo<Reading<Verdict | null> | null>(() => {
    if (!settled || snapshot === null || marketId === null || holdings === null || fee === null) return null;
    // The first verdict is the one announced (`useAnnounceOnce`), so it waits for the reads that fix its figures: the live
    // positions, and once the legs are gone the settled history. Read too early it said "Won +1.00" for a 0.14 profit.
    if (positions === null) return null;
    if (liveCost === null && history === null && known.current.costBasisBase === null) return null;
    if (awaitingRecord) return null;
    const costBasisBase = liveCost ?? settledCostBasis(marketId, rounds) ?? known.current.costBasisBase;
    const paidBySide = snapshot.isVoided ? (voidPaidBySide(marketId, claimables?.ok ? claimables.value : null, rounds?.rounds ?? null) ?? known.current.paidBySide) : null;
    known.current = { marketId, costBasisBase, paidBySide };
    // A void's refund is the legs' own cost: until one source has it, the verdict waits rather than guessing (never half a contract).
    if (!verdictPriceable({ settlement: snapshot, costBasisBase, paidBySide })) return null;
    const settledAtMs = resolution?.ok ? resolution.value.settledAtMs : null;
    return mapReading(combineReadings(holdings, fee), ([held, feeBps]) =>
      deriveVerdict({ marketId, settlement: snapshot, holdings: held, feeBps, decimals: snapshot.decimals, costBasisBase, paidBySide, settledAtMs }),
    );
  }, [settled, snapshot, marketId, holdings, fee, positions, resolution, claimables, history, rounds, liveCost, awaitingRecord]);

  return { phase: settled ? "settled" : pastExpiry ? "settling" : "open", market, verdict, resolution };
}
