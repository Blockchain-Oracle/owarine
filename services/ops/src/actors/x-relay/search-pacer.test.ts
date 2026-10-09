import { describe, expect, it } from "vitest";
import { createSearchPacer } from "./search-pacer";

const at = 1_000_000_000_000;
const headers = (remaining: number, resetInSec: number) => ({ "x-rate-limit-remaining": String(remaining), "x-rate-limit-reset": String(at / 1000 + resetInSec) });

describe("mention search pacing", () => {
  it("spreads the calls left evenly over the rest of X's window", () => {
    const pacer = createSearchPacer();
    expect(pacer.readyAtMs()).toBe(0);
    pacer.observe(headers(50, 900), at);
    expect(pacer.readyAtMs()).toBe(at + 18_000);
    pacer.observe(headers(5, 60), at);
    expect(pacer.readyAtMs()).toBe(at + 12_000);
  });

  it("holds until the window resets once the budget is spent or X refuses for rate", () => {
    const pacer = createSearchPacer();
    pacer.observe(headers(0, 400), at);
    expect(pacer.readyAtMs()).toBe(at + 401_000);
    pacer.observe(headers(3, 300), at);
    pacer.limited(at + 10_000);
    expect(pacer.readyAtMs()).toBe(at + 301_000);
  });

  it("backs off when X never reported its window, and leaves headerless responses unpaced", () => {
    const pacer = createSearchPacer();
    pacer.limited(at);
    expect(pacer.readyAtMs()).toBe(at + 60_000);
    pacer.limited(at + 60_000);
    expect(pacer.readyAtMs()).toBe(at + 180_000);
    pacer.observe({}, at + 180_000);
    expect(pacer.readyAtMs()).toBe(0);
    pacer.limited(at + 200_000);
    expect(pacer.readyAtMs()).toBe(at + 260_000);
  });
});
