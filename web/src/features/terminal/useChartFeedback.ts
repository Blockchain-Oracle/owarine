"use client";

import type { LivePnlView } from "@owarine/markets/react";
import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";
import { setMusicTense } from "@/lib/sound/music";
import { playAdverseStep, playComboStep, playSlump, playSurge } from "@/lib/sound/trade";
import type { ChartLevel, ChartOverlay, FrameInfo } from "./chart/LiveChart";
import { ReactionEngine } from "./feedback/reactions";
import { livePnlText } from "./format";
import type { ReactionOverlayHandle } from "./ui/ReactionOverlay";
import type { TerminalPosition } from "./useTerminalTrade";

const credits = (base: bigint) => Number(base) / 1e6;

/**
 * Everything the chart and the ear say about the position on screen: the chart overlay (written to a ref, read every
 * frame), the reaction engine at the commit rate with its sounds, haptics, flash and callouts (Tradash's dispatch
 * table), and the tense music at −5 %.
 */
export function useChartFeedback(input: {
  active: TerminalPosition | null;
  activeLive: LivePnlView | null;
  spot: number | null;
  spotSymbol: string;
  linePrice: number | null;
  breakEven: number | null;
  reactionsEnabled: boolean;
}) {
  const { active, activeLive, spot, spotSymbol, linePrice, breakEven, reactionsEnabled } = input;
  const filled = activeLive !== null && activeLive.fillableLots > 0n;

  // Locked (no exit to price it by): colour by what settlement would pay if the close were the spot now. A tie pays Up
  // (every Series writes `tieUp = True` into its terms, `Series.daml`), so Up wins at or above the Line, Down below it.
  const settlesWin = linePrice === null || spot === null ? null : active?.side === "up" ? spot >= linePrice : spot < linePrice;
  const overlay = useRef<ChartOverlay | null>(null);
  overlay.current = active
    ? {
        pnl: filled ? credits(activeLive.pnlBase) : settlesWin === false ? -1 : 0,
        pnlText: filled ? livePnlText(activeLive.pnlBase, active.decimals) : "locked",
        entry: active.entrySpot,
        levels: [
          ...(active.entrySpot ? [{ kind: "entry", price: active.entrySpot, label: "Entry" } satisfies ChartLevel] : []),
          ...(linePrice !== null ? [{ kind: "line", price: linePrice, label: "Line" } satisfies ChartLevel] : []),
          ...(breakEven !== null ? [{ kind: "breakeven", price: breakEven, label: "B/E" } satisfies ChartLevel] : []),
          ...(active.trailStop !== null ? [{ kind: "trail", price: active.trailStop, label: "Trail" } satisfies ChartLevel] : []),
        ],
      }
    : null;

  const reactions = useRef(new ReactionEngine());
  const overlayHandle = useRef<ReactionOverlayHandle>(null);
  const onFrame = useRef<((info: FrameInfo | null) => void) | null>(null);
  onFrame.current = (info) => overlayHandle.current?.frame(info);
  useEffect(() => reactions.current.reset(), [spotSymbol]);
  useEffect(() => {
    if (spot === null) return;
    const out = reactions.current.feed({
      t: performance.now(),
      price: spot,
      position: active && activeLive ? { key: active.id, side: active.side === "up" ? 1 : -1, pnl: credits(activeLive.pnlBase), margin: credits(active.costBasisBase), entry: active.entrySpot ?? spot, line: linePrice } : null,
    });
    for (const r of out) {
      if (r.kind === "step") {
        if (r.favorable) (playComboStep(r.count), haptic("move"));
        else if (r.count >= 2) playAdverseStep();
      } else if (r.kind === "surge") {
        if (r.favorable) (playSurge(r.mega), haptic(r.mega ? "mega" : "surge"));
        else (playSlump(), haptic("slump"));
        if (reactionsEnabled) overlayHandle.current?.flash(r.favorable, r.mega);
      } else {
        if (r.tone === "warn") haptic("warn");
        if (reactionsEnabled) overlayHandle.current?.callout(r.tone, r.emoji, r.text);
      }
    }
    // Fed once per committed price (5 Hz).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot]);

  const tense = active !== null && filled && active.costBasisBase > 0n ? Number(activeLive.pnlBase) / Number(active.costBasisBase) <= -0.05 : false;
  useEffect(() => setMusicTense(tense), [tense]);

  return { overlay, overlayHandle, onFrame };
}
