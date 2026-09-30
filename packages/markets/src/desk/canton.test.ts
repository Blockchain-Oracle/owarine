import { createHash } from "node:crypto";
import { buyFloor, gate, rawFor, sellFloor, sellOracleValue, valueE6, type DeskGateInput } from "@agari/core/desk";
import { describe, expect, it } from "vitest";
import type { DeskMandateC } from "../ops/agents/decode";
import { deskAddressOf } from "../ops/agents/ids";
import {
  cantonChainHead, DESK_LOT_MULTIPLIER_E12, deskStateOf, GENESIS_HEAD_HEX, heldLotsBySymbol, lotPriceE8, lotsToRaw, lotValue, rawToLots, sealedOf, sellCounted, sellFloorOk, seriesOfSymbol, symbolOfMarket, symbolOfSeries, ticksOfLotPriceE8,
} from "./canton";
import { DESK_MINTS } from "./types";

const CASH_UNIT = 1000n;
const M = DESK_LOT_MULTIPLIER_E12;

describe("a lot is the pipeline's token (K-090)", () => {
  it("values lots through core's arithmetic exactly as the ledger's userStakeOf", () => {
    for (const [lots, ticks] of [[1n, 1], [3n, 620], [17n, 999], [250n, 437]] as const) {
      expect(valueE6(lotsToRaw(lots), M, lotPriceE8(ticks, CASH_UNIT))).toBe(lotValue(lots, ticks, CASH_UNIT));
      expect(rawFor(lotValue(lots, ticks, CASH_UNIT), M, lotPriceE8(ticks, CASH_UNIT))).toBe(lotsToRaw(lots));
      expect(rawToLots(lotsToRaw(lots))).toBe(lots);
      expect(ticksOfLotPriceE8(lotPriceE8(ticks, CASH_UNIT), CASH_UNIT)).toBe(ticks);
    }
  });

  it("reads a lot price back to ticks with integer division, floored, never a float", () => {
    expect(ticksOfLotPriceE8(lotPriceE8(620, CASH_UNIT) + 99_999n, CASH_UNIT)).toBe(620);
    expect(ticksOfLotPriceE8(0n, CASH_UNIT)).toBe(0);
    expect(() => ticksOfLotPriceE8(-1n, CASH_UNIT)).toThrow(RangeError);
  });

  it("core's sell value and floor agree with Mandate_Sell's 92 % floor on every lot value", () => {
    for (const [lots, ticks] of [[1n, 300], [2n, 360], [9n, 777], [40n, 1]] as const) {
      const value = sellOracleValue(lotsToRaw(lots), M, lotPriceE8(ticks, CASH_UNIT));
      expect(value).toBe(lotValue(lots, ticks, CASH_UNIT));
      const floor = sellFloor(value);
      // Lot values are multiples of the cash unit, so the floor is exact: core's floor passes the ledger, one under does not.
      expect(sellFloorOk(floor, value)).toBe(true);
      expect(sellFloorOk(floor - 1n, value)).toBe(false);
      expect(sellCounted(floor, value)).toBe(value);
      expect(sellCounted(value + 5n, value)).toBe(value + 5n);
    }
  });

  it("gates a buy at the ask against the Window's fair price: inside the 8 % band allowed, beyond it refused", () => {
    const fair = lotPriceE8(620, CASH_UNIT);
    const input = (askTicks: number): DeskGateInput => {
      const amountIn = lotValue(3n, askTicks, CASH_UNIT);
      return {
        side: "buy", amountIn, quoteOut: lotsToRaw(3n), tokenPriceE8: fair, multiplierE12: M, referenceE8: fair, maxPremiumBps: 1000, slippageBps: 200n,
        mandate: { perActionCapE6: 10_000_000n, dailyCapE6: 50_000_000n, spentTodayE6: 0n },
        desk: { paused: false, mode: 2, perActionCapE6: 10_000_000n, remainingDailyCapE6: 50_000_000n, cashE6: 100_000_000n, tokenBalanceRaw: 0n, configured: true, enabled: true, referenceFresh: true },
        gapBps: 0, costBps: 0, protective: false, position: null,
      };
    };
    expect(buyFloor(lotValue(3n, 640, CASH_UNIT), M, fair)).toBeLessThan(lotsToRaw(3n));
    expect(gate(input(640)).result).not.toBe("deny");
    expect(gate(input(700)).result).toBe("deny");
  });
});

describe("names, series and markets", () => {
  it("maps every company to its 60-minute series and back", () => {
    expect(seriesOfSymbol("SPACEX")).toBe("SPACEX-60m");
    expect(symbolOfSeries("OPENAI-60m")).toBe("OPENAI");
    expect(symbolOfSeries("BTC-5m")).toBeNull();
    expect(symbolOfMarket("ANTHROPIC-60m:42")).toBe("ANTHROPIC");
  });
});

