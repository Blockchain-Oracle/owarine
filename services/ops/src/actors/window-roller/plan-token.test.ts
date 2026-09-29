import { describe, expect, it } from "vitest";
import type { PlanClock, PlanSeries } from "./plan";
import { planTokenSeries } from "./plan-token";
import type { VersionWindow } from "./versions";

// Sat 2026-09-19 14:00:00Z: a weekend, when only the token lane trades.
const SAT = 1_789_826_400;
const V1: VersionWindow[] = [{ validFromSec: 1_789_430_400, validUntilSec: null, primarySource: 3, checkSource: 0, openAdmissionSec: 60, checkAdmissionSec: 0, primaryFeedIdHex: "" }];

const series = (over: Partial<PlanSeries> = {}): PlanSeries => ({
  key: "TSLAx-5m", symbol: "TSLA", cadenceSec: 300, maxLeadSec: 400_000, nextIndex: 4n, lastExpirySec: 0, versions: V1, freeBooks: ["BookA", "BookB"], ...over,
});
const clock = (nowSec: number, over: Partial<PlanClock> = {}): PlanClock => ({
  calendar: null, nowSec, leadSec: 120, gapLeadSec: 172_800, minTradableSec: 60, skips: [], multipliers: [], halts: {}, prelist: true, prelistCadencesSec: [300, 900, 3_600], pythUsable: () => true, ...over,
});

describe("window-roller token plan", () => {
  it("lists back-to-back 24/7 without a calendar, Intraday on both boundaries", () => {
    const plan = planTokenSeries(series({ lastExpirySec: SAT }), clock(SAT - 100));
    expect(plan).toMatchObject({ kind: "open", index: 4n, policyVersion: 0, openKind: 0, closeKind: 0, book: "BookA", state: "opening #4 14:00–14:05Z v1 switchboard" });
    expect(planTokenSeries(series({ lastExpirySec: SAT }), clock(SAT - 600))).toMatchObject({ kind: "wait", wakeSec: SAT - 120, state: "waiting: next 14:00–14:05Z" });
  });

  it("after downtime opens the current Window only while its opening print is still admissible (T + 60 − 45 s)", () => {
    const current = planTokenSeries(series({ lastExpirySec: SAT - 3_600 }), clock(SAT + 15));
    expect(current.kind === "open" && current.window.tradingStartSec).toBe(SAT);
    const late = planTokenSeries(series({ lastExpirySec: SAT - 3_600 }), clock(SAT + 16));
    expect(late).toMatchObject({ kind: "wait", wakeSec: SAT + 180 });
    expect(late.kind === "wait" && late.window.tradingStartSec).toBe(SAT + 300);
  });

  it("waits for a Window already listed ahead and aligns 60m to the hour", () => {
    expect(planTokenSeries(series({ lastExpirySec: SAT + 900 }), clock(SAT))).toMatchObject({ kind: "wait", wakeSec: SAT + 780 });
    const hour = planTokenSeries(series({ key: "TSLAx-60m", cadenceSec: 3_600 }), clock(SAT - 1_800));
    expect(hour.kind === "wait" && hour.window.tradingStartSec).toBe(SAT);
  });

  it("pauses on an xStock halt (not the ticker's), a token-lane skip or a multiplier change inside the span; other lanes' skips don't apply", () => {
    const at = clock(SAT - 60);
    expect(planTokenSeries(series(), { ...at, halts: { TSLAx: { reason: "issuer-halt", sinceSec: SAT - 900 } } }).state).toBe("paused: halted (issuer-halt)");
    expect(planTokenSeries(series(), { ...at, halts: { NVDAx: { reason: "quote-unavailable", sinceSec: SAT } } }).kind).toBe("open");
    expect(planTokenSeries(series(), { ...at, halts: { TSLA: { reason: "pyth-stale", sinceSec: SAT } } }).kind).toBe("open");
    const regularOnly = [{ symbol: "TSLA" as const, date: "2026-09-19", why: "split", lanes: ["regular" as const] }];
    expect(planTokenSeries(series(), { ...at, skips: regularOnly }).kind).toBe("open");
    const token = [{ symbol: "TSLA" as const, date: "2026-09-19", why: "split", lanes: ["token" as const] }];
    expect(planTokenSeries(series(), { ...at, skips: token }).state).toBe("paused: corporate action (split)");
    const change = (effectiveSec: number) => [{ xstock: "TSLAx" as const, effectiveSec, from: "1.0", to: "1.0017", why: "multiplier 1.0017" }];
    expect(planTokenSeries(series(), { ...at, multipliers: change(SAT + 300) }).state).toBe("paused: corporate action (multiplier 1.0017)");
    expect(planTokenSeries(series(), { ...at, multipliers: change(SAT) }).kind).toBe("open");
  });

  it("pauses before the version's validity and waits without a free Book", () => {
    expect(planTokenSeries(series(), clock(1_789_430_400 - 60)).state).toBe("paused: no signed source");
    expect(planTokenSeries(series({ freeBooks: [] }), clock(SAT - 60)).state).toBe("waiting: no free book");
  });
});

