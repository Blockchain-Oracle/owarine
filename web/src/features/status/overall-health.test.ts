import { describe, expect, it } from "vitest";
import { overallOf } from "./run.server";
import type { StatusPipeline } from "./protocol";
const healthy: StatusPipeline = { id: "lanes", label: "Markets", ok: true, lagSec: null, latencyMs: 1, detail: "", optional: false, configured: true, expected: false, grade: "good" };
describe("overall availability", () => {
  it("does not call a warning all systems live", () => {
    expect(overallOf([healthy], 0)).toBe("healthy");
    expect(overallOf([{ ...healthy, grade: "warn" }], 0)).toBe("degraded");
    expect(overallOf([healthy, { ...healthy, id: "paused", ok: false }], 0)).toBe("degraded");
  });
  it("keeps expected stock closures and optional capabilities out of the verdict", () => {
    expect(overallOf([healthy, { ...healthy, ok: false, expected: true }, { ...healthy, grade: "warn", optional: true }], 0)).toBe("healthy");
  });
});
