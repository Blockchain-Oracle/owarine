import { describe, expect, it } from "vitest";
import { VENUE_MODE_CODE, venueModeOfState, venueModePausedState, venueModeRefusal } from "./venue-mode";

describe("C-DAML-02: the venue mode is issuer policy, and a way out never asks it", () => {
  it("open takes everything", () => {
    for (const a of ["open-position", "supply", "open-window"] as const) expect(venueModeRefusal("open", a)).toBeNull();
  });

  it("reduce-only and paused refuse new risk, saying exits stay open", () => {
    expect(venueModeRefusal("reduce-only", "open-position")).toBe("the venue is reduce-only by its operator: no new positions; exits, claims and refunds stay open");
    expect(venueModeRefusal("paused", "supply", "maintenance")).toBe("the venue is paused by its operator (maintenance): no new supply to the house; exits, claims and refunds stay open");
    expect(venueModeRefusal("paused", "open-window")).toContain("no new Windows");
  });

  it("the roller's lane state round-trips, and other pauses are not read as the venue's", () => {
    expect(venueModeOfState(venueModePausedState("reduce-only", "rehearsal"))).toEqual({ mode: "reduce-only", reason: "rehearsal" });
    expect(venueModeOfState(venueModePausedState("paused"))).toEqual({ mode: "paused", reason: null });
    expect(venueModeOfState("paused: no signed source (Pyth feed not entitled)")).toBeNull();
    expect(VENUE_MODE_CODE).toEqual({ open: 0, "reduce-only": 1, paused: 2 });
  });
});
