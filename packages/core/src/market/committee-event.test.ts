import { describe, expect, it } from "vitest";
import { EVENT_FAIR_TICKS, EVENT_HALF_SPREAD_TICKS, eventOutcomeOf, eventStatementText, isEventKey } from "./committee-event";

const statement = { marketId: "EVT-DEMO-1:0", question: "Will it rain?", answer: "yes" as const, source: "https://example.org/obs", member: "oracle-coinbase", attestedAtSec: 1_790_000_000 };

describe("committee-attested events (C6, an Addition; engine 0.4.0)", () => {
  it("reads Up as YES, Down as NO and a void as no outcome", () => {
    expect(eventOutcomeOf("SideUp")).toBe("yes");
    expect(eventOutcomeOf("SideDown")).toBe("no");
    expect(eventOutcomeOf(null)).toBeNull();
    expect(isEventKey("EVT-DEMO-1") && !isEventKey("BTC-5m")).toBe(true);
  });

  it("binds the domain, market, question, answer, source, member and time in a fixed order", () => {
    const text = eventStatementText(statement);
    expect(JSON.parse(text)).toEqual({ domain: "agari-event-v1", ...statement });
    expect(Object.keys(JSON.parse(text))).toEqual(["domain", "marketId", "question", "answer", "source", "member", "attestedAtSec"]);
    expect(eventStatementText({ ...statement })).toBe(text);
    expect(eventStatementText({ ...statement, answer: "no" })).not.toBe(text);
  });

  it("refuses a statement without a named source or question", () => {
    expect(() => eventStatementText({ ...statement, source: " " })).toThrow(/source/);
    expect(() => eventStatementText({ ...statement, question: "" })).toThrow(/question/);
  });

  it("prices an event at even odds, quoted wide inside the tick grid", () => {
    expect(EVENT_FAIR_TICKS - EVENT_HALF_SPREAD_TICKS).toBe(350);
    expect(EVENT_FAIR_TICKS + EVENT_HALF_SPREAD_TICKS).toBe(650);
  });
});
