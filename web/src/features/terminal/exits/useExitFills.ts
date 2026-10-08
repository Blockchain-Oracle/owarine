"use client";

import type { ExitWire } from "@owarine/markets";
import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";
import { playCloseOutcome } from "@/lib/sound/trade";
import { toast } from "../toasts";
import type { TerminalPosition } from "../useTerminalTrade";

/** The seat's own exit writes (arm, disarm, Close through it), so their effect is never announced as the venue's fill. */
const ownWrites = new Map<string, number>();
const OWN_WINDOW_MS = 20_000;
/** A vanished exit waits this long for its position to go too (positions read on their own clock). */
const SETTLE_MS = 45_000;
const keyOf = (marketId: string, side: string) => `${marketId}|${side}`;

export function markOwnExitWrite(marketId: string, side: string): void {
  ownWrites.set(keyOf(marketId, side), Date.now());
}

const whatFired = (x: ExitWire): string => (x.stop?.trailBps != null ? "Trailing stop hit" : x.stop ? "Stop hit" : "Take-profit hit");

/**
 * The venue fills an armed exit on its own (R2): the seat's exit goes, then (on the positions' next read) its position.
 * That is announced once, with Trail's sound, unless the seat itself just closed, disarmed or re-armed it. An exit that
 * went while its position stays (a partial fill keeps resting under the same ref; a cancel) is not announced.
 */
export function useExitFills(positions: readonly TerminalPosition[], exits: readonly ExitWire[]): void {
  const seen = useRef(new Map<string, { exit: ExitWire; asset: string }>());
  const vanished = useRef(new Map<string, { exit: ExitWire; asset: string; atMs: number }>());
  useEffect(() => {
    const nowMs = Date.now();
    const current = new Map<string, { exit: ExitWire; asset: string }>();
    for (const x of exits) current.set(x.exitRef, { exit: x, asset: positions.find((q) => q.marketId === x.marketId && q.side === x.side)?.asset ?? seen.current.get(x.exitRef)?.asset ?? "" });
    for (const [ref, before] of seen.current) {
      if (current.has(ref)) continue;
      const k = keyOf(before.exit.marketId, before.exit.side);
      if (nowMs - (ownWrites.get(k) ?? 0) < OWN_WINDOW_MS) continue;
      vanished.current.set(ref, { ...before, atMs: nowMs });
    }
    for (const [ref, v] of vanished.current) {
      const x = v.exit;
      const rearmed = exits.some((y) => y.marketId === x.marketId && y.side === x.side);
      const stillHeld = positions.some((q) => q.marketId === x.marketId && q.side === x.side);
      if (rearmed || nowMs - v.atMs > SETTLE_MS) {
        vanished.current.delete(ref);
        continue;
      }
      if (stillHeld || !v.asset) continue;
      vanished.current.delete(ref);
      playCloseOutcome(x.stop && x.stop.trailBps == null ? -1 : 1);
      haptic("close");
      toast({ kind: "success", title: `${whatFired(x)} · ${v.asset}`, description: "The venue sold it on the ledger at its bid, never below your floor." });
    }
    seen.current = current;
  }, [positions, exits]);
}
