import { restingQuote } from "@owarine/core/orders";
import { describe, expect, it } from "vitest";
import { deriveScheduleBlocker, type ScheduleBlockerInput } from "./schedule-guards";

// A Canton Window's grid: 1 lot is 1,000,000 base contracts on a cash unit of 1,000 (min_lots 1, no seat bond).
const GRID = { lotBase: 1_000_000n, tickBase: 1_000n, cashUnit: 1_000n, minLots: 1n };
const sized = (stakeBase: bigint, priceCents = 55) => restingQuote({ side: "up", priceCents, stakeBase, grid: GRID, decimals: 6, quotedAtMs: 0 });
const READY: ScheduleBlockerInput = {
  session: { isConnected: true, isConnecting: false, isRightChain: true, address: null } as unknown as ScheduleBlockerInput["session"],
  hasSigner: true, placing: false, phase: "upcoming", lane: { basis: "regular", sessionOpen: false, halt: null, laneState: null },
  side: "up", priceCents: 55, stakeBase: 5_500_000n, availableBase: 12_000_000n, depositBase: 0n, sized: sized(5_500_000n), crossing: null, restingCount: 0, funding: null,
};

describe("the schedule button on a listed Window (a bilateral RestingCall on Canton)", () => {
  it("is open when the call is sized, funded and rests: the button no longer says resting calls are missing", () => {
    expect(deriveScheduleBlocker(READY)).toBeNull();
  });

  it("names the first thing that stops a call, in the taker's order", () => {
    expect(deriveScheduleBlocker({ ...READY, side: null })).toBe("no-side");
    expect(deriveScheduleBlocker({ ...READY, priceCents: 0 })).toBe("no-price");
    expect(deriveScheduleBlocker({ ...READY, stakeBase: 0n, sized: sized(0n) })).toBe("no-stake");
    // 0.30 credits does not buy one lot at 55¢ (a lot costs 0.55): the call's own minimum, not the taker's
    expect(deriveScheduleBlocker({ ...READY, stakeBase: 300_000n, sized: sized(300_000n) })).toBe("below-min-stake");
    expect(deriveScheduleBlocker({ ...READY, availableBase: 5_499_999n })).toBe("over-balance");
    expect(deriveScheduleBlocker({ ...READY, restingCount: 16 })).toBe("too-many-resting");
    expect(deriveScheduleBlocker({ ...READY, crossing: { otherSide: "down", otherCents: 45, maxCents: 54 } })).toBe("rest-would-cross");
  });

  it("holds the escrow against the balance exactly: the last credit is enough, one base less is not", () => {
    expect(deriveScheduleBlocker({ ...READY, availableBase: 5_500_000n })).toBeNull();
    expect(deriveScheduleBlocker({ ...READY, availableBase: 5_499_999n })).toBe("over-balance");
  });

  it("does not offer a call on a Window that is trading: the dock switches to the taker's ticket", () => {
    expect(deriveScheduleBlocker({ ...READY, phase: "trading" })).not.toBeNull();
  });
});
