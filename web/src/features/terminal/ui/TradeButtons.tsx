"use client";

import { ArrowDown, ArrowUp, ArrowUpRight, Info, LoaderCircle, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Tradash's two trade buttons (`a4`/`a6`). Flat: UP and DOWN, soft-tinted, no tap sound of their own (the open sound
 * answers). In a position on this Window: TRAIL (greyed until the move past break-even beats the trail distance, solid
 * while armed) and CLOSE. Cross-fades y 12 → 0 in 0.18 s on `[0.22, 1, 0.36, 1]`.
 */
export type TradeButtonsProps =
  | {
      mode: "flat";
      onUp: () => void;
      onDown: () => void;
      busy: "up" | "down" | null;
      disabled?: boolean;
      upSub?: string;
      downSub?: string;
      /** Parlay mode: the side this Window already has in the slip shows solid. */
      picked?: "up" | "down" | null;
      /** While the buttons are off: why, in one plain sentence (`why.ts`). */
      why?: string | null;
      className?: string;
    }
  | {
      mode: "open";
      trailActive: boolean;
      trailEligible: boolean;
      trailPct: number;
      /** R2: the trail is a resting exit on the ledger, filled by the venue even with this tab closed. */
      trailOnLedger?: boolean;
      onTrail: () => void;
      onClose: () => void;
      busy: "close" | "trail" | null;
      /** The Window stopped quoting: it pays at its close. */
      lockedText?: string | null;
      className?: string;
    };

const SLOT = "flex h-16 w-full items-center justify-center gap-2 rounded-full text-ow-lead font-extrabold tracking-[0.2em] transition-[transform,opacity,background-color] duration-150 active:scale-[0.97] disabled:pointer-events-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ow-pink-ink";

export function TradeButtons(props: TradeButtonsProps) {
  const reduce = useReducedMotion();
  const fade = reduce ? { initial: false as const } : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const } };
  const spin = <LoaderCircle className="size-5 animate-spin" />;
  return (
    <div className={cn("w-full", props.className)}>
      <AnimatePresence mode="wait" initial={false}>
        {props.mode === "flat" ? (
          <motion.div key="flat" className="grid grid-cols-2 gap-3" {...fade}>
            {props.disabled && props.why ? (
              <p role="status" className="col-span-2 flex items-start gap-2 rounded-ow-card bg-ow-recessed px-3 py-2.5 text-ow-caption text-ow-ink">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ow-muted" />
                <span>{props.why}</span>
              </p>
            ) : null}
            <button type="button" onClick={props.onUp} disabled={props.disabled || props.busy !== null} aria-pressed={props.picked === undefined ? undefined : props.picked === "up"} className={cn(SLOT, props.picked === "up" ? "ow-up-solid" : "ow-up-soft", "disabled:opacity-40")}>
              {props.busy === "up" ? spin : <ArrowUp className="size-5" strokeWidth={3} />}
              <span className="flex flex-col items-start leading-none">
                <span>UP</span>
                {props.upSub ? <span className="mt-1 text-ow-micro font-semibold tracking-normal opacity-80">{props.upSub}</span> : null}
              </span>
            </button>
            <button type="button" onClick={props.onDown} disabled={props.disabled || props.busy !== null} aria-pressed={props.picked === undefined ? undefined : props.picked === "down"} className={cn(SLOT, props.picked === "down" ? "ow-down-solid" : "ow-down-soft", "disabled:opacity-40")}>
              {props.busy === "down" ? spin : <ArrowDown className="size-5" strokeWidth={3} />}
              <span className="flex flex-col items-start leading-none">
                <span>DOWN</span>
                {props.downSub ? <span className="mt-1 text-ow-micro font-semibold tracking-normal opacity-80">{props.downSub}</span> : null}
              </span>
            </button>
          </motion.div>
        ) : (
          <motion.div key="open" className="grid grid-cols-2 gap-3" {...fade}>
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={props.onTrail}
                aria-pressed={props.trailActive}
                disabled={props.busy !== null || Boolean(props.lockedText) || (!props.trailActive && !props.trailEligible)}
                className={cn(SLOT, props.trailActive ? "ow-up-solid" : "ow-up-soft", "disabled:opacity-40")}
              >
                {props.busy === "trail" ? spin : <ArrowUpRight className="size-5" strokeWidth={3} />}
                {props.trailActive ? "TRAILING" : "TRAIL"}
              </button>
              <span className="text-ow-micro text-ow-muted">
                {props.lockedText ? "" : props.trailActive ? (props.trailOnLedger ? "On the ledger · fills with this tab closed" : "Only while this tab is open") : props.trailEligible ? "" : `Need +${trailWords(props.trailPct)}% past break-even`}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 self-start">
              <button type="button" onClick={props.onClose} disabled={props.busy !== null || Boolean(props.lockedText)} className={cn(SLOT, "ow-down-soft disabled:opacity-40")}>
                {props.busy === "close" ? spin : <X className="size-5" strokeWidth={3} />}
                CLOSE
              </button>
              {props.lockedText ? <span className="text-ow-micro text-ow-muted">{props.lockedText}</span> : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Tradash prints 0.1 % as "0.1" and 1 % as "1": one decimal under 1 %, none above. */
export const trailWords = (pct: number): string => (pct * 100).toFixed(pct * 100 < 1 ? 1 : 0);
