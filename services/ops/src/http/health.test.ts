import { describe, expect, it } from "vitest";
import { registerHeartbeat } from "../runtime/heartbeat";
import { healthBody, OPTIONAL_ACTORS } from "./health";

describe("healthBody (K-027)", () => {
  it("lists a failing display-only feed as degraded without turning ok false", () => {
    const now = Date.now();
    const venue = registerHeartbeat("health-test-venue", false, 5_000);
    venue.lastOkMs = now;
    const feed = registerHeartbeat("prestocks-spot", false, 5_000);
    feed.failures = 9;
    expect(OPTIONAL_ACTORS.has("prestocks-spot")).toBe(true);
    const body = healthBody(undefined, now);
    expect(body.degraded).toContain("prestocks-spot");
    expect(body.actors.find((a) => a.actor === "health-test-venue")).toBeDefined();
    expect(body.ok).toBe(body.actors.filter((a) => !OPTIONAL_ACTORS.has(a.actor)).every((a) => a.failures < 3));
  });

  it("still fails on a venue actor that fails", () => {
    const now = Date.now();
    const bad = registerHeartbeat("health-test-resolver", false, 5_000);
    bad.failures = 3;
    expect(healthBody(undefined, now).ok).toBe(false);
  });
});
