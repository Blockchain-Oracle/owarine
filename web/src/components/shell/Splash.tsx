"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Seal } from "@/components/kit";
import { markSplashDone } from "@/lib/splash";

/** Held at least this long, so it never flickers; gone by the cap whatever is still loading (Tradash's 1.4 s / 3.5 s). */
const MIN_MS = 1_400;
const MAX_MS = 3_500;
/** Waiters are released by this time even if the fade never reports its end. */
const RELEASE_MS = 5_000;
const LOOP = { duration: 1.8, repeat: Infinity, ease: "easeInOut" } as const;
/** A rising close, seven prints, in the 160 × 44 box. */
const PATH = "M4 36 L26 28 L50 32 L72 18 L98 24 L122 10 L156 13";

function Sparkline() {
  return (
    <svg width="160" height="44" viewBox="0 0 160 44" fill="none" className="overflow-visible text-ow-pink" role="img" aria-label="Loading">
      <defs>
        <linearGradient id="ow-splash-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={`${PATH} L156 44 L4 44 Z`} fill="url(#ow-splash-fill)" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={LOOP} />
      <motion.path d={PATH} stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0, opacity: 0.4 }} animate={{ pathLength: [0, 1, 1], opacity: [0.4, 1, 0.4] }} transition={LOOP} />
      <motion.circle cx={156} cy={13} r={4} fill="currentColor" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.6, 0.6, 1, 1, 0.6] }} transition={LOOP} />
    </svg>
  );
}

/**
 * Tradash's splash on the first load of any app route (never on the landing page): the 終値 seal settles in and a
 * sparkline draws while the page loads; it lifts once the window has loaded and 1.4 s have passed, or at 3.5 s.
 */
export function Splash() {
  const pathname = usePathname();
  const skip = pathname === "/";
  const [shown, setShown] = useState(!skip);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (skip) {
      setShown(false);
      markSplashDone();
      return;
    }
    const started = performance.now();
    let lifted = false;
    const lift = () => {
      if (lifted) return;
      lifted = true;
      window.setTimeout(() => setShown(false), Math.max(0, MIN_MS - (performance.now() - started)));
    };
    if (document.readyState === "complete") lift();
    else window.addEventListener("load", lift, { once: true });
    const cap = window.setTimeout(lift, MAX_MS);
    const release = window.setTimeout(markSplashDone, RELEASE_MS);
    return () => {
      window.removeEventListener("load", lift);
      window.clearTimeout(cap);
      window.clearTimeout(release);
    };
    // The splash belongs to the first load only; later navigations don't bring it back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence onExitComplete={markSplashDone}>
      {shown ? (
        <motion.div key="splash" className="fixed inset-0 z-[9900] flex flex-col items-center justify-center bg-ow-canvas" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: "easeInOut" }}>
          <motion.div initial={reduce ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col items-center gap-3">
            <Seal size={96} />
            <span className="font-ow-display text-ow-title font-black tracking-[0.08em]">OWARINE</span>
          </motion.div>
          <div className="mt-7">{reduce ? null : <Sparkline />}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
