"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, LoaderCircle, Waves, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Odometer } from "./Odometer";

/**
 * Tradash's two buttons. Flat, they are UP and DOWN (with what each pays); once you are in, the same two slots morph
 * into TRAIL and CLOSE, and CLOSE carries your live PnL — the number you get if you tap it. One tap does the thing;
 * the caller owns the ledger call and passes `busy` while it is in flight.
 */
export type DirectionPillProps =
  | {
      mode: "flat";
      upSub?: ReactNode;
      downSub?: ReactNode;
      onUp: () => void;
      onDown: () => void;
      busy?: "up" | "down" | null;
      disabled?: boolean;
      className?: string;
    }
  | {
      mode: "open";
      /** Live PnL of the open position in dollars (exit value − cost), what Close pays over what you paid. */
      pnl: number;
      trailArmed: boolean;
      onTrail: () => void;
      onClose: () => void;
      busy?: "trail" | "close" | null;
      disabled?: boolean;
      className?: string;
    };

const SLOT = "relative flex h-16 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full font-ow-body text-ow-cta font-extrabold tracking-[-0.02em] transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ow-pink-ink";

export function DirectionPill(props: DirectionPillProps) {
  const reduce = useReducedMotion();
  const swap = reduce ? { initial: false as const } : { initial: { y: 18, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -18, opacity: 0 }, transition: { type: "spring" as const, duration: 0.26, bounce: 0.12 } };
  const spinner = <LoaderCircle className="size-5 animate-spin" />;

  return (
    <div data-slot="direction-pill" className={cn("flex gap-2", props.className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {props.mode === "flat" ? (
          <motion.div key="flat" className="flex flex-1 gap-2" {...swap}>
            <button type="button" onClick={props.onUp} disabled={props.disabled || props.busy != null} className={cn(SLOT, "bg-ow-up-line text-ow-white")}>
              {props.busy === "up" ? spinner : <ArrowUp className="size-5" strokeWidth={3} />}
              <span className="flex flex-col items-start leading-none">
                <span>UP</span>
                {props.upSub ? <span className="mt-1 text-ow-micro font-semibold opacity-85">{props.upSub}</span> : null}
              </span>
            </button>
            <button type="button" onClick={props.onDown} disabled={props.disabled || props.busy != null} className={cn(SLOT, "bg-ow-down-line text-ow-white")}>
              {props.busy === "down" ? spinner : <ArrowDown className="size-5" strokeWidth={3} />}
              <span className="flex flex-col items-start leading-none">
                <span>DOWN</span>
                {props.downSub ? <span className="mt-1 text-ow-micro font-semibold opacity-85">{props.downSub}</span> : null}
              </span>
            </button>
          </motion.div>
        ) : (
          <motion.div key="open" className="flex flex-1 gap-2" {...swap}>
            <button
              type="button"
              onClick={props.onTrail}
              aria-pressed={props.trailArmed}
              disabled={props.disabled || props.busy != null}
              className={cn(SLOT, "flex-[0.8]", props.trailArmed ? "bg-ow-pink text-ow-on-pink" : "bg-ow-recessed text-ow-ink")}
            >
              {props.busy === "trail" ? spinner : <Waves className="size-5" strokeWidth={2.75} />}
              {props.trailArmed ? "TRAILING" : "TRAIL"}
            </button>
            <button type="button" onClick={props.onClose} disabled={props.disabled || props.busy != null} className={cn(SLOT, "bg-ow-black text-ow-white")}>
              {props.busy === "close" ? spinner : <X className="size-5" strokeWidth={3} />}
              <span>CLOSE</span>
              <Odometer value={props.pnl} kind="pnl" decimals={2} className="text-ow-lead [--ow-up:var(--ow-up-on-black)] [--ow-down:var(--ow-down-on-black)]" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
