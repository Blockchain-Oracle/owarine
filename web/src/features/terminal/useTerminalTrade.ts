"use client";

import type { EventMarket, Quote, Side } from "@owarine/core/types";
import { postArmExit, postDisarmExit, postExitClose, type ArmExitInput, type ExitWire } from "@owarine/markets";
import { invalidateAfterWrite, liveExitQuote, useSigner, useSubmitter, type LivePnlView } from "@owarine/markets/react";
import { ladderSnapshot, repriceLadder, walkStake } from "@owarine/markets/runtime";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { recordBet } from "@/features/room/record-bet";
import { diagnosisCopy } from "@/lib/copy";
import { haptic } from "@/lib/haptics";
import { playCloseOutcome, playTrade } from "@/lib/sound/trade";
import { rememberEntry, forgetEntry } from "./entries";
import { stopE8Of, trailBpsOf, trailFloorTicks } from "./exits/plan";
import { markOwnExitWrite } from "./exits/useExitFills";
import { money, multipleOf, sideWord } from "./format";
import { openPaper, settlePaper, updatePaper, type PaperPosition, type TradeMode } from "./mode";
import { toast } from "./toasts";

const PAIR = 1000n;

/** One open position on the screen, seat or paper, in the ledger's shape plus what the chart needs. */
export interface TerminalPosition {
  id: string;
  mode: TradeMode;
  marketId: string;
  asset: string;
  spotSymbol: string;
  intervalSec: number;
  side: Side;
  balanceUpRaw: bigint;
  balanceDownRaw: bigint;
  costBasisBase: bigint;
  decimals: number;
  entrySpot: number | null;
  linePrice: number | null;
  openedAtMs: number;
  expirySec: number;
  trailStop: number | null;
  paper: PaperPosition | null;
  /** R2: the seat's resting exit on this position (trail, stop, take-profit), as the ledger has it; null in demo. */
  exit: ExitWire | null;
}

export type Busy = "up" | "down" | "close" | "trail" | null;

interface TradeContext {
  mode: TradeMode;
  market: EventMarket | null;
  spot: number | null;
  stakeBase: bigint;
  availableBase: bigint | null;
  quotes: { up: Quote | null; down: Quote | null };
  slippageBps: number;
  /** The Window's open print, as a price. */
  linePrice: number | null;
  onNeedSeat: () => void;
  /** R2: whether the seat's resting exits are on the participant; until then Trail runs in this tab. */
  ledgerExits: boolean;
  /** After an exit write: read the seat's exits again now. */
  onExitsChanged: () => void;
}

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Tradash's loop on Owarine: one tap opens, one tap closes, Trail rides the move. Demo is paper on the venue's live ladder
 * (no fee); live is the seat, through the same submitter lane, journal and recovery as the ticket.
 */
