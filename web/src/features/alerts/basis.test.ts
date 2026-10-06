import { describe, expect, it } from "vitest";
import { alertBasisOf, alertFootLine } from "./basis";
import { ALERTS } from "./copy";

/** C9e: BTC and ETH trade around the clock on Canton; their alerts never wait for the NYSE open. */
describe("alertBasisOf", () => {
  it("puts a 24/7-only name on the 24/7 basis and a listed stock on Regular", () => {
    expect(alertBasisOf("BTC")).toBe("token");
    expect(alertBasisOf("ETH")).toBe("token");
    expect(alertBasisOf("TSLA")).toBe("regular");
    expect(alertBasisOf("NOT-LISTED")).toBe("regular");
  });

  it("says a stock's rule waits for the open, and a 24/7 rule fires now", () => {
    expect(alertFootLine("TSLA", false, "Opens Tue 09:30 ET", "granted")).toBe(ALERTS.foot.waiting("Opens Tue 09:30 ET"));
    expect(alertFootLine("BTC", false, "Opens Tue 09:30 ET", "granted")).toBe(ALERTS.foot.on);
    expect(alertFootLine("ETH", false, null, "default")).toBe(ALERTS.foot.off);
  });
});
