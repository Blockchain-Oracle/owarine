"use client";

import { PARLAY_STAKE_HEADROOM_BPS, type ParlayQuote } from "@owarine/core/parlay";
import { isOk } from "@owarine/core/schemas";
import type { Address, MarketId, Side } from "@owarine/core/types";
import { mulBpsCeil } from "@owarine/core/units";
import { marketsProvider } from "@owarine/markets";
import { TICKET_ONE } from "@owarine/markets/parlay";
import { useEffect, useMemo, useRef } from "react";
import { useParlayTickets, type ParlayTicketView } from "@/features/parlay/useParlayTickets";
import { useParlayWrites } from "@/features/parlay/useParlayWrites";
import { diagnosisCopy } from "@/lib/copy";
import { haptic } from "@/lib/haptics";
import { playCloseOutcome, playTrade } from "@/lib/sound/trade";
import { money } from "../format";
import { openPaperParlay, settlePaperParlay, updatePaperParlay, useModeState, type PaperParlay, type TradeMode } from "../mode";
import { toast } from "../toasts";
import { parlayOutcome, type LegStatus } from "./price";
import { clearSlip, type SlipLeg } from "./slip";

const CREDIT_DECIMALS = 6;
const SETTLE_GRACE_SEC = 5;

/** One leg of an open ticket, seat or paper, as the screen draws and marks it. */
export interface ScreenLeg {
  marketId: string;
  asset: string;
  intervalSec: number;
  side: Side;
  expirySec: number;
  status: LegStatus;
  /** The leg's priced chance at open (0–1). */
  entryChance: number;
  /** The Window's opening print (e8), when the ticket's read carries it. */
  lineE8: bigint | null;
}

export interface ScreenParlay {
  id: string;
  mode: TradeMode;
  stakeBase: bigint;
  maxPayoutBase: bigint;
  openedAtMs: number;
  legs: ScreenLeg[];
}

const chanceOf = (priceRaw: bigint | string) => Number(BigInt(priceRaw)) / Number(TICKET_ONE);

function fromPaper(p: PaperParlay): ScreenParlay {
  return {
    id: p.id, mode: "demo", stakeBase: BigInt(p.stakeBase), maxPayoutBase: BigInt(p.maxPayoutBase), openedAtMs: p.openedAtMs,
    legs: p.legs.map((l) => ({ marketId: l.marketId, asset: l.asset, intervalSec: l.intervalSec, side: l.side, expirySec: l.expirySec, status: l.status, entryChance: chanceOf(l.priceRaw), lineE8: null })),
  };
}

/** A seat ticket's stable key: what it named and when (a ticket read from its receipt carries no live id). */
const ticketKey = (t: ParlayTicketView) => `${t.openedAtSec}:${t.legs.map((l) => `${l.marketId}${l.side}`).join(",")}`;

function fromSeat(t: ParlayTicketView): ScreenParlay {
  return {
    id: `pl:${ticketKey(t)}`, mode: "live", stakeBase: t.stakeBase, maxPayoutBase: t.maxPayoutBase, openedAtMs: t.openedAtSec * 1000,
    legs: [...t.legs]
      .sort((a, b) => a.expirySec - b.expirySec)
      .map((l) => ({ marketId: l.marketId, asset: l.asset ?? "?", intervalSec: l.intervalSec ?? 0, side: l.side, expirySec: l.expirySec, status: l.status, entryChance: chanceOf(l.priceRaw), lineE8: l.openingPriceRaw })),
  };
}

const legName = (l: { asset: string; intervalSec: number }) => `${l.asset} ${cadence(l.intervalSec)}`;
const cadence = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);

/**
 * The open parlays on screen: paper tickets in demo, the seat's live tickets on Canton. Demo legs settle here on the real
 * resolutions (the reserve's rule: a void leg voids the ticket, a lost leg ends it); live legs settle on the ledger by
 * the venue's keeper, and the screen answers each one as it lands — a toast, a sound, the result.
 */