describe("window-roller token plan for a pre-IPO name (D-103)", () => {
  const ATTESTED: VersionWindow[] = [{ validFromSec: 0, validUntilSec: null, primarySource: 4, checkSource: 0, openAdmissionSec: 900, checkAdmissionSec: 0, primaryFeedIdHex: "" }];
  it("rolls OPENAI-60m on its PreStocks token without an xStock, and pauses a listed ticker that has neither", () => {
    const openai = planTokenSeries(series({ key: "OPENAI-60m", symbol: "OPENAI", cadenceSec: 3_600, versions: ATTESTED, lastExpirySec: SAT }), clock(SAT - 60));
    expect(openai.kind).toBe("open");
    expect(planTokenSeries(series({ key: "AAPL-5m", symbol: "AAPL", versions: ATTESTED }), clock(SAT - 60)).state).toBe("paused: AAPL has no 24/7 token");
    expect(planTokenSeries(series({ key: "OPENAI-60m", symbol: "OPENAI", cadenceSec: 3_600, versions: ATTESTED }), { ...clock(SAT - 60), halts: { OPENAI: { reason: "quote-unavailable", sinceSec: SAT - 900 } } }).state).toBe("paused: halted (quote-unavailable)");
  });
});

describe("window-roller token plan for the crypto lanes (C6)", () => {
  const ATTESTED: VersionWindow[] = [{ validFromSec: 0, validUntilSec: null, primarySource: 4, checkSource: 0, openAdmissionSec: 60, checkAdmissionSec: 0, primaryFeedIdHex: "" }];
  // Tue 2026-09-29 10:33:00Z, mid-way through the 08:00–12:00 4 h Window and the 09-29 1 d Window.
  const NOW = 1_790_677_980;
  const DAY = 1_790_640_000; // 2026-09-29T00:00:00Z
  const crypto = (cadenceSec: number, lastExpirySec: number, key = `BTC-${cadenceSec / 60}m`) =>
    series({ key, symbol: "BTC", cadenceSec, versions: ATTESTED, lastExpirySec, nextIndex: 0n });

  it("lists the next 4 h Window a whole cadence ahead: 12:00–16:00Z at 10:33, since the current one's open print is gone", () => {
    const plan = planTokenSeries(crypto(14_400, DAY), clock(NOW));
    expect(plan).toMatchObject({ kind: "open", state: "opening #0 12:00–16:00Z v1 attested" });
    expect(plan.kind === "open" && plan.window.tradingStartSec).toBe(DAY + 12 * 3_600);
    // Once it is listed, the one after waits until 12:00Z (a cadence before 16:00Z).
    expect(planTokenSeries(crypto(14_400, DAY + 16 * 3_600), clock(NOW))).toMatchObject({ kind: "wait", wakeSec: DAY + 12 * 3_600, state: "waiting: next 16:00–20:00Z" });
  });

  it("lists tomorrow's 1 d Window now and names its dates", () => {
    const plan = planTokenSeries(crypto(86_400, DAY), clock(NOW));
    expect(plan).toMatchObject({ kind: "open", state: "opening #0 09-30 00:00Z–10-01 00:00Z v1 attested" });
    expect(planTokenSeries(crypto(86_400, DAY + 2 * 86_400), clock(NOW))).toMatchObject({ kind: "wait", wakeSec: DAY + 86_400 });
  });

  it("keeps the 120 s lead on the 1 m, 5 m, 15 m and 1 h lanes", () => {
    for (const cadenceSec of [60, 300, 900, 3_600]) {
      const plan = planTokenSeries(crypto(cadenceSec, 0), clock(NOW));
      const next = Math.ceil(NOW / cadenceSec) * cadenceSec;
      if (next - NOW > 120) expect(plan).toMatchObject({ kind: "wait", wakeSec: next - 120 });
      else expect(plan.kind).toBe("open");
    }
  });
});


describe("window-roller attested lanes (C6)", () => {
  const V = (printSource: string, from = 0, until: number | null = null): VersionWindow => ({ validFromSec: from, validUntilSec: until, primarySource: 4, checkSource: 0, openAdmissionSec: 60, checkAdmissionSec: 0, primaryFeedIdHex: "", printSource });
  const down = (why: string) => (text: string) => (text.startsWith("attested:switchboard:") ? why : null);

  it("lists an xStock lane only while Switchboard can sign, and names why not", () => {
    const tsla = series({ key: "TSLAx-5m", symbol: "TSLA", versions: [V("attested:switchboard:TSLAX/USD")], lastExpirySec: SAT });
    expect(planTokenSeries(tsla, { ...clock(SAT - 60), sourceUnavailable: () => null }).kind).toBe("open");
    const paused = planTokenSeries(tsla, { ...clock(SAT - 60), sourceUnavailable: down("Switchboard Surge TSLAX/USD: crossbar: IPFS fetch temporarily unavailable") });
    expect(paused).toMatchObject({ kind: "paused", state: "paused: no signed source (Switchboard Surge TSLAX/USD: crossbar: IPFS fetch temporarily unavailable)" });
  });

  it("a PreStocks lane is unaffected by another source being down; an uncovered Window keeps the plain state", () => {
    const openai = series({ key: "OPENAI-60m", symbol: "OPENAI", cadenceSec: 3_600, versions: [V("attested:prestocks:OPENAI")], lastExpirySec: SAT });
    expect(planTokenSeries(openai, { ...clock(SAT - 60), sourceUnavailable: down("x") }).kind).toBe("open");
    const later = series({ key: "OPENAI-60m", symbol: "OPENAI", cadenceSec: 3_600, versions: [V("attested:prestocks:OPENAI", SAT + 7_200)], lastExpirySec: SAT });
    expect(planTokenSeries(later, clock(SAT - 60)).state).toBe("paused: no signed source");
  });
});
