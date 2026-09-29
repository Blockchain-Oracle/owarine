import { afterEach, describe, expect, it, vi } from "vitest";
import { readRecoveryCursor, syncClock } from "./clock-sync";

const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("the ledger clock over /api/venue/clock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("measures the server's clock against this device's and carries the ledger offset as the slot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    vi.stubGlobal("fetch", answer({ serverMs: 1_004_000, offset: 1332, recordTimeMs: 1_003_900 }));
    const clock = await syncClock();
    expect(clock.ok && clock.value).toEqual({ offsetMs: 4_000, rttMs: 0, slot: 1332 });
    const cursor = await readRecoveryCursor();
    expect(cursor.ok && cursor.value).toEqual({ fromSlot: 1332n });
  });

  it("is an honest error reading when the route cannot answer, and never a guessed clock", async () => {
    vi.stubGlobal("fetch", answer({ diagnosis: { kind: "not-deployed", retryable: false, technical: "no venue" } }, 503));
    const clock = await syncClock();
    expect(clock.ok).toBe(false);
    if (!clock.ok) expect(clock.error.kind).toBe("not-deployed");
    vi.stubGlobal("fetch", answer({ serverMs: 1, offset: null, recordTimeMs: null }));
    expect((await readRecoveryCursor()).ok).toBe(false);
  });
});
