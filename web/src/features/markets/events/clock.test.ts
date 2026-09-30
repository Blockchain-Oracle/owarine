import { describe, expect, it } from "vitest";
import { eventClockOf } from "./clock";

// Trading runs 10:00 to 11:00 (a 3600 s span); the clock is urgent for the last min(60, 0.4 x span) seconds.
const OPEN = 1_700_000_000;
const market = { tradingStartSec: OPEN, lockAtSec: OPEN + 3600 };
const at = (sec: number) => sec * 1000;

describe("the event hero's clock", () => {
  it("has no reading before the first client tick, and is not locked", () => {
    expect(eventClockOf(market, 0)).toMatchObject({ locked: false, state: null, urgent: false });
  });

  it("counts down to the lock, calm until the last minute", () => {
    const clock = eventClockOf(market, at(OPEN + 1800));
    expect(clock.locked).toBe(false);
    expect(clock.state?.remainingSec).toBe(1800);
    expect(clock.urgent).toBe(false);
  });

  it("turns urgent in the last minute of trading", () => {
    expect(eventClockOf(market, at(market.lockAtSec - 60)).urgent).toBe(true);
    expect(eventClockOf(market, at(market.lockAtSec - 61)).urgent).toBe(false);
  });

  it("stops at the lock: locked, no clock, never urgent", () => {
    for (const now of [market.lockAtSec, market.lockAtSec + 500]) {
      expect(eventClockOf(market, at(now))).toMatchObject({ locked: true, state: null, urgent: false });
    }
  });

  it("judges a short event against at least a minute", () => {
    const short = { tradingStartSec: OPEN, lockAtSec: OPEN + 20 };
    expect(eventClockOf(short, at(OPEN + 5)).spanSec).toBe(60);
  });
});
