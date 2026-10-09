import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("X instruction clipboard text", () => {
  it("mentions the configured relay account exactly once", async () => {
    vi.stubEnv("NEXT_PUBLIC_X_HANDLE", "owarine_app");
    vi.resetModules();
    const { xInstructionText } = await import("./copy");
    expect(xInstructionText("SOL", "down", "5", "5m")).toBe("@owarine_app SOL DOWN 5 5m");
  });

  it("does not duplicate an @ in the configured handle", async () => {
    vi.stubEnv("NEXT_PUBLIC_X_HANDLE", "@owarine_app");
    vi.resetModules();
    const { xInstructionText } = await import("./copy");
    expect(xInstructionText("BTC", "up", "5", "5m")).toBe("@owarine_app BTC UP 5 5m");
  });
});
