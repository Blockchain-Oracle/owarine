import { afterEach, describe, expect, it, vi } from "vitest";
import { healthBody } from "../http/health";
import { runActor } from "./actor";

describe("runActor heartbeat interval", () => {
  afterEach(() => vi.useRealTimers());

  it("a pass that rests longer than its loop keeps /health ok through the rest", async () => {
    vi.useFakeTimers();
    const actor = runActor({ name: "idle-test", log: () => undefined, dryRun: false, everyMs: 15_000, pass: async () => ({ why: "unconfigured", nextDelayMs: 10 * 60_000 }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.beat.everyMs).toBe(10 * 60_000);
    // Seven minutes into the ten-minute rest: past the 5-minute floor, still not silent.
    expect(healthBody(undefined, Date.now() + 7 * 60_000).ok).toBe(true);
    actor.stop();
  });

  it("an ordinary pass keeps its own interval", async () => {
    vi.useFakeTimers();
    const actor = runActor({ name: "busy-test", log: () => undefined, dryRun: false, everyMs: 15_000, pass: async () => ({ why: "ok" }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.beat.everyMs).toBe(15_000);
    actor.stop();
  });
});

describe("runActor wake", () => {
  afterEach(() => vi.useRealTimers());

  it("cuts a rest short, and a wake during a pass skips the next rest", async () => {
    vi.useFakeTimers();
    let passes = 0;
    let release: (() => void) | null = null;
    const actor = runActor({
      name: "wake-test", log: () => undefined, dryRun: false, everyMs: 60_000,
      pass: () => (++passes === 2 ? new Promise((r) => (release = () => r({ why: "slow" }))) : Promise.resolve({ why: "ok" })),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(passes).toBe(1);
    actor.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(passes).toBe(2);
    // Woken while pass 2 is still running: pass 3 follows it at once, not 60 s later.
    actor.wake();
    release!();
    await vi.advanceTimersByTimeAsync(0);
    expect(passes).toBe(3);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(passes).toBe(3);
    actor.stop();
  });
});
