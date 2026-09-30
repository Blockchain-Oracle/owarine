import { describe, expect, it } from "vitest";
import type { BookLevel } from "@agari/core/market";
import { callExpired, DEFAULT_FILL_CAP_LOTS, fillableLots, offerLapsed } from "./rule";

// The venue's ladder on one side, best first, in the bought outcome's own terms: fair 500 ± 30 gives an ask of 530.
const LADDER: BookLevel[] = [[530, 200n], [535, 200n], [540, 200n]];

describe("the venue takes a resting call at its own price when its ladder reaches it", () => {
  it("does not take a call under the venue's best level: it keeps resting", () => {
    expect(fillableLots({ priceTicks: 529, lots: 50n }, LADDER)).toMatchObject({ lots: 0n });
    expect(fillableLots({ priceTicks: 300, lots: 50n }, LADDER).why).toMatch(/best is 530/);
  });

  it("takes a call that reaches the best level, whole when the depth covers it", () => {
    expect(fillableLots({ priceTicks: 530, lots: 50n }, LADDER)).toMatchObject({ lots: 50n });
    expect(fillableLots({ priceTicks: 550, lots: 150n }, LADDER)).toMatchObject({ lots: 150n });
  });

  it("takes only the depth at or under the call's price, so a big call fills in part and the rest keeps resting", () => {
    // 530 and 535 are under 537: 400 lots deep; a 1,000-lot call fills 400 and 600 rest
    expect(fillableLots({ priceTicks: 537, lots: 1_000n }, LADDER)).toMatchObject({ lots: 400n });
    expect(fillableLots({ priceTicks: 530, lots: 1_000n }, LADDER)).toMatchObject({ lots: 200n });
  });

  it("never takes more than one command may (the issuer's own per-quote cap), and says why nothing fills on an empty side", () => {
    expect(fillableLots({ priceTicks: 700, lots: 100_000n }, [[530, 100_000n]])).toMatchObject({ lots: DEFAULT_FILL_CAP_LOTS });
    expect(fillableLots({ priceTicks: 700, lots: 100_000n }, [[530, 100_000n]], 25n)).toMatchObject({ lots: 25n });
    expect(fillableLots({ priceTicks: 700, lots: 10n }, [])).toEqual({ lots: 0n, why: "the venue has no depth on this side" });
  });
});

describe("the sweeps wait out the ledger's own deadlines", () => {
  it("a call is swept from a second after its expiry, an offer from its slack plus a second after validUntil", () => {
    expect(callExpired(1_000, 1_000)).toBe(false);
    expect(callExpired(1_000, 1_001)).toBe(true);
    expect(offerLapsed(1_000, 1_005)).toBe(false);
    expect(offerLapsed(1_000, 1_006)).toBe(true);
  });
});
