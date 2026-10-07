import { describe, expect, it } from "vitest";
import { positionValueBase } from "./position-value";

describe("positionValueBase", () => {
  it("keeps the unsellable remainder of a partly fillable position at cost", () => {
    // 100 lots held at 50 credits; the board takes 20 lots for 9 credits → 9 + 40 at cost = 49.
    expect(positionValueBase({ costBasisBase: 50_000_000n }, { heldLots: 100n, fillableLots: 20n, exitBase: 9_000_000n })).toBe(49_000_000n);
  });
  it("is the exit when the board takes it all, and cost when it takes none", () => {
    expect(positionValueBase({ costBasisBase: 50_000_000n }, { heldLots: 100n, fillableLots: 100n, exitBase: 47_000_000n })).toBe(47_000_000n);
    expect(positionValueBase({ costBasisBase: 50_000_000n }, { heldLots: 100n, fillableLots: 0n, exitBase: 0n })).toBe(50_000_000n);
    expect(positionValueBase({ costBasisBase: 50_000_000n }, null)).toBe(50_000_000n);
  });
});
