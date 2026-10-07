import { countdown, type Countdown } from "@owarine/core/lifecycle";
import type { EventMarket } from "@owarine/core/types";

export interface EventClock {
  /** Trading has ended: the committee answers after the close. */
  locked: boolean;
  /** The trading span the urgency is judged against (a minute at least). */
  spanSec: number;
  /** The clock to the lock; null before the first client tick and once locked. */
  state: Countdown | null;
  /** The last stretch before the lock: the hero's clock block flips signal. */
  urgent: boolean;
}

/** The event hero's clock, one rule for web and the phone: it counts to the lock, and stops at it. */
export function eventClockOf(market: Pick<EventMarket, "lockAtSec" | "tradingStartSec">, nowMs: number): EventClock {
  const locked = nowMs > 0 && Math.floor(nowMs / 1000) >= market.lockAtSec;
  const spanSec = Math.max(60, market.lockAtSec - market.tradingStartSec);
  const state = nowMs > 0 && !locked ? countdown(nowMs, market.lockAtSec, spanSec) : null;
  return { locked, spanSec, state, urgent: state?.urgent ?? false };
}
