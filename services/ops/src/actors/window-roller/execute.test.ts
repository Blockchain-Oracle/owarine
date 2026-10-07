import { addDays, calendarFromAlpaca, datesBetween, etDateOf, weekdayOfDate, type SessionCalendar } from "@owarine/core/market";
import type { ActiveContract, Command, LedgerClient } from "@owarine/ledger";
import { LedgerError } from "@owarine/ledger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VenueDeps } from "../../runtime/deps";
import { isCoreLane, planSeriesOf, refusalState, rollerPass, type RollerState } from "./execute";

const utc = (iso: string) => Date.parse(iso) / 1000;
const isoZ = (sec: number) => new Date(sec * 1000).toISOString().replace(".000Z", "Z");
const VENUE = "venue::1220";

/** NYSE weekdays around `atSec` (no holidays): what `SessionService` agrees with Alpaca. */
function calendarAt(atSec: number): SessionCalendar {
  const [from, to] = [addDays(etDateOf(atSec), -7), addDays(etDateOf(atSec), 14)];
  const rows = datesBetween(from, to).filter((d) => weekdayOfDate(d) < 5).map((date) => ({ date, open: "09:30", close: "16:00" }));
  return calendarFromAlpaca(rows, from, to);
}

/** A `TSLA-gap` Series as the ledger holds it (bootstrap-local's gap policy: RedStone, open print admitted until lock). */
function gapSeries(over: Record<string, unknown> = {}) {
  return {
    venue: VENUE, resolver: "resolver::1220", auditor: "auditor::1220", seriesKey: "TSLA-gap", symbol: "TSLA", anchor: "2026-09-10T00:00:00Z",
    cadenceSec: "604800", lockLeadSec: "0", settleGraceSec: "300", cashUnit: "1000", nextIndex: "0",
    oracles: ["o1::1220", "o2::1220", "o3::1220"], quorum: "2", maxDeviationBps: "100",
    policyVersions: [{
      version: "1", effectiveFrom: "2026-09-10T00:00:00Z", validUntil: null, printSource: "attested:redstone:TSLA", minDelaySec: "5", barLenSec: "1",
      openAdmissionSec: "-1", closeAdmissionSec: "900",
    }],
    lastExpiry: null,
    ...over,
  };
}

function fakeClient(series: Record<string, unknown>, submit: (commands: Command[]) => unknown) {
  const contract: ActiveContract = {
    synchronizerId: "sync",
    createdEvent: {
      offset: 1, nodeId: 0, contractId: "series-cid", templateId: "pkg:PM.Series:Series", packageName: "abu-pm-main", createArgument: series,
      witnessParties: [VENUE], signatories: [VENUE], "createdAt": "2026-09-16T00:00:00Z",
    },
  };
  return {
    activeContracts: async () => ({ contracts: [contract], activeAtOffset: 1, nextPageToken: undefined }),
    submitAndWaitForTransaction: async (req: { commands: Command[] }) => submit(req.commands),
  } as unknown as LedgerClient;
}

function state(client: LedgerClient): RollerState {
  return {
    venue: { role: "venue", party: VENUE, client, dryRun: false },
    settings: { leadSec: 120, gapLeadSec: 172_800, minTradableSec: 60, prelist: false, prelistCadencesSec: [], only: [] },
    counters: { opened: 0, skipped: 0, failed: 0 },
    last: new Map(),
  };
}

function deps(calendar: SessionCalendar): VenueDeps {
  return {
    sessions: { refresh: async () => "calendar fresh", calendar: () => calendar },
    events: { skips: () => [], multipliers: () => [] },
    halts: { board: () => ({}) },
    pythIndex: { usable: () => true },
    log: () => {},
  } as unknown as VenueDeps;
}

