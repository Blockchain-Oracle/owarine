"use client";

import type { EventMarket, LaneSet } from "@owarine/core/types";
import { ladderSnapshot } from "@owarine/markets/runtime";
import { useEffect, useMemo, type ReactNode } from "react";
import { TextTabs } from "@/components/kit";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { clockText } from "../format";
import type { TradeMode } from "../mode";
import { toast } from "../toasts";
import { TradeButtons } from "../ui/TradeButtons";
import { legNow, useLegFeeds } from "./feeds";
import { markOf, type ParlayMark } from "./ParlayRow";
import { ParlaySlip } from "./ParlaySlip";
import { estimateParlay } from "./price";
import { legOpen, rollSlip, setParlayOn, toggleLeg, useSlip } from "./slip";
import { usePlaceParlay, useScreenParlays, type ScreenParlay } from "./useParlays";

const CREDIT_DECIMALS = 6;
/** A parlay's own default stake: the reserve prices a leg over at least 10 contracts and caps a payout at 500. */
const PARLAY_STAKE_CREDITS = 5;
const cadence = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);

export interface TerminalParlay {
  /** Parlay mode: UP and DOWN add the Window on screen to the slip. */
  on: boolean;
  legCount: number;
  parlays: ScreenParlay[];
  marks: ReadonlyMap<string, ParlayMark>;
  /** Σ of the open tickets at fair value, their PnL against stake, and their stakes (credits). */
  value: number;
  pnl: number;
  staked: number;
  /** The slip card (the rail on desktop, the sheet on a phone), the Single · Parlay tabs, the phone's slip pill. */
  slip: ReactNode;
  tabs: ReactNode;
  pill: (onOpen: () => void) => ReactNode;
  /** The trade buttons in Parlay mode (add / flip / remove a leg); null in Single mode. */
  buttons: ReactNode | null;
}

/**
 * Plan 2c on the trading screen: the slip, priced off every leg's live ladder; the open tickets, marked at fair value on
 * the same feeds; legs rolled to the next Window when theirs can no longer join; one tap places the ticket.
 */
