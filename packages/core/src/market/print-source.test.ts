import { describe, expect, it } from "vitest";
import { attestedPrintSource, EXCHANGE_PRINT_SOURCE, noSourceReason, parsePrintSource, pausedNoSource } from "./print-source";

describe("attested print sources (C6)", () => {
  it("round-trips every source and keeps the C3 crypto text", () => {
    expect(parsePrintSource(EXCHANGE_PRINT_SOURCE)).toEqual({ source: "exchanges", feed: null });
    for (const [source, feed] of [["redstone", "TSLA"], ["pyth", "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1"], ["switchboard", "TSLAX/USD"], ["prestocks", "OPENAI"], ["basket", "AILABS"], ["committee", "DEMO-1"]] as const) {
      expect(parsePrintSource(attestedPrintSource(source, feed))).toEqual({ source, feed });
    }
  });

  it("refuses what it does not know", () => {
    expect(parsePrintSource("pyth")).toBeNull();
    expect(parsePrintSource("attested:jupiter:TSLAx")).toBeNull();
    expect(() => attestedPrintSource("redstone", "")).toThrow();
  });

  it("words the paused state with its reason and reads the reason back", () => {
    expect(pausedNoSource(null)).toBe("paused: no signed source");
    const state = pausedNoSource("Pyth Hermes answers 401 without PYTH_API_KEY");
    expect(state).toBe("paused: no signed source (Pyth Hermes answers 401 without PYTH_API_KEY)");
    expect(noSourceReason(state)).toBe("Pyth Hermes answers 401 without PYTH_API_KEY");
    expect(noSourceReason("paused: no signed source")).toBeNull();
  });
});
