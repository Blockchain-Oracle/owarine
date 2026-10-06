import { describe, expect, it } from "vitest";
import type { LegC } from "../canton/decode";
import type { PickC } from "./decode";
import { arenaPickOf, pickQuantityOf } from "./view";

const leg = (lots: bigint, cashUnit: bigint): LegC =>
  ({ venue: "v", owner: "o", termsCid: "t", marketId: "m", pairId: "p", outcome: "SideDown", lots, cashUnit, backingShare: lots * 50n * cashUnit, feePaid: 0n, refundAfterSec: 0, beneficiaryRef: "duel" }) as LegC;

describe("a duel pick's quantity (C11c)", () => {
  it("is what the leg pays on a win: PM.Leg quantityOf = lots × 1000 × cashUnit", () => {
    expect(pickQuantityOf(19n, 1_000n)).toBe(19_000_000n);
  });

  it("arenaPickOf carries the payout-sized quantity, not a thousandth of it", () => {
    // The simulator's PREDMKTS card: 19 contracts Down at 50 ticks for 0.95 credits; a win pays 19 credits.
    const pick: PickC = { seat: 0, cardIndex: 1, legCid: "l", leg: leg(19n, 1_000n), cost: 950_000n, payout: 19_000_000n };
    const view = arenaPickOf(pick);
    expect(view.quantity).toBe(19_000_000n);
    expect(view.quantity).toBe(view.payoutBase);
    expect(view.costBase).toBe(950_000n);
  });
});
