"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An endless row (21st.dev "Logo Marquee" by grootstudio, its motion-primitives `InfiniteSlider`, adapted): the children
 * twice, slid by one copy's measured width at a constant speed, slowing (not stopping) under the pointer. Measured with
 * a ResizeObserver instead of `react-use-measure`; with reduced motion it stands still and scrolls by hand instead.
 */
export const InfiniteSlider = memo(function InfiniteSlider({
  children,
  gapRem = 1,
  duration = 40,
  durationOnHover,
  reverse = false,
  className,
}: {
  children: ReactNode;
  gapRem?: number;
  /** Seconds for one copy to pass. */
  duration?: number;
  durationOnHover?: number;
  reverse?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(duration);
  const [easing, setEasing] = useState(false);
  const [cycle, setCycle] = useState(0);
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.scrollWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || width === 0) return;
    const gapPx = gapRem * parseFloat(getComputedStyle(document.documentElement).fontSize);
    const span = (width + gapPx) / 2;
    const from = reverse ? -span : 0;
    const to = reverse ? 0 : -span;
    const controls = easing
      ? animate(x, [x.get(), to], { ease: "linear", duration: current * Math.abs((x.get() - to) / span), onComplete: () => (setEasing(false), setCycle((c) => c + 1)) })
      : animate(x, [from, to], { ease: "linear", duration: current, repeat: Infinity, repeatType: "loop", onRepeat: () => x.set(from) });
    return () => controls.stop();
  }, [cycle, x, current, width, gapRem, easing, reverse, reduce]);

  const hover = durationOnHover && !reduce
    ? { onHoverStart: () => (setEasing(true), setCurrent(durationOnHover)), onHoverEnd: () => (setEasing(true), setCurrent(duration)) }
    : {};

  return (
    <div className={cn(reduce ? "overflow-x-auto" : "overflow-hidden", className)}>
      <motion.div ref={track} className="flex w-max" style={{ x: reduce ? 0 : x, gap: `${gapRem}rem` }} {...hover}>
        {children}
        <div aria-hidden inert className="flex" style={{ gap: `${gapRem}rem` }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
});
