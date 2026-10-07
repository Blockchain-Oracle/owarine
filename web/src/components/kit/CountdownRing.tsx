"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Time left in a Window as a draining ring with the seconds inside. Ticks on its own each second; the ring turns pink
 * inside the last tenth of the Window so the close never sneaks up.
 */
export function CountdownRing({ startMs, endMs, size = 44, className }: { startMs: number; endMs: number; size?: number; className?: string }) {
  // null until mounted: the server cannot know the client's clock, so the first paint is a full ring.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const span = Math.max(1, endMs - startMs);
  const left = now === null ? span : Math.max(0, endMs - now);
  const frac = Math.min(1, left / span);
  const r = 18;
  const c = 2 * Math.PI * r;
  const urgent = frac < 0.1;
  return (
    <span role="timer" aria-label={`${formatLeft(left)} left`} className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--ow-hairline)" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={urgent ? "var(--ow-pink)" : "var(--ow-ink)"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
        />
      </svg>
      <span className="ow-num absolute text-ow-micro font-bold">{formatLeft(left)}</span>
    </span>
  );
}

export function formatLeft(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}h`;
  if (s >= 60) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return `${s}s`;
}
