import { CountdownRing } from "@/components/data/CountdownRing";
import { cn } from "@/lib/utils";
import { QUOTE_TTL_SEC, TICKET_CANTON } from "./copy";

const URGENT_AT_SEC = 5;

/**
 * The firm quote's 20 s (C-ADD-08) on the reference `CountdownRing`, urgent (accent) in the last five seconds, the
 * whole seconds in its middle. A screen reader hears the time held once, as a label, never each tick.
 */
export function QuoteRing({ remainingSec, totalSec = QUOTE_TTL_SEC, size = "md", className }: { remainingSec: number; totalSec?: number; size?: "sm" | "md"; className?: string }) {
  const left = Math.max(0, Math.ceil(remainingSec));
  return (
    <span className={cn("cx-ring", className)} data-size={size} role="img" aria-label={TICKET_CANTON.ring.held(left)}>
      <CountdownRing fraction={left / totalSec} urgent={left > 0 && left <= URGENT_AT_SEC} className="cx-ring-svg">
        <span className="cx-ring-sec" aria-hidden>
          {left}
        </span>
      </CountdownRing>
    </span>
  );
}
