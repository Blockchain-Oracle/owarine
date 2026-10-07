"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { cn } from "@/lib/utils";
import type { FrameInfo } from "../chart/chart-engine";
import { CALLOUT_LIFETIME_MS, type CalloutTone } from "../feedback/reactions";

export interface ReactionOverlayHandle {
  callout(tone: CalloutTone, emoji: string, text: string): void;
  flash(favorable: boolean, mega: boolean): void;
  /** Called every chart frame: the callout stack follows the line's head. */
  frame(info: FrameInfo | null): void;
}

interface Shown {
  id: number;
  tone: CalloutTone;
  emoji: string;
  text: string;
}

/**
 * Tradash's reactions overlay `aX`: an inset edge glow for 0.9 s on a surge (green) or slump (red), and emoji callouts
 * that ride the price head — at most two, each living by its tone (good/bad 1.5 s, great 1.8 s, epic 2.2 s, warn 2.6 s),
 * springing in (bouncier for epic) and lifting out. Reduced motion: a plain fade.
 */
export function ReactionOverlay({ handle }: { handle: Ref<ReactionOverlayHandle> }) {
  const reduce = useReducedMotion();
  const head = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown[]>([]);
  const [flash, setFlash] = useState<{ id: number; favorable: boolean; mega: boolean } | null>(null);
  const seq = useRef(0);

  useImperativeHandle(handle, () => ({
    callout(tone, emoji, text) {
      const id = ++seq.current;
      setShown((s) => [...s, { id, tone, emoji, text }].slice(-2));
      setTimeout(() => setShown((s) => s.filter((x) => x.id !== id)), CALLOUT_LIFETIME_MS[tone]);
    },
    flash(favorable, mega) {
      const id = ++seq.current;
      setFlash({ id, favorable, mega });
      setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 900);
    },
    frame(info) {
      const el = head.current;
      if (el && info) el.style.transform = `translate3d(${info.headX}px, ${info.headY}px, 0)`;
    },
  }));

  useEffect(() => () => setShown([]), []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <AnimatePresence>
        {flash ? (
          <motion.div
            key={flash.id}
            className={cn("absolute inset-0", flash.favorable ? "ow-flash-up" : "ow-flash-down", flash.mega && "is-mega")}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6, 0] }}
            transition={{ duration: 0.9, times: [0, 0.15, 0.5, 1] }}
          />
        ) : null}
      </AnimatePresence>
      <div ref={head} className="absolute top-0 left-0 will-change-transform">
        <div className="absolute right-3 bottom-5 flex flex-col items-end gap-1">
          <AnimatePresence>
            {shown.map((c) => (
              <motion.div
                key={c.id}
                data-tone={c.tone}
                className="ow-callout whitespace-nowrap"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 14, rotate: c.tone === "epic" ? -8 : 0 }}
                animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.9 }}
                transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 520, damping: c.tone === "epic" ? 14 : 22 }}
              >
                <span className="mr-1 not-italic">{c.emoji}</span>
                {c.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
