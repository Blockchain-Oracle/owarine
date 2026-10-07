import type { DuelMatchC, DuelOpenC, PickC } from "@owarine/markets/ops/games";
import { describe, expect, it } from "vitest";
import { decideMatch, decideOpen, potRefundAfterSec } from "./decide";

const tier = { tierId: "t1", potEach: 1_000_000n, perCardCap: 1_000_000n, ranked: true, enabled: true };
const params = { joinWindowSec: 120, revealWindowSec: 60, pickWindowSec: 240, minDeckSize: 1, maxDeckSize: 8 };
const base = {
  venue: "venue::1", creator: "alice::1", challenger: "bob::1", arenaId: "arena-1", matchId: `0x${"ab".repeat(32)}`, policyVersion: 5,
  tier, params, deckHash: "cd".repeat(32), deckSize: 2, clientSeeds: ["s0", "s1"],
};
const cards = [
  { termsCid: "t0", marketId: "BTC-60:1", lockAtSec: 1_000, refundAfterSec: 2_000 },
  { termsCid: "t1", marketId: "BTC-60:2", lockAtSec: 1_060, refundAfterSec: 2_060 },
];
const leg = { venue: "venue::1", owner: "alice::1", termsCid: "t0", marketId: "BTC-60:1", pairId: "p", outcome: "SideUp" as const, lots: 1n, cashUnit: 1n, backingShare: 400n, feePaid: 0n, refundAfterSec: 2_000, beneficiaryRef: "duel:arena-1:x" };
const pick = (seat: 0 | 1, cardIndex: number, payout: bigint | null = null): PickC => ({ seat, cardIndex, legCid: `l${seat}${cardIndex}`, leg, cost: 400n, payout });
const match = (over: Partial<DuelMatchC>): DuelMatchC => ({ ...base, revealDeadlineSec: 500, status: { tag: "Unrevealed" }, serverSeed: null, cards: [], pickDeadlineSec: null, picks: [], ...over });

describe("the duel settler's decisions (PM.Games.Arena's preconditions)", () => {
  it("refunds an unjoined duel only from the join deadline + 1 s", () => {
    const o: DuelOpenC = { ...base, joinDeadlineSec: 100 };
    expect(decideOpen(o, 100)).toEqual([]);
    expect(decideOpen(o, 101).map((a) => a.kind)).toEqual(["refund-unjoined"]);
  });

  it("reveals while the reveal window is open, and only with the sealed material on hand", () => {
    expect(decideMatch(match({}), new Set(), 500, true).map((a) => a.kind)).toEqual(["reveal"]);
    expect(decideMatch(match({}), new Set(), 500, false)).toEqual([]);
    expect(decideMatch(match({}), new Set(), 501, true).map((a) => a.kind)).toEqual(["refund-unrevealed"]);
  });

  it("locks a picking match only after its pick deadline", () => {
    const m = match({ status: { tag: "Picking" }, cards, pickDeadlineSec: 900 });
    expect(decideMatch(m, new Set(), 900, true)).toEqual([]);
    expect(decideMatch(m, new Set(), 901, true).map((a) => a.kind)).toEqual(["lock"]);
  });

  it("scores the picks on resolved Windows, then finalizes once every recorded pick is scored", () => {
    const m = match({ status: { tag: "Settling" }, cards, pickDeadlineSec: 900, picks: [pick(0, 0), pick(1, 0), pick(0, 1), pick(1, 1)] });
    expect(decideMatch(m, new Set(), 1_500, true)).toEqual([]);
    const first = decideMatch(m, new Set(["t0"]), 1_500, true);
    expect(first).toEqual([{ kind: "score", matchId: m.matchId, items: [{ seat: 0, cardIndex: 0, termsCid: "t0" }, { seat: 1, cardIndex: 0, termsCid: "t0" }], why: "2 pick(s) on resolved Windows" }]);
    const scored = match({ ...m, picks: [pick(0, 0, 1000n), pick(1, 0, 0n), pick(0, 1, 0n), pick(1, 1, 1000n)] });
    expect(decideMatch(scored, new Set(["t0", "t1"]), 1_500, true).map((a) => a.kind)).toEqual(["finalize"]);
  });

  it("finalizes a forfeit whose only player's pick is scored, and refunds a stale pot past the last refund deadline", () => {
    const f = match({ status: { tag: "Forfeited", absent: "bob::1" }, cards, pickDeadlineSec: 900, picks: [pick(0, 0, 0n)] });
    expect(decideMatch(f, new Set(), 1_500, true).map((a) => a.kind)).toEqual(["finalize"]);
    const stuck = match({ status: { tag: "Settling" }, cards, pickDeadlineSec: 900, picks: [pick(0, 0)] });
    expect(potRefundAfterSec(stuck)).toBe(2_060);
    expect(decideMatch(stuck, new Set(), 2_060, true)).toEqual([]);
    expect(decideMatch(stuck, new Set(), 2_061, true).map((a) => a.kind)).toEqual(["refund-stale"]);
  });
});
