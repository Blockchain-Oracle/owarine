"use client";

import { postArmExit, postDisarmExit } from "@owarine/markets";
import type { MarketId } from "@owarine/core/types";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/kit";
import { diagnosisCopy } from "@/lib/copy";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { formatPrice } from "../../chart/engine";
import { priceOfE8, proceedsAt, STOP_FLOOR_TICKS, stopE8Of, stopOnLosingSide, takeProfitTicks } from "../../exits/plan";
import { markOwnExitWrite } from "../../exits/useExitFills";
import { toast } from "../../toasts";
import type { TerminalPosition } from "../../useTerminalTrade";

const tap = () => (playTrade("tap"), haptic("tap"));
const num = (base: bigint, decimals: number) => Number(base) / 10 ** decimals;

/**
 * Tradash's TP/SL sheet on Owarine (R2): a take-profit in credits of profit and a stop at a price, both one resting exit
 * on the ledger that the venue fills at its bid even with this tab closed. A take-profit never sells below the price that
 * pays it; a stop sells at the bid once the price crosses its level. A stop replaces a trailing stop (one stop a
 * position); a take-profit sits beside either.
 */
export function ExitSheet({ open, onClose, position, spot, onChanged }: {
  open: boolean;
  onClose: () => void;
  position: TerminalPosition | null;
  spot: number | null;
  onChanged: () => void;
}) {
  const exit = position?.exit ?? null;
  const decimals = position?.decimals ?? 6;
  const held = position ? (position.side === "up" ? position.balanceUpRaw : position.balanceDownRaw) : 0n;
  const [profit, setProfit] = useState("");
  const [stop, setStop] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || !position) return;
    // Opens on what the ledger holds now.
    const tp = exit?.takeProfitTicks ?? null;
    setProfit(tp === null ? "" : Math.max(0, num(proceedsAt(tp, held) - position.costBasisBase, decimals)).toFixed(2));
    setStop(exit?.stop && exit.stop.trailBps === null ? String(priceOfE8(exit.stop.stopE8)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position?.id]);

  if (!position) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="TP / SL">
        <p className="py-6 text-center text-ow-body text-ow-muted">This position is no longer open.</p>
      </Sheet>
    );
  }

  const profitBase = profit.trim() === "" ? null : BigInt(Math.round(Number(profit) * 10 ** decimals));
  const tpTicks = profitBase === null ? null : takeProfitTicks(position.costBasisBase, held, profitBase);
  const stopPrice = stop.trim() === "" ? null : Number(stop);
  const trailing = exit?.stop?.trailBps != null;
  const problem =
    profitBase !== null && (profitBase <= 0n || tpTicks === null) ? "That profit is more than this position can pay." :
    stopPrice !== null && !(stopPrice > 0) ? "Enter a price." :
    stopPrice !== null && spot !== null && !stopOnLosingSide(position.side, stopPrice, spot) ? `A stop sits ${position.side === "up" ? "below" : "above"} the price ($${formatPrice(spot)}).` :
    null;
  const nothing = tpTicks === null && stopPrice === null;
  // A take-profit alone is held to its own price by the ledger; a fixed stop sells at the bid; a kept trail keeps its floor.

  const save = async () => {
    tap();
    setBusy(true);
    markOwnExitWrite(position.marketId, position.side);
    try {
      const marketId = position.marketId as MarketId;
      const keepTrail = stopPrice === null && trailing && exit?.stop ? exit.stop : null;
      const r = nothing && !keepTrail
        ? await postDisarmExit({ marketId, side: position.side })
        : await postArmExit({
            marketId, side: position.side,
            floorTicks: keepTrail ? Math.min(exit!.floorTicks, tpTicks ?? 999) : STOP_FLOOR_TICKS,
            takeProfitTicks: tpTicks,
            stop: stopPrice !== null ? { stopE8: stopE8Of(position.side, stopPrice), trailBps: null } : keepTrail,
          });
      onChanged();
      if (r.ok && (r.value.kind === "confirmed" || r.value.kind === "gone")) {
        toast({ kind: "success", title: nothing ? `TP / SL off · ${position.asset}` : `TP / SL on the ledger · ${position.asset}`, description: nothing ? undefined : "The venue fills it at its bid, even with this tab closed." });
        onClose();
        return;
      }
      const d = r.ok ? ("diagnosis" in r.value ? r.value.diagnosis : null) : r.diagnosis;
      toast({ kind: "error", title: "TP / SL not saved", description: d ? diagnosisCopy(d.kind).headline : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  const field = "ow-num w-full rounded-ow-card bg-ow-recessed/60 px-4 py-3 text-ow-lead font-bold outline-none focus-visible:outline-2 focus-visible:outline-ow-pink-ink";
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`TP / SL · ${position.asset}`}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-ow-caption font-bold text-ow-muted">Take profit at</span>
          <span className="flex items-center gap-2">
            <input type="number" inputMode="decimal" min={0} step={0.01} placeholder="+ credits" value={profit} onChange={(e) => setProfit(e.target.value)} className={field} aria-label="Take profit, credits of profit" />
            <span className="shrink-0 text-ow-caption text-ow-muted">profit</span>
          </span>
          {tpTicks !== null ? <span className="text-ow-micro text-ow-muted">Sells when Close pays {num(proceedsAt(tpTicks, held), decimals).toFixed(2)} or more</span> : null}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-ow-caption font-bold text-ow-muted">Stop if {position.asset} {position.side === "up" ? "falls to" : "rises to"}</span>
          <input type="number" inputMode="decimal" min={0} step="any" placeholder={spot === null ? "price" : `$${formatPrice(spot)}`} value={stop} onChange={(e) => setStop(e.target.value)} className={field} aria-label="Stop price" />
          <span className="text-ow-micro text-ow-muted">{trailing && stopPrice === null ? "Your trailing stop stays on." : trailing ? "Replaces your trailing stop." : "Sells at the venue's bid once the price crosses it."}</span>
        </label>
        {problem ? <p className="text-ow-caption text-ow-down">{problem}</p> : null}
        <button type="button" disabled={busy || problem !== null} onClick={() => void save()} className={cn("h-12 w-full rounded-full font-bold disabled:opacity-40", nothing ? "bg-ow-recessed text-ow-ink" : "bg-ow-pink text-ow-on-pink")}>
          {busy ? "Saving…" : nothing ? (exit ? "Remove TP / SL" : "Nothing to save") : "Save on the ledger"}
        </button>
      </div>
    </Sheet>
  );
}
