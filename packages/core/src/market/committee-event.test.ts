import { describe, expect, it } from "vitest";
import { EVENT_BASELINE_E8, eventCloseE8, eventOutcomeOf, isEventKey } from "./committee-event";

describe("committee-attested events (C6, an Addition)", () => {
  it("YES closes above the baseline and NO below, so Terms_Resolve's Up/Down is the answer; a tie can never happen", () => {
    expect(eventCloseE8("yes") > EVENT_BASELINE_E8).toBe(true);
    expect(eventCloseE8("no") < EVENT_BASELINE_E8).toBe(true);
    expect(eventOutcomeOf("SideUp")).toBe("yes");
    expect(eventOutcomeOf("SideDown")).toBe("no");
    expect(eventOutcomeOf(null)).toBeNull();
    expect(isEventKey("EVT-DEMO-1") && !isEventKey("BTC-5m")).toBe(true);
  });
});