describe("the mandate's hash chain", () => {
  it("reproduces PM.Agents.Desk.nextHead: sha256(prev ':' n ':' hash) over bare lowercase hex", () => {
    const h1 = createHash("sha256").update("decision 1").digest("hex");
    const want1 = createHash("sha256").update(`${GENESIS_HEAD_HEX}:1:${h1}`).digest("hex");
    expect(cantonChainHead(`0x${GENESIS_HEAD_HEX}`, 1n, `0x${h1.toUpperCase()}`)).toBe(`0x${want1}`);
    const h2 = createHash("sha256").update("decision 2").digest("hex");
    const want2 = createHash("sha256").update(`${want1}:2:${h2}`).digest("hex");
    expect(cantonChainHead(want1, 2, h2)).toBe(`0x${want2}`);
  });
});

const venue = "venue::1220aa";
const owner = "seat-1::1220bb";
const T0 = 1_790_856_000; // a UTC midnight

function mandate(over: Partial<DeskMandateC> = {}): DeskMandateC {
  return {
    venue, owner, operator: "agent-runner::1220cc",
    grant: {
      venue, owner, agent: "agent-runner::1220cc", caps: { maxStakePerTrade: 700_000n, maxDailySpend: 1_000_000n, maxPriceTicks: 0, maxOpenPositions: 24 },
      budget: 2_000_000n, expiresAtSec: T0 + 365 * 86_400, dayZeroSec: T0, day: 0, spentToday: 600_000n, positions: [],
    },
    allowList: ["SPACEX-60m", "OPENAI-60m"], maxPremiumBps: 500, attestors: ["o1::1220dd", "o2::1220ee", "o3::1220ff"], refQuorum: 2,
    mode: "DeskLive", paused: false, head: "ab".repeat(32), seq: 3,
    holdings: [
      { marketId: "SPACEX-60m:10", side: "SideUp", lots: 2n, refundAfterSec: T0 + 7_200 },
      { marketId: "SPACEX-60m:11", side: "SideUp", lots: 1n, refundAfterSec: T0 + 10_800 },
      { marketId: "ANTHROPIC-60m:9", side: "SideUp", lots: 4n, refundAfterSec: T0 + 3_600 },
    ],
    ...over,
  };
}

describe("DeskMandate → the reference's DeskState", () => {
  it("carries caps, today's spend, mode, pause, budget and live holdings", () => {
    const s = deskStateOf({ mandate: mandate(), offset: 77, nowSec: T0 + 3_600, mintOf: (x) => DESK_MINTS[x], marks: [
      { attestor: "o1::1220dd", venue, marketId: "SPACEX-60m:11", side: "SideUp", refTicks: 610, fetchedAtSec: T0 + 3_500 },
    ] });
    expect(s.address).toBe(deskAddressOf({ owner, venue, grant: { expiresAtSec: mandate().grant.expiresAtSec } }));
    expect([s.perActionCapE6, s.dailyCapE6, s.spentInWindowE6, s.remainingDailyCapE6]).toEqual([700_000n, 1_000_000n, 600_000n, 400_000n]);
    expect([s.mode, s.paused, s.seq, s.head, s.slot, s.usdc.raw]).toEqual(["on_its_own", false, 3n, `0x${"ab".repeat(32)}`, 77n, 2_000_000n]);
    // ANTHROPIC's Window reached refundAfter: it settled into the owner's seat and is no longer the desk's.
    const bySymbol = Object.fromEntries(s.tokens.map((t) => [t.symbol, [t.raw, t.enabled]]));
    expect(bySymbol).toEqual({ OPENAI: [0n, true], SPACEX: [lotsToRaw(3n), true] });
    expect(s.refs[DESK_MINTS.SPACEX as string]?.tokenPriceE8).toBe(lotPriceE8(610));
  });

  it("resets today's spend on a new day, reads shadow as practice and keeps the index's ask-first", () => {
    const next = deskStateOf({ mandate: mandate({ mode: "DeskShadow", paused: true }), offset: 1, nowSec: T0 + 86_400 + 5, mintOf: (x) => DESK_MINTS[x] });
    expect([next.spentInWindowE6, next.remainingDailyCapE6, next.windowStartSec, next.mode, next.paused]).toEqual([0n, 1_000_000n, T0 + 86_400, "practice", true]);
    expect(deskStateOf({ mandate: mandate(), offset: 1, nowSec: T0, mintOf: (x) => DESK_MINTS[x], indexMode: "ask_first" }).mode).toBe("ask_first");
    expect(heldLotsBySymbol(mandate(), T0).get("ANTHROPIC")).toBe(4n);
  });

  it("maps a sealed decision to the reference's seal", () => {
    const d = { venue, owner, operator: "op::1220aa", seq: 4, prevHead: "0".repeat(64), decisionHash: "cd".repeat(32), head: "ef".repeat(32), note: "", action: { kind: "sell" as const, marketId: "SPACEX-60m:11", side: "SideUp" as const, lots: 1n, priceTicks: 590, referenceTicks: 600, proceeds: 590_000n, counted: 600_000n } };
    expect(sealedOf(d)).toEqual({ kind: "Sold", seq: 4n, head: `0x${"ef".repeat(32)}`, decisionHash: `0x${"cd".repeat(32)}` });
  });
});
