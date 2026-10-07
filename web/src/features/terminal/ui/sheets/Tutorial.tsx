"use client";

import { ArrowDown, ArrowUp, ArrowUpRight, ChevronLeft, LineChart, Waves, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { TOUR_STEPS, tourNetworkNote } from "./tour-copy";

const ICONS = [LineChart, ArrowUp, Waves, ArrowUpRight, X] as const;
const STEPS = TOUR_STEPS.map((step, i) => ({ ...step, icon: ICONS[i]! }));

/** The step illustrations: a line, the two buttons, a line with its PnL pill, a trailing stop, Close. Drawn here, no art. */
function Illustration({ step }: { step: number }) {
  const reduce = useReducedMotion();
  const path = "M8 120 C 50 110, 70 70, 110 80 S 170 40, 210 52 S 260 30, 292 26";
  return (
    <div className="relative h-44 w-72 overflow-hidden rounded-ow-card border border-ow-hairline bg-ow-card">
      {step === 1 ? (
        <div className="absolute inset-0 flex items-center justify-center gap-3">
          <span className="ow-up-soft flex h-12 w-28 items-center justify-center gap-1 rounded-full text-ow-body font-extrabold tracking-[0.15em]">
            <ArrowUp className="size-4" strokeWidth={3} /> UP
          </span>
          <span className="ow-down-soft flex h-12 w-28 items-center justify-center gap-1 rounded-full text-ow-body font-extrabold tracking-[0.15em]">
            <ArrowDown className="size-4" strokeWidth={3} /> DOWN
          </span>
        </div>
      ) : (
        <svg viewBox="0 0 300 150" className="absolute inset-0 h-full w-full" aria-hidden>
          {step === 3 ? <line x1="8" x2="292" y1="78" y2="78" stroke="var(--ow-up-line)" strokeDasharray="6 4" strokeWidth="1.5" /> : null}
          <motion.path
            d={path}
            fill="none"
            stroke="var(--ow-up-line)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: "easeInOut", repeat: reduce ? 0 : Infinity, repeatDelay: 0.8 }}
          />
          <circle cx="292" cy="26" r="4" fill="var(--ow-up-line)" />
        </svg>
      )}
      {step === 2 || step === 4 ? <span className="ow-num absolute top-3 right-3 rounded-full bg-ow-up-line px-2.5 py-1 text-ow-caption font-bold text-ow-black">+42</span> : null}
      {step === 3 ? <span className="ow-up-solid absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-ow-micro font-bold"><ArrowUpRight className="size-3" /> Trailing</span> : null}
      {step === 4 ? <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ow-ink px-3 py-1 text-ow-micro font-bold text-ow-inverse"><X className="size-3" /> Close</span> : null}
    </div>
  );
}

/**
 * Tradash's five-step tour `ax`: full screen, progress dashes, back (Skip on the first step), Skip; a drawn illustration,
 * "Step N", a title and a sentence; Next, and on the last step Try Demo / Take a seat.
 */
export function Tutorial({ open, onDone }: { open: boolean; onDone: (choice: "demo" | "live" | "skip") => void }) {
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();
  if (!open) return null;
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;
  const tap = () => (playTrade("tap"), haptic("tap"));
  const finish = (choice: "demo" | "live" | "skip") => {
    tap();
    setStep(0);
    onDone(choice);
  };
  return (
    <div role="dialog" aria-modal aria-label="How it works" className="fixed inset-0 z-[9600] flex flex-col bg-ow-canvas/95 backdrop-blur-xl">
      <header className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0rem)+1rem)]">
        <button type="button" onClick={() => (step === 0 ? finish("skip") : (tap(), setStep(step - 1)))} className="flex items-center gap-1 text-ow-caption text-ow-muted">
          <ChevronLeft className="size-4" />
          {step === 0 ? "Skip" : ""}
        </button>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-[width,background-color]", i === step ? "w-6 bg-ow-pink" : "w-1.5 bg-ow-hairline")} />
          ))}
        </div>
        <button type="button" onClick={() => finish("skip")} className="text-ow-caption text-ow-muted">
          Skip
        </button>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} className="flex flex-col items-center gap-4" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
            <Illustration step={step} />
            <span className="flex items-center gap-1.5 text-ow-micro font-bold tracking-[0.12em] text-ow-pink-ink">
              <s.icon className="size-3.5" /> STEP {step + 1}
            </span>
            <h2 className="ow-display text-ow-display">{s.title}</h2>
            <p className="max-w-sm text-ow-body text-ow-muted">{s.body}</p>
            <p className="max-w-sm text-ow-caption text-ow-helper">{tourNetworkNote()}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="flex flex-col gap-2 px-4 pb-[calc(env(safe-area-inset-bottom,0rem)+1rem)]">
        {last ? (
          <>
            <button type="button" onClick={() => finish("demo")} className="h-14 rounded-full bg-ow-pink text-ow-lead font-bold text-ow-on-pink">
              Try Demo
            </button>
            <button type="button" onClick={() => finish("live")} className="h-14 rounded-full bg-ow-ink text-ow-lead font-bold text-ow-inverse">
              Take a seat
            </button>
          </>
        ) : (
          <button type="button" onClick={() => (tap(), setStep(step + 1))} className="h-14 rounded-full bg-ow-pink text-ow-lead font-bold text-ow-on-pink">
            Next
          </button>
        )}
      </footer>
    </div>
  );
}