export function useTerminalTrade(ctx: TradeContext) {
  const submitter = useSubmitter();
  const { address } = useSigner();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<Busy>(null);
  const inFlight = useRef(false);
  const c = useRef(ctx);
  c.current = ctx;

  const guard = async (what: Exclude<Busy, null>, run: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(what);
    try {
      await run();
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  /** One tap: UP or DOWN at the stake. `add` is the Add sheet: its own stake, the quote it showed, the position's exit. */
  const open = useCallback(
    (side: Side, add?: { stakeBase: bigint; quote: Quote | null; exit?: ExitWire | null }) =>
      guard(side, async () => {
        const { mode, market, spot, availableBase, linePrice } = c.current;
        const stakeBase = add?.stakeBase ?? c.current.stakeBase;
        const quotes = add ? { up: add.quote, down: add.quote } : c.current.quotes;
        if (!market) return void toast({ kind: "error", title: "No Window open", description: "The next one opens soon." });
        const sym = market.asset;
        if (mode === "demo") {
          const snap = ladderSnapshot(market.marketId);
          const t = nowSec();
          if (!snap || snap.ladder.state !== "quoting" || t > snap.ladder.quotingUntilSec) return void toast({ kind: "error", title: "No price right now", description: `${sym} is between Windows.` });
          const levels = repriceLadder(snap.ladder, spot === null ? null : BigInt(Math.round(spot * 1e8)), t);
          const walked = walkStake(side === "up" ? levels.up : levels.down, stakeBase, snap.ladder.cashUnit, 0, { minLots: 1n });
          if (!walked) return void toast({ kind: "error", title: "No liquidity at this size", description: "Try a smaller size." });
          openPaper({
            id: `p:${market.marketId}:${side}:${Date.now()}`, marketId: market.marketId, asset: sym, spotSymbol: snap.ladder.symbol ?? sym, intervalSec: market.intervalSec, side,
            contractsRaw: (walked.lots * PAIR * snap.ladder.cashUnit).toString(), costBase: walked.costBase.toString(), entrySpot: spot ?? 0, openedAtMs: Date.now(),
            quotingUntilSec: snap.ladder.quotingUntilSec, expirySec: snap.ladder.expirySec, linePrice, trail: null,
          });
          playTrade("open");
          haptic("open");
          if (add) return void toast({ kind: "success", title: `Added to ${sym}`, description: `+${money(walked.costBase, market.decimals)} staked` });
          return void toast({ kind: "success", title: `${sideWord(side)} ${sym} opened`, description: `pays ${multipleOf(walked.priceTicks)} · ${money(walked.costBase, market.decimals)} staked` });
        }
        if (!submitter || !address) {
          c.current.onNeedSeat();
          return void toast({ kind: "error", title: "Take a seat to trade live", description: "A seat is your account on Canton — free, with demo credits." });
        }
        const quote = quotes[side];
        if (!quote) return void toast({ kind: "error", title: "No price right now", description: `${sym} is between Windows.` });
        if (availableBase !== null && availableBase < quote.maxCostBase) {
          return void toast({ kind: "error", title: "Not enough credits", description: `${sym} needs ${money(quote.maxCostBase, market.decimals)} — ${money(availableBase, market.decimals)} available.` });
        }
        const id = `open-${sym}`;
        toast({ id, kind: "loading", title: add ? `Adding to ${sym}…` : `Opening ${sideWord(side)} ${sym}…` });
        let outcome = await submitter.submitOrder({ market, side, stakeBase: quote.stakeBase, displayedQuote: quote, wallet: address });
        // One tap means one tap: a fresh price inside the tolerance (better, or at most `slippageBps` worse) is taken
        // once, as Tradash's market order with its price cap would; anything worse is said, never silently paid.
        if (outcome.status === "requote" && withinTolerance(quote, outcome.quote, c.current.slippageBps)) {
          outcome = await submitter.submitOrder({ market, side, stakeBase: outcome.quote.stakeBase, displayedQuote: outcome.quote, wallet: address });
        }
        if (outcome.status === "confirmed") {
          if (!add) rememberEntry(market.marketId, side, spot ?? 0);
          // An armed exit names the lots it may sell: after an Add it is armed again over the whole position.
          if (add?.exit) {
            markOwnExitWrite(market.marketId, side);
            void rearm(add.exit).then(() => c.current.onExitsChanged());
          }
          await invalidateAfterWrite(queryClient, { wallet: address, marketId: market.marketId });
          recordBet(market.marketId, address, outcome.booked.txHash, "wallet");
          playTrade("open");
          haptic("open");
          if (add) return void toast({ id, kind: "success", title: `Added to ${sym}`, description: `+${money(outcome.booked.costBase, market.decimals)} staked` });
          return void toast({ id, kind: "success", title: `${sideWord(side)} ${sym} opened`, description: `pays ${multipleOf(outcome.booked.avgPriceBps / 10)} · ${money(outcome.booked.costBase, market.decimals)} staked` });
        }
        if (outcome.status === "requote") return void toast({ id, kind: "error", title: "Price moved", description: `The venue's price moved to ${outcome.quote.oddsCents}¢. Tap again to take it.` });
        if (outcome.status === "nothingFilled") return void toast({ id, kind: "info", title: "Nothing filled", description: "The price moved before it landed. Nothing was taken." });
        if (outcome.status === "unknown") return void toast({ id, kind: "info", title: "Waiting for the ledger", description: "The order is journaled; nothing is re-sent." });
        if (outcome.status === "resting") return void toast({ id, kind: "info", title: "Order resting", description: "It fills when the Window opens." });
        return void toast({ id, kind: "error", title: "Order failed", description: diagnosisCopy(outcome.diagnosis.kind).headline });
      }),
    [address, queryClient, submitter],
  );

  /** Close the whole position (or `contractsRaw` of it: Reduce). `why` words the toast for a trail hit. */
  const close = useCallback(
    (p: TerminalPosition, live: LivePnlView | null, why: "close" | "trail" = "close", contractsRaw?: bigint) =>
      guard("close", async () => {
        const { market, spot, slippageBps } = c.current;
        const held = p.side === "up" ? p.balanceUpRaw : p.balanceDownRaw;
        const sell = contractsRaw && contractsRaw < held ? contractsRaw : held;
        const partial = sell < held;
        const costShare = (p.costBasisBase * sell) / (held === 0n ? 1n : held);
        const sym = p.asset;
        const finish = (pnl: bigint, id?: string) => {
          const n = Number(pnl) / 10 ** p.decimals;
          if (partial) playTrade("close");
          else playCloseOutcome(n);
          haptic("close");
          const title = partial ? `Reduced ${sym}` : why === "trail" ? `Trailing stop hit · ${sym}` : `Closed ${sym}`;
          const description = partial ? `−${money(costShare, p.decimals)} staked` : `${why === "trail" ? "Locked" : "Realized"} ${money(pnl, p.decimals, true)}`;
          toast({ ...(id ? { id } : {}), kind: partial ? "info" : n >= 0 ? "success" : "info", title, description, confetti: !partial && n > 0 });
        };

        if (p.mode === "demo" && p.paper) {
          const exit = liveExitQuote(p.marketId, p.side, sell, p.decimals, 0);
          if (!exit || live?.locked) return void toast({ kind: "info", title: "Locked", description: `This Window pays at its close (${clock(p.expirySec)}).` });
          const pnl = exit.expectedProceedsBase - costShare;
          settlePaper(
            p.paper.id,
            { kind: partial ? "reduce" : why, asset: sym, side: p.side, intervalSec: p.intervalSec, costBase: costShare.toString(), pnlBase: pnl.toString(), entrySpot: p.entrySpot ?? 0, exitSpot: spot, openedAtMs: p.openedAtMs, closedAtMs: Date.now() },
            partial ? { contractsRaw: held - sell, costBase: p.costBasisBase - costShare } : undefined,
          );
          return finish(pnl);
        }

        if (!submitter || !address || !market) return void toast({ kind: "error", title: "Take a seat to trade live" });
        const exit = liveExitQuote(p.marketId, p.side, sell, p.decimals, slippageBps);
        if (!exit) return void toast({ kind: "info", title: "Locked", description: `This Window pays at its close (${clock(p.expirySec)}).` });
        const id = `close-${sym}`;
        toast({ id, kind: "loading", title: partial ? `Reducing ${sym}…` : `Closing ${sym}…` });
        // R2: an armed exit over the whole position closes in one venue command, at the bid, never below what was shown.
        if (!partial && p.exit && p.exit.lots * 1000n * p.exit.cashUnit >= held) {
          markOwnExitWrite(p.marketId, p.side);
          const r = await postExitClose(p.exit.cid, exit.minProceedsBase);
          if (r.ok && r.value.kind === "closed") {
            await invalidateAfterWrite(queryClient, { wallet: address, marketId: p.marketId as EventMarket["marketId"] });
            c.current.onExitsChanged();
            forgetEntry(p.marketId, p.side);
            return finish(r.value.proceedsBase - costShare, id);
          }
          if (r.ok && r.value.kind === "requote") return void toast({ id, kind: "error", title: "Price moved", description: `Close pays less than ${money(exit.minProceedsBase, p.decimals)} now. Tap again to take the new price.` });
          // The exit is gone or the venue would not fill it: close the ordinary way below.
        }
        const target = market.marketId === p.marketId ? market : { ...market, marketId: p.marketId as EventMarket["marketId"], intervalSec: p.intervalSec };
        const outcome = await submitter.submitCashOut({ market: target, side: p.side, contractsRaw: exit.contractsRaw, displayedExit: exit, wallet: address });
        if (outcome.status === "confirmed") {
          await invalidateAfterWrite(queryClient, { wallet: address, marketId: p.marketId as EventMarket["marketId"] });
          if (!partial) forgetEntry(p.marketId, p.side);
          return finish((outcome.booked.proceedsBase ?? exit.expectedProceedsBase) - costShare, id);
        }
        if (outcome.status === "requote") return void toast({ id, kind: "error", title: "Price moved", description: `Close now pays ${money(outcome.exit.minProceedsBase, p.decimals)}. Tap again to take it.` });
        if (outcome.status === "nothingFilled") return void toast({ id, kind: "info", title: "Nothing sold", description: "The price moved before the sale landed. Your position is unchanged." });
        if (outcome.status === "unknown") return void toast({ id, kind: "info", title: "Waiting for the ledger", description: "The sale is journaled; nothing is re-sent." });
        return void toast({ id, kind: "error", title: "Close failed", description: diagnosisCopy(outcome.diagnosis.kind).headline });
      }),
    [address, queryClient, submitter],
  );

  /**
   * Arms or removes the trail; arming needs a favourable move past break-even larger than the trail distance. A live
   * seat's trail is a resting exit on the ledger (R2): the venue follows the price and sells even with this tab closed,
   * never below break-even less the slippage tolerance. Before R2, and in demo, it runs in this tab.
   */
  const toggleTrail = useCallback((p: TerminalPosition, ref: number | null, trailPct: number) => {
    const { spot, slippageBps, ledgerExits } = c.current;
    playTrade("tap");
    haptic("tap");
    const onLedger = p.mode === "live" && p.paper === null && ledgerExits;
    const trailing = onLedger ? p.exit?.stop?.trailBps != null : p.trailStop !== null;
    if (!onLedger) {
      if (trailing) {
        setTrail(p, null);
        return void toast({ kind: "info", title: `Trailing stop off · ${p.asset}` });
      }
      if (spot === null || ref === null) return;
      const stop = p.side === "up" ? Math.max(spot * (1 - trailPct), ref) : Math.min(spot * (1 + trailPct), ref);
      setTrail(p, stop);
      return void toast({ kind: "success", title: `Trailing stop armed · ${p.asset}`, description: `Locks profit if price reverses ${(trailPct * 100).toFixed(1)}%` });
    }
    return guard("trail", async () => {
      const id = `trail-${p.asset}`;
      markOwnExitWrite(p.marketId, p.side);
      if (trailing && p.exit) {
        // Off: a take-profit on the same exit stays; with none, the exit goes.
        const tp = p.exit.takeProfitTicks;
        const r = tp !== null
          ? await postArmExit({ marketId: p.marketId as EventMarket["marketId"], side: p.side, floorTicks: Math.min(p.exit.floorTicks, tp), takeProfitTicks: tp, stop: null })
          : await postDisarmExit({ marketId: p.marketId as EventMarket["marketId"], side: p.side });
        c.current.onExitsChanged();
        setTrail(p, null);
        if (!r.ok || r.value.kind === "refused" || r.value.kind === "unknown") return void toast({ id, kind: "error", title: "Trailing stop still on", description: r.ok && "diagnosis" in r.value ? diagnosisCopy(r.value.diagnosis.kind).headline : "Try again." });
        return void toast({ id, kind: "info", title: `Trailing stop off · ${p.asset}` });
      }
      if (spot === null || ref === null) return;
      const level = p.side === "up" ? Math.max(spot * (1 - trailPct), ref) : Math.min(spot * (1 + trailPct), ref);
      const held = p.side === "up" ? p.balanceUpRaw : p.balanceDownRaw;
      const floorTicks = trailFloorTicks(p.costBasisBase, held, slippageBps);
      const tp = p.exit?.takeProfitTicks ?? null;
      toast({ id, kind: "loading", title: `Arming trailing stop · ${p.asset}…` });
      const r = await postArmExit({
        marketId: p.marketId as EventMarket["marketId"], side: p.side, floorTicks, takeProfitTicks: tp !== null && tp >= floorTicks ? tp : null,
        stop: { stopE8: stopE8Of(p.side, level), trailBps: trailBpsOf(trailPct) },
      });
      c.current.onExitsChanged();
      if (r.ok && r.value.kind === "confirmed") {
        setTrail(p, level);
        return void toast({ id, kind: "success", title: `Trailing stop on the ledger · ${p.asset}`, description: `Sells if price reverses ${(trailPct * 100).toFixed(1)}% — even with this tab closed` });
      }
      const why = r.ok && "diagnosis" in r.value ? diagnosisCopy(r.value.diagnosis.kind).headline : r.ok ? "" : diagnosisCopy(r.diagnosis.kind).headline;
      toast({ id, kind: r.ok && r.value.kind === "unknown" ? "info" : "error", title: r.ok && r.value.kind === "unknown" ? "Waiting for the ledger" : "Trailing stop not armed", description: why || "Try again." });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { busy, open, close, toggleTrail };
}

/** Arms `exit` again over everything now held on its side, same floor, take-profit and stop (after an Add). */
async function rearm(exit: ExitWire): Promise<void> {
  const x: ArmExitInput = { marketId: exit.marketId, side: exit.side, floorTicks: exit.floorTicks, takeProfitTicks: exit.takeProfitTicks, stop: exit.stop };
  await postArmExit(x).catch(() => undefined);
}

/** A fresh buy price no worse than the shown one by more than `bps` (per contract, fee included). */
export function withinTolerance(shown: Quote, fresh: Quote, bps: number): boolean {
  return fresh.avgPriceBps <= shown.avgPriceBps * (1 + bps / 10_000);
}

/** Writes a trail stop where the position lives (paper state, or the seat's entry record). */
export function setTrail(p: TerminalPosition, stop: number | null): void {
  if (p.paper) updatePaper(p.paper.id, { trail: stop === null ? null : { stop } });
  else rememberEntry(p.marketId, p.side, p.entrySpot ?? 0, stop);
}

/** Whether Trail may arm: the spot has moved more than `pct` past `ref` in the position's favour. */
export function trailEligible(side: Side, spot: number | null, ref: number | null, pct: number): boolean {
  if (spot === null || ref === null || !(ref > 0)) return false;
  return (side === "up" ? spot / ref - 1 : 1 - spot / ref) > pct;
}

/** The next trail stop: it only ever moves in the position's favour. */
export function ratchet(side: Side, stop: number, spot: number, pct: number): number {
  return side === "up" ? Math.max(stop, spot * (1 - pct)) : Math.min(stop, spot * (1 + pct));
}

export const trailHit = (side: Side, stop: number, spot: number): boolean => (side === "up" ? spot <= stop : spot >= stop);

const clock = (sec: number) => new Date(sec * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