describe("window-roller on a Gap Series (engine 0.4.0 span open)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens the 09-18 Gap through Series_OpenWindowSpan at nextIndex with the planner's own Friday close, Sunday lock and Monday open", async () => {
    vi.setSystemTime(new Date("2026-09-17T20:00:00Z"));
    const sent: Command[][] = [];
    const client = fakeClient(gapSeries(), (commands) => {
      sent.push(commands);
      return { transaction: { events: [{ CreatedEvent: { contractId: "terms-cid", templateId: "pkg:PM.Market:MarketTerms", createArgument: {} } }] }, recovered: false };
    });
    const s = state(client);
    const out = await rollerPass(s, deps(calendarAt(utc("2026-09-17T20:00:00Z"))));
    expect(sent).toHaveLength(1);
    const ex = (sent[0]![0] as { ExerciseCommand: { choice: string; contractId: string; choiceArgument: Record<string, string> } }).ExerciseCommand;
    expect(ex.choice).toBe("Series_OpenWindowSpan");
    expect(ex.contractId).toBe("series-cid");
    expect(ex.choiceArgument).toEqual({ index: "0", "tradingStart": "2026-09-18T20:00:00Z", lockAt: "2026-09-21T00:00:00Z", "expiry": "2026-09-21T13:30:00Z" });
    expect((out.detail as { lanes: Record<string, string> }).lanes["TSLA-gap"]).toMatch(/^open #0 09-18 20:00Z–09-21 13:30Z v1/);
    expect(s.counters.opened).toBe(1);
  });

  it("reads lastExpiry: after the 09-18 Gap the next one is 09-25, still at nextIndex (no grid, no skip)", async () => {
    vi.setSystemTime(new Date("2026-09-24T20:00:00Z"));
    const sent: Command[][] = [];
    const series = gapSeries({ nextIndex: "1", lastExpiry: "2026-09-21T13:30:00Z" });
    const client = fakeClient(series, (commands) => {
      sent.push(commands);
      return { transaction: { events: [] }, recovered: true };
    });
    await rollerPass(state(client), deps(calendarAt(utc("2026-09-24T20:00:00Z"))));
    const ex = (sent[0]![0] as { ExerciseCommand: { choice: string; choiceArgument: Record<string, string> } }).ExerciseCommand;
    expect(ex.choice).toBe("Series_OpenWindowSpan");
    expect(ex.choiceArgument).toMatchObject({ index: "1", "tradingStart": "2026-09-25T20:00:00Z", "expiry": "2026-09-28T13:30:00Z" });
  });

  it("names the engine's span refusals on the lane instead of counting a failure", async () => {
    vi.setSystemTime(new Date("2026-09-17T20:00:00Z"));
    const client = fakeClient(gapSeries(), () => {
      throw new LedgerError({ kind: "rejected", path: "/v2/commands/submit-and-wait-for-transaction", status: 400, message: "Interpretation error: abu-pm/window-overlap: a Window cannot start before the last one expires" } as ConstructorParameters<typeof LedgerError>[0]);
    });
    const s = state(client);
    const out = await rollerPass(s, deps(calendarAt(utc("2026-09-17T20:00:00Z"))));
    expect((out.detail as { lanes: Record<string, string> }).lanes["TSLA-gap"]).toBe("refused: window-overlap, 09-18 20:00Z–09-21 13:30Z starts before the last Window's expiry");
    expect(s.counters.failed).toBe(0);
  });

  it("maps every refusal id the span open can raise", () => {
    expect(refusalState("abu-pm/bad-window-index", "x")).toBe("already opened: re-reading");
    expect(refusalState("abu-pm/bad-span", "x")).toMatch(/^refused: bad-span/);
    expect(refusalState("abu-pm/span-too-long", "x")).toMatch(/^refused: span-too-long/);
    expect(refusalState("abu-pm/window-overlap", "x")).toMatch(/^refused: window-overlap/);
    expect(refusalState("abu-pm/no-policy", "x")).toMatch(/^paused: no price-policy version/);
    expect(refusalState("abu-pm/something-else", "x")).toBeNull();
  });

  it("plans from the Series' lastExpiry, else the grid start of nextIndex (the engine's openFloor)", () => {
    const base = { venue: VENUE, resolver: "r", auditor: "a", seriesKey: "BTC-5m", symbol: "BTC", anchorSec: utc("2026-09-29T00:00:00Z"), cadenceSec: 300, lockLeadSec: 30, settleGraceSec: 300, cashUnit: 1000n, nextIndex: 4, oracles: [], quorum: 1, maxDeviationBps: 0, policyVersions: [] };
    expect(planSeriesOf({ ...base, lastExpirySec: null }).lastExpirySec).toBe(utc("2026-09-29T00:20:00Z"));
    expect(planSeriesOf({ ...base, lastExpirySec: utc("2026-09-29T01:00:00Z") }).lastExpirySec).toBe(utc("2026-09-29T01:00:00Z"));
    expect(isoZ(utc("2026-09-29T00:20:00Z"))).toBe("2026-09-29T00:20:00Z");
  });
});

describe("window-roller traffic governor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const trafficRefusal = () =>
    new LedgerError({ kind: "rejected", path: "/v2/commands/submit-and-wait-for-transaction", status: 400, message: "SEQUENCER_NOT_ENOUGH_TRAFFIC_CREDIT(9,0): AboveTrafficLimit(member = PAR::x, trafficCost = 4220)" } as ConstructorParameters<typeof LedgerError>[0]);

  it("a traffic refusal stands the optional lanes down for ten minutes", async () => {
    vi.setSystemTime(new Date("2026-09-17T20:00:00Z"));
    const client = fakeClient(gapSeries(), () => {
      throw trafficRefusal();
    });
    const s = state(client);
    await rollerPass(s, deps(calendarAt(utc("2026-09-17T20:00:00Z"))));
    expect(s.trafficTightUntilMs).toBe(Date.parse("2026-09-17T20:10:00Z"));
  });

  it("while it stands down, an optional lane sends nothing and says why", async () => {
    vi.setSystemTime(new Date("2026-09-17T20:00:00Z"));
    const sent: Command[][] = [];
    const client = fakeClient(gapSeries(), (commands) => (sent.push(commands), { transaction: { events: [] }, recovered: false }));
    const s = { ...state(client), trafficTightUntilMs: Date.parse("2026-09-17T20:05:00Z") };
    const out = await rollerPass(s, deps(calendarAt(utc("2026-09-17T20:00:00Z"))));
    expect(sent).toEqual([]);
    expect((out.detail as { lanes: Record<string, string> }).lanes["TSLA-gap"]).toBe("paused: traffic (core lanes only)");
    expect(out.why).toContain("traffic governor: core lanes only until 20:05Z");
  });

  it("keeps BTC and ETH Windows of five minutes or less as the core", () => {
    expect(isCoreLane({ symbol: "BTC", cadenceSec: 120 })).toBe(true);
    expect(isCoreLane({ symbol: "ETH", cadenceSec: 300 })).toBe(true);
    expect(isCoreLane({ symbol: "BTC", cadenceSec: 900 })).toBe(false);
    expect(isCoreLane({ symbol: "TSLA", cadenceSec: 300 })).toBe(false);
  });
});
