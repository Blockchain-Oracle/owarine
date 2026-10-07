"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * UGLYCASH's money gesture: drag the thumb to the end of the pill to confirm, so a trade is never one stray tap. The
 * thumb springs back if let go early. Keyboard and switch users press the thumb (Enter/Space) — the gesture is a
 * guard, not a gate. `state` is the caller's: idle → busy while the ledger answers → done.
 */
export interface SwipeToConfirmProps {
  label: string;
  onConfirm: () => void;
  state?: "idle" | "busy" | "done";
  doneLabel?: string;
  busyLabel?: string;
  tone?: "pink" | "black";
  disabled?: boolean;
  className?: string;
}

const THUMB = 56;
const PAD = 4;

export function SwipeToConfirm({ label, onConfirm, state = "idle", doneLabel = "Confirmed", busyLabel = "Confirming…", tone = "pink", disabled, className }: SwipeToConfirmProps) {
  const track = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(0);
  const x = useMotionValue(0);
  const reduce = useReducedMotion();
  const labelOpacity = useTransform(x, [0, Math.max(1, max * 0.6)], [1, 0]);
  const fill = useTransform(x, (v) => v + THUMB + PAD);
  const locked = state !== "idle" || disabled === true;

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setMax(Math.max(0, el.clientWidth - THUMB - PAD * 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    // Busy and done park the thumb at the end; a reset to idle brings it home.
    const to = state === "idle" ? 0 : max;
    if (reduce) x.set(to);
    else void animate(x, to, { type: "spring", stiffness: 520, damping: 42 });
  }, [state, max, reduce, x]);

  /** Judge the release by where the pointer went (and how fast), not the last painted frame: on a slow phone a quick
   * flick ends before the thumb has caught up. */
  const finish = (_: unknown, info: PanInfo) => {
    if (locked) return;
    const reached = Math.max(x.get(), info.offset.x);
    if (reached >= max * 0.86 || (reached >= max * 0.5 && info.velocity.x > 900)) {
      x.set(max);
      onConfirm();
    } else if (reduce) x.set(0);
    else void animate(x, 0, { type: "spring", stiffness: 600, damping: 38 });
  };

  const text = state === "busy" ? busyLabel : state === "done" ? doneLabel : label;
  const fillClass = tone === "pink" ? "bg-ow-pink" : "bg-ow-black";

  return (
    <div
      ref={track}
      data-state={state}
      // Inside a Sheet, Base UI's drawer would read this drag as a swipe to dismiss.
      data-base-ui-swipe-ignore=""
      className={cn("relative h-16 w-full touch-pan-y overflow-hidden rounded-full select-none", tone === "pink" ? "bg-ow-pink/15" : "bg-ow-recessed", disabled && "opacity-40", className)}
    >
      <motion.div aria-hidden className={cn("absolute inset-y-0 left-0 rounded-full", fillClass)} style={{ width: fill }} />
      <motion.span
        aria-live="polite"
        className={cn("ow-body pointer-events-none absolute inset-0 grid place-items-center pl-12 text-ow-cta font-bold", state === "idle" ? "text-ow-ink" : "text-ow-white")}
        style={state === "idle" ? { opacity: labelOpacity } : undefined}
      >
        {text}
      </motion.span>
      <motion.button
        type="button"
        aria-label={state === "idle" ? label : text}
        disabled={locked}
        drag={locked ? false : "x"}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragEnd={finish}
        onKeyDown={(e) => {
          if (locked || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          x.set(max);
          onConfirm();
        }}
        style={{ x, width: THUMB, height: THUMB, top: PAD, left: PAD }}
        className={cn(
          "absolute grid cursor-grab place-items-center rounded-full bg-ow-white text-ow-black outline-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ow-pink-ink",
          locked && "cursor-default",
        )}
      >
        {state === "busy" ? <LoaderCircle className="size-6 animate-spin" /> : state === "done" ? <Check className="size-6" strokeWidth={3} /> : <ArrowRight className="size-6" strokeWidth={2.75} />}
      </motion.button>
    </div>
  );
}
