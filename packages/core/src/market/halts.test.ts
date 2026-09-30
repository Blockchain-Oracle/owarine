import { describe, expect, it } from "vitest";
import { HALT_REASONS, type HaltReason } from "../types/session-lanes";
import { utc } from "./calendar.fixtures";
import {
  ALPACA_STALE_SEC, alpacaHaltReason, confirmHalt, HALT_ASSETS, haltLabel, haltWatchOf, PRESTOCKS_STALE_SEC, prestocksHaltReason, primarySourceAt, pythHaltReason, redstoneHaltReason, sourceHaltReason,
  tokenHaltReason, type HaltStreak, type SourceReads, type SourceVersion,
} from "./halts";

/** The archived TSLA trial tick at 2026-09-11 20:00:00Z (price 36,547,600 e−5): 50 bps is conf 182,738. */
const T = 1_789_156_800;
const tick = (conf: bigint, publishTimeSec = T) => ({ price: 36_547_600n, conf, publishTimeSec });

describe("pyth halts", () => {
  it("halts one unit past the policy's 50 bps, exactly as the chain refuses the print", () => {
    expect(pythHaltReason(tick(6_068n), T)).toBeNull();
    expect(pythHaltReason(tick(182_738n), T)).toBeNull();
    expect(pythHaltReason(tick(182_739n), T)).toBe("pyth-wide");
    expect(pythHaltReason({ price: 0n, conf: 0n, publishTimeSec: T }, T)).toBe("pyth-wide");
  });

  it("calls a tick older than 15 s stale, and staleness wins over width", () => {
    expect(pythHaltReason(tick(6_068n), T + 15)).toBeNull();
    expect(pythHaltReason(tick(6_068n), T + 16)).toBe("pyth-stale");
    expect(pythHaltReason(tick(999_999n), T + 16)).toBe("pyth-stale");
    expect(pythHaltReason(null, T)).toBe("pyth-stale");
  });
});

describe("alpaca and prestocks halts (C6f)", () => {
  it("halts a QQQ or VOO lane whose newest IEX trade is over 120 s old, or that has none", () => {
    expect(ALPACA_STALE_SEC).toBe(120);
    expect(alpacaHaltReason(T - 120, T)).toBeNull();
    expect(alpacaHaltReason(T - 121, T)).toBe("alpaca-stale");
    expect(alpacaHaltReason(null, T)).toBe("alpaca-stale");
  });

  it("keeps the threshold inside the print's own bound: a Window listed on a trade this old still finds one within 300 s of T", () => {
    // attested-read.ts ALPACA_MAX_STALE_SEC (300) and the roller's 120 s listing lead (plan.ts DEFAULT_LEAD_SEC).
    expect(ALPACA_STALE_SEC + 120).toBeLessThan(300);
  });

  it("halts a pre-IPO name or basket whose newest PreStocks read is over 60 s old, or that has none", () => {
    expect(PRESTOCKS_STALE_SEC).toBe(60);
    expect(prestocksHaltReason(T - 60, T)).toBeNull();
    expect(prestocksHaltReason(T - 61, T)).toBe("prestocks-stale");
    expect(prestocksHaltReason(null, T)).toBe("prestocks-stale");
  });
});

describe("redstone and token halts", () => {
  it("halts a RedStone feed whose newest package is over 60 s old", () => {
    expect(redstoneHaltReason(T - 60, T)).toBeNull();
    expect(redstoneHaltReason(T - 61, T)).toBe("redstone-stale");
    expect(redstoneHaltReason(null, T)).toBe("redstone-stale");
  });

  it("takes the issuer flag first, then three failed quotes in a row", () => {
    expect(tokenHaltReason(true, 5)).toBe("issuer-halt");
    expect(tokenHaltReason(false, 2)).toBeNull();
    expect(tokenHaltReason(null, 3)).toBe("quote-unavailable");
  });
});