export function useTerminalParlay(ctx: {
  mode: TradeMode;
  address: string | null;
  nowSec: number;
  set: LaneSet | null;
  market: EventMarket | null;
  canAdd: boolean;
  cashBase: bigint | null;
  slippageBps: number;
  onNeedSeat: () => void;
  onAddMarket: () => void;
  onPlaced: () => void;
}): TerminalParlay {
  const { mode, nowSec, market } = ctx;
  const slip = useSlip();
  const allMarkets = useMemo(() => (ctx.set?.lanes ?? []).flatMap((l) => l.markets), [ctx.set]);
  const parlays = useScreenParlays(mode, ctx.address, nowSec);
  const feedVersion = useLegFeeds([...slip.legs, ...parlays.flatMap((p) => p.legs.filter((l) => l.status === "pending"))]);

  // A leg whose Window can no longer join a ticket moves to the next Window on its lane.
  useEffect(() => {
    if (!slip.legs.length) return;
    const ladder = (id: string) => ladderSnapshot(id)?.ladder;
    const quoting = (id: string) => {
      const l = ladder(id);
      return l !== undefined && l.state === "quoting" && nowSec <= l.quotingUntilSec;
    };
    const pastQuote = (id: string) => {
      const l = ladder(id);
      return l !== undefined && nowSec > l.quotingUntilSec;
    };
    for (const l of rollSlip(allMarkets, nowSec, quoting, pastQuote)) {
      toast({ kind: "info", title: `${l.asset} ${cadence(l.intervalSec)} moved to the next Window`, description: `Its Window was closing. This leg now closes at ${clockText(l.expirySec)}.` });
    }
  }, [nowSec, allMarkets, slip.legs]);

  const stakeCredits = slip.stakeCredits ?? PARLAY_STAKE_CREDITS;
  const stakeBase = BigInt(Math.round(stakeCredits * 10 ** CREDIT_DECIMALS));
  const estimate = useMemo(
    () =>
      estimateParlay(
        slip.legs.map((l) => {
          const now = legNow(l.marketId, l.asset);
          return { ladder: now.ladder, side: l.side, spotE8: now.spotE8 };
        }),
        stakeBase,
        nowSec,
      ),
    // `feedVersion` moves when any leg's ladder or spot does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slip.legs, stakeBase, nowSec, feedVersion],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const marks = useMemo(() => new Map(parlays.map((p) => [p.id, markOf(p, nowSec)])), [parlays, nowSec, feedVersion]);
  const placer = usePlaceParlay({ mode, availableBase: ctx.cashBase, slippageBps: ctx.slippageBps, onNeedSeat: ctx.onNeedSeat });

  const addLeg = (side: "up" | "down") => {
    if (!market) return;
    if (!legOpen(market, nowSec)) return void toast({ kind: "error", title: "Closes too soon for a parlay", description: `This ${cadence(market.intervalSec)} Window is nearly done. Add the next one when it opens.` });
    if (toggleLeg(market, side) === "full") return void toast({ kind: "error", title: "A parlay holds 3 markets", description: "Remove a leg to add this one." });
    playTrade("tap");
    haptic("tap");
  };
  const place = async () => {
    if (!estimate.ok || placer.busy) return;
    if (await placer.place(slip.legs, estimate.quote)) ctx.onPlaced();
  };

  const legHere = market ? (slip.legs.find((l) => l.marketId === market.marketId) ?? null) : null;
  const n = slip.legs.length;
  return {
    on: slip.on,
    legCount: n,
    parlays,
    marks,
    value: parlays.reduce((s, p) => s + (marks.get(p.id)?.value ?? 0), 0),
    pnl: parlays.reduce((s, p) => s + (marks.get(p.id)?.pnl ?? 0), 0),
    staked: parlays.reduce((s, p) => s + Number(p.stakeBase) / 10 ** CREDIT_DECIMALS, 0),
    slip: <ParlaySlip legs={slip.legs} estimate={estimate} stakeCredits={stakeCredits} nowSec={nowSec} busy={placer.busy} demo={mode === "demo"} onPlace={() => void place()} onAddMarket={ctx.onAddMarket} />,
    tabs: (
      <TextTabs
        label="How to trade"
        value={slip.on ? "parlay" : "single"}
        onChange={(v) => setParlayOn(v === "parlay")}
        tabs={[
          { value: "single", label: "Single" },
          {
            value: "parlay",
            label: (
              <span className="flex items-center gap-1.5">
                Parlay
                {n ? <span className="grid size-5 place-items-center rounded-full bg-ow-pink text-ow-micro text-ow-on-pink">{n}</span> : null}
              </span>
            ),
          },
        ]}
      />
    ),
    pill: (onOpen) => (
      <button type="button" onClick={onOpen} className="flex h-11 items-center justify-between gap-2 rounded-full bg-ow-card px-4 text-ow-caption font-bold">
        <span>{n === 0 ? "Parlay · tap UP or DOWN to add a leg" : `Parlay · ${n} leg${n === 1 ? "" : "s"}`}</span>
        <span className="text-ow-pink-ink">{estimate.ok ? `pays ${(estimate.quote.multiplierMilli / 1000).toFixed(2)}× →` : "open →"}</span>
      </button>
    ),
    buttons: slip.on ? (
      <TradeButtons
        mode="flat"
        onUp={() => addLeg("up")}
        onDown={() => addLeg("down")}
        busy={null}
        disabled={!ctx.canAdd}
        picked={legHere?.side ?? null}
        upSub={legHere?.side === "up" ? "in parlay ✓" : "add to parlay"}
        downSub={legHere?.side === "down" ? "in parlay ✓" : "add to parlay"}
      />
    ) : null,
  };
}
