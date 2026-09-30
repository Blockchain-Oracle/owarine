import type { DeskRow } from "@agari/db";
import type { Ladder } from "@agari/markets/runtime";
import { describe, expect, it, vi } from "vitest";
import { wakesDue } from "./index";
import { hourCheckWaitsFor, HOUR_WINDOWS_GRACE_SEC } from "./schedule";
import type { RunnerContext } from "./types";

/**
 * C8i records 5 and 6: the live desk's 06:00 and 07:00 checks ran seconds before the roller opened the hour's pre-IPO
 * Windows, and read "could not price OpenAI and Anthropic". The hour's check now waits for those Windows (K-230).
 */
const H6 = 1_790_748_000; // 2026-09-30T06:00:00Z
const window = (symbol: string, startSec: number, state = "quoting"): Ladder =>
  ({
    marketId: `${symbol}-${startSec}`, damlMarketId: `${symbol}-60m:${startSec}`, seriesId: "s", termsCid: "00terms", seriesKey: `${symbol}-60m`, symbol, index: 1,
    tradingStartSec: startSec, lockAtSec: startSec + 3_480, expirySec: startSec + 3_600, quotingUntilSec: startSec + 3_480, cashUnit: 1000n, feeRateBps: 100, fairTicks: 562,
    up: [[592, 200n]], down: [[468, 200n]], asOfMs: 0, state,
  }) as unknown as Ladder;

describe("a live desk's hour check waits for the hour's Windows (C8j.1, K-230)", () => {
  it("waits while a name has no quoting Window for the hour, and runs once every name's is quoting", () => {
    const names = ["OPENAI", "ANTHROPIC"] as const;
    // 06:00:04: the 05:00 Windows stopped quoting at 05:58 and the roller has not opened 06:00 yet.
    expect(hourCheckWaitsFor({ ladders: [], names, hourSec: H6, nowSec: H6 + 4 })).toEqual(["OPENAI", "ANTHROPIC"]);
    // 06:00:30: OpenAI's is open, Anthropic's opening print is not in yet.
    expect(hourCheckWaitsFor({ ladders: [window("OPENAI", H6)], names, hourSec: H6, nowSec: H6 + 30 })).toEqual(["ANTHROPIC"]);
    // 06:00:50: both quoting.
    expect(hourCheckWaitsFor({ ladders: [window("OPENAI", H6), window("ANTHROPIC", H6)], names, hourSec: H6, nowSec: H6 + 50 })).toEqual([]);
  });

  it("does not take the last hour's Window, or a closed one, for this hour's", () => {
    const last = window("OPENAI", H6 - 3_600);
    expect(hourCheckWaitsFor({ ladders: [last], names: ["OPENAI"], hourSec: H6, nowSec: H6 + 5 })).toEqual(["OPENAI"]);
    expect(hourCheckWaitsFor({ ladders: [window("OPENAI", H6, "closed")], names: ["OPENAI"], hourSec: H6, nowSec: H6 + 5 })).toEqual(["OPENAI"]);
  });

  it("runs anyway once the grace is over, so a lane the roller never opened is still checked and named", () => {
    expect(hourCheckWaitsFor({ ladders: [], names: ["OPENAI"], hourSec: H6, nowSec: H6 + HOUR_WINDOWS_GRACE_SEC - 1 })).toEqual(["OPENAI"]);
    expect(hourCheckWaitsFor({ ladders: [], names: ["OPENAI"], hourSec: H6, nowSec: H6 + HOUR_WINDOWS_GRACE_SEC })).toEqual([]);
  });
});

describe("the runner's wakes around the top of the hour (C8j.1)", () => {
  const desk = (mode: DeskRow["mode"]): DeskRow =>
    ({ id: "22222222-2222-4222-8222-222222222222", address: mode === "practice" ? null : "desk::1220aa", mode, state: "active" }) as unknown as DeskRow;

  function ctxAt(ladders: Ladder[]) {
    const claimWake = vi.fn(async (i: { scheduledForSec: number; trigger: string }) => ({ id: `${i.trigger}-${i.scheduledForSec}` }));
    const q = {
      takeRequestedWake: async () => null,
      claimWake,
      latestSnapshot: async () => ({ takenAtSec: H6 - 3_600, usdcE6: "10000000", holdings: [{ symbol: "ANTHROPIC", raw: "5000000" }] }),
      currentMandate: async () => ({ body: { targets: { cashBps: 2_000, tokens: [{ symbol: "OPENAI", weightBps: 8_000 }] } } }),
      getPaper: async () => null,
    };
    const ctx = { q, ladders: async () => ladders, feed: { history: () => [] }, log: () => undefined } as unknown as RunnerContext;
    return { ctx, claimWake };
  }

  it("a live desk leaves the hour unclaimed until its target's and its holding's Windows quote, then claims 06:00", async () => {
    const early = ctxAt([window("OPENAI", H6)]);
    const before = await wakesDue(early.ctx, desk("on_its_own"), H6 + 5);
    expect(before).toEqual({ due: [], waitingFor: ["ANTHROPIC"] });
    expect(early.claimWake).not.toHaveBeenCalled();

    const open = ctxAt([window("OPENAI", H6), window("ANTHROPIC", H6)]);
    const after = await wakesDue(open.ctx, desk("on_its_own"), H6 + 65);
    expect(after.waitingFor).toEqual([]);
    expect(after.due).toEqual([{ trigger: "hour", scheduledForSec: H6, wakeId: `hour-${H6}` }]);
  });

  it("a practice desk prices at the feed and checks on the hour, Windows or not", async () => {
    const { ctx, claimWake } = ctxAt([]);
    const r = await wakesDue(ctx, desk("practice"), H6 + 5);
    expect(r.waitingFor).toEqual([]);
    expect(r.due.map((d) => d.trigger)).toEqual(["hour"]);
    expect(claimWake).toHaveBeenCalledTimes(1);
  });
});