describe("which source a ticker halts on", () => {
  // price-sources.json TSLA and QQQ versions.
  const tsla: SourceVersion[] = [
    { validFromSec: utc("2026-09-11T00:00:00Z"), validUntilSec: utc("2026-09-25T20:00:00Z"), primary: "pyth" },
    { validFromSec: utc("2026-09-25T20:00:00Z"), validUntilSec: null, primary: "redstone" },
  ];
  const qqq = tsla.slice(0, 1);

  const qqqAlpaca: SourceVersion[] = [...qqq, { validFromSec: utc("2026-09-29T00:00:00Z"), validUntilSec: null, primary: "alpaca" }];

  it("switches TSLA to RedStone at the 09-25 close and leaves QQQ with no source (paused, never halted) until its Alpaca version", () => {
    expect(primarySourceAt(tsla, utc("2026-09-25T19:59:59Z"))).toBe("pyth");
    expect(primarySourceAt(tsla, utc("2026-09-25T20:00:00Z"))).toBe("redstone");
    expect(primarySourceAt(qqq, utc("2026-09-25T20:00:00Z"))).toBe("pyth");
    expect(primarySourceAt(qqq, utc("2026-09-25T20:00:01Z"))).toBeNull();
    expect(primarySourceAt(tsla, utc("2026-09-10T23:59:59Z"))).toBeNull();
    expect(primarySourceAt(qqqAlpaca, utc("2026-09-27T12:00:00Z"))).toBeNull();
    expect(primarySourceAt(qqqAlpaca, utc("2026-09-29T14:00:00Z"))).toBe("alpaca");
  });

  const reads = (over: Partial<SourceReads> = {}): SourceReads => ({ pyth: tick(6_068n), redstoneNewestSec: T, alpacaNewestSec: T, prestocksNewestSec: T, ...over });

  it("reads only the primary: a wide Pyth tick or a stale RedStone package never halts a lane on another source", () => {
    const wideOldPyth = { price: 36_547_600n, conf: 36_547_600n, publishTimeSec: T - 3_600 };
    expect(sourceHaltReason("pyth", reads(), T)).toBeNull();
    expect(sourceHaltReason("redstone", reads({ redstoneNewestSec: null, pyth: wideOldPyth }), T)).toBe("redstone-stale");
    expect(sourceHaltReason("redstone", reads({ pyth: wideOldPyth, alpacaNewestSec: null, prestocksNewestSec: null }), T)).toBeNull();
    expect(sourceHaltReason("alpaca", reads({ pyth: wideOldPyth, redstoneNewestSec: null }), T)).toBeNull();
    expect(sourceHaltReason("alpaca", reads({ alpacaNewestSec: T - 121 }), T)).toBe("alpaca-stale");
    expect(sourceHaltReason("prestocks", reads({ prestocksNewestSec: T - 61 }), T)).toBe("prestocks-stale");
    expect(sourceHaltReason("basket", reads({ prestocksNewestSec: T - 61 }), T)).toBe("prestocks-stale");
  });

  it("judges nothing for a lane with no source, or a source with no rule here (the exchanges, Jupiter, a valuation index)", () => {
    const none = reads({ pyth: null, redstoneNewestSec: null, alpacaNewestSec: null, prestocksNewestSec: null });
    for (const primary of [null, "exchanges", "jupiter", "switchboard", "pyth-index", "committee"] as const) expect(sourceHaltReason(primary, none, T)).toBeNull();
  });
});

describe("which assets halt-watch covers", () => {
  it("watches the stocks and ETFs in session, the xStocks, pre-IPO names and baskets at every hour, and no crypto or valuation lane", () => {
    expect(haltWatchOf("TSLA")).toBe("session");
    expect(haltWatchOf("QQQ")).toBe("session");
    expect(haltWatchOf("TSLAx")).toBe("always");
    expect(haltWatchOf("OPENAI")).toBe("always");
    expect(haltWatchOf("AILABS")).toBe("always");
    expect(haltWatchOf("BTC")).toBeNull();
    expect(haltWatchOf("OPENAIV")).toBeNull();
    expect(HALT_ASSETS).toContain("VOO");
    expect(HALT_ASSETS).not.toContain("ETH");
  });
});

describe("confirming a halt", () => {
  const run = (observations: Array<HaltReason | null>) => {
    let state: { confirmed: HaltReason | null; streak: HaltStreak | null } = { confirmed: null, streak: null };
    return observations.map((observed) => (state = confirmHalt(state.confirmed, state.streak, observed)).confirmed);
  };

  it("needs two observations in a row to set or clear, and one for the issuer's flag", () => {
    expect(run(["pyth-wide", null, "pyth-wide", "pyth-wide", null, "pyth-wide", null, null])).toEqual([null, null, null, "pyth-wide", "pyth-wide", "pyth-wide", "pyth-wide", null]);
    expect(run(["pyth-wide", "pyth-stale", "pyth-stale"])).toEqual([null, null, "pyth-stale"]);
    expect(run(["issuer-halt", null, null])).toEqual(["issuer-halt", "issuer-halt", null]);
  });
});

it("says Trading halted only for a wide Pyth confidence or the issuer's flag (Q-S6-9)", () => {
  expect(Object.fromEntries(HALT_REASONS.map((r) => [r, haltLabel(r)]))).toEqual({
    "pyth-wide": "Trading halted",
    "pyth-stale": "Signed price stale",
    "redstone-stale": "Signed price stale",
    "alpaca-stale": "Signed price stale",
    "prestocks-stale": "Signed price stale",
    "issuer-halt": "Trading halted",
    "quote-unavailable": "Signed price stale",
  });
});