export function useScreenParlays(mode: TradeMode, address: string | null, nowSec: number): ScreenParlay[] {
  const modeState = useModeState();
  const seat = useParlayTickets(mode === "live" ? (address as Address | null) : null);
  const tickets = useMemo(() => (seat && isOk(seat) ? seat.value : null), [seat]);

  // Demo: settle due legs on the Window's real resolution, then the ticket once it is decided.
  const tick = Math.floor(nowSec / SETTLE_GRACE_SEC);
  useEffect(() => {
    if (mode !== "demo") return;
    for (const p of modeState.parlays) {
      const due = p.legs.filter((l) => l.status === "pending" && nowSec > l.expirySec + SETTLE_GRACE_SEC);
      if (!due.length) continue;
      void Promise.all(
        due.map(async (l) => {
          const r = await marketsProvider.getResolution(l.marketId as MarketId);
          if (!isOk(r)) return null;
          const res = r.value;
          if (res.voided) return { marketId: l.marketId, status: "void" as const };
          if (res.openingRaw === null || res.closingRaw === null) return null;
          const upWins = res.closingRaw >= res.openingRaw;
          return { marketId: l.marketId, status: (l.side === "up") === upWins ? ("won" as const) : ("lost" as const) };
        }),
      ).then((decided) => {
        const by = new Map(decided.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [d.marketId, d.status]));
        if (!by.size) return;
        const legs = p.legs.map((l) => (l.status === "pending" && by.has(l.marketId) ? { ...l, status: by.get(l.marketId)! } : l));
        const outcome = parlayOutcome(legs);
        for (const l of legs) if (by.has(l.marketId) && outcome === "live") answerLeg(l, legs);
        if (outcome === "live") return updatePaperParlay(p.id, legs);
        const stake = BigInt(p.stakeBase);
        const pnl = outcome === "won" ? BigInt(p.maxPayoutBase) - stake : outcome === "lost" ? -stake : 0n;
        settlePaperParlay(p.id, {
          kind: "parlay", asset: legs.map((l) => l.asset).join(" · "), side: legs[0]!.side, intervalSec: legs[0]!.intervalSec, costBase: p.stakeBase, pnlBase: pnl.toString(),
          entrySpot: 0, exitSpot: null, openedAtMs: p.openedAtMs, closedAtMs: Date.now(),
        });
        answerTicket(outcome, pnl, BigInt(p.maxPayoutBase));
      });
    }
    // Checked every few seconds while paper tickets are open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tick, modeState.parlays.length]);

  // Live: answer each leg and each ticket as the keeper settles it (the first read is the baseline, never announced).
  const seen = useRef<Map<string, { status: string; legs: string[] }> | null>(null);
  useEffect(() => {
    if (mode !== "live" || !tickets) return;
    const next = new Map(tickets.map((t) => [ticketKey(t), { status: t.status, legs: t.legs.map((l) => l.status) }]));
    const before = seen.current;
    seen.current = next;
    if (!before) return;
    for (const t of tickets) {
      const was = before.get(ticketKey(t));
      if (!was || was.status !== "live") continue;
      const view = fromSeat(t);
      if (t.status === "live") {
        const legs = [...t.legs].sort((a, b) => a.expirySec - b.expirySec);
        for (const [i, l] of legs.entries()) if (l.status !== "pending" && was.legs[t.legs.indexOf(l)] === "pending") answerLeg(view.legs[i]!, view.legs);
        continue;
      }
      const outcome = t.status === "claimed" ? "won" : t.status;
      const pnl = outcome === "won" ? t.maxPayoutBase - t.stakeBase : outcome === "lost" ? -t.stakeBase : 0n;
      answerTicket(outcome, pnl, t.maxPayoutBase);
    }
  }, [mode, tickets]);

  return useMemo(() => {
    if (mode === "demo") return modeState.parlays.map(fromPaper);
    return (tickets ?? []).filter((t) => t.status === "live").map(fromSeat);
  }, [mode, modeState.parlays, tickets]);
}

function answerLeg(l: { asset: string; intervalSec: number; status: LegStatus }, legs: ReadonlyArray<{ status: LegStatus }>): void {
  if (l.status !== "won") return;
  const left = legs.filter((x) => x.status === "pending").length;
  haptic("open");
  toast({ kind: "success", title: `${legName(l)} leg landed`, description: left > 0 ? `${left} to go` : "Paying out…" });
}

function answerTicket(outcome: "won" | "lost" | "void" | "live", pnl: bigint, payout: bigint): void {
  if (outcome === "live") return;
  playCloseOutcome(Number(pnl));
  if (outcome === "won") return void toast({ kind: "success", title: "Parlay landed", description: `Paid ${money(payout, CREDIT_DECIMALS)} · ${money(pnl, CREDIT_DECIMALS, true)}`, confetti: true });
  if (outcome === "void") return void toast({ kind: "info", title: "Parlay voided", description: "A Window was voided. Stake returned" });
  toast({ kind: "info", title: "Parlay missed", description: `A leg didn't land · ${money(pnl, CREDIT_DECIMALS, true)}` });
}

/**
 * Places the slip: paper in demo; on the seat, a firm quote at the estimate's payout with the stake capped at the
 * estimate plus the screen's slippage tolerance (a fresh price inside it is taken, past it the reserve requotes and
 * nothing is placed), then the seat's own accept.
 */
export function usePlaceParlay(ctx: { mode: TradeMode; availableBase: bigint | null; slippageBps: number; onNeedSeat: () => void }) {
  const writes = useParlayWrites();
  const c = useRef(ctx);
  c.current = ctx;

  const place = async (legs: readonly SlipLeg[], quote: ParlayQuote): Promise<boolean> => {
    const { mode, availableBase, slippageBps } = c.current;
    const label = legs.map((l) => l.asset).join(" + ");
    if (mode === "demo") {
      openPaperParlay({
        id: `pp:${Date.now()}`, stakeBase: quote.stakeBase.toString(), maxPayoutBase: quote.maxPayoutBase.toString(), openedAtMs: Date.now(),
        legs: legs.map((l, i) => ({ marketId: l.marketId, asset: l.asset, intervalSec: l.intervalSec, side: l.side, expirySec: l.expirySec, priceRaw: (quote.legPricesRaw[i] ?? 0n).toString(), status: "pending" })),
      });
      clearSlip();
      playTrade("open");
      haptic("open");
      toast({ kind: "success", title: `Parlay placed · ${label}`, description: `${money(quote.stakeBase, CREDIT_DECIMALS)} staked · pays ${money(quote.maxPayoutBase, CREDIT_DECIMALS)} if all land` });
      return true;
    }
    if (!writes.canSign || !writes.address) {
      c.current.onNeedSeat();
      toast({ kind: "error", title: "Take a seat to trade live", description: "A seat is your account on Canton — free, with demo credits." });
      return false;
    }
    if (availableBase !== null && availableBase < quote.stakeBase) {
      toast({ kind: "error", title: "Not enough credits", description: `This parlay needs ${money(quote.stakeBase, CREDIT_DECIMALS)} — ${money(availableBase, CREDIT_DECIMALS)} available.` });
      return false;
    }
    const id = "parlay-open";
    toast({ id, kind: "loading", title: `Placing parlay · ${label}…` });
    const maxStake = mulBpsCeil(quote.stakeBase, 10_000 + Math.max(PARLAY_STAKE_HEADROOM_BPS, slippageBps));
    const outcome = await writes.open(legs.map((l) => ({ marketId: l.marketId as MarketId, side: l.side })), quote.maxPayoutBase, maxStake);
    if (!outcome) {
      toast({ id, kind: "error", title: "Couldn't place the parlay", description: "Your seat isn't ready yet. Try again." });
      return false;
    }
    if (outcome.status === "confirmed") {
      clearSlip();
      playTrade("open");
      haptic("open");
      toast({ id, kind: "success", title: `Parlay placed · ${label}`, description: `${money(outcome.stakeBase, CREDIT_DECIMALS)} staked · pays ${money(quote.maxPayoutBase, CREDIT_DECIMALS)} if all land` });
      return true;
    }
    if (outcome.status === "requote") {
      toast({ id, kind: "error", title: "The price moved", description: `The same payout now costs ${money(outcome.stakeBase, CREDIT_DECIMALS)}. Check the new price and place again.` });
      return false;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    toast({ id, kind: "error", title: copy.headline, description: copy.body });
    return false;
  };

  return { place, busy: writes.busy === "open" };
}
