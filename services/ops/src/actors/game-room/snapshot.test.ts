/**
 * C9d: a decided duel reads as the ledger decided it. A `DuelResult` keeps no picks, so the room's replay saw empty
 * masks ("neither finished") and showed a decisive duel as "Level — the pot was split".
 */
import { afterEach, describe, expect, it } from "vitest";
import { ok } from "@owarine/core/schemas";
import type { Address, Hash32 } from "@owarine/core/types";
import { registerArenaSource } from "@owarine/markets/games";
import { viewOfResult, withProjectedPicks, type DuelResultC, type ProjectedPick } from "@owarine/markets/ops/games";
import { buildMatchSnapshot } from "./snapshot";

const CREATOR = "3fVU8xir147UgUv7hgtbMDWLfZTmBZ6CwB5znhq1jALk" as Address;
const CHALLENGER = "6ZFBapEWpHokmiWCRXUqPJyf778BkiTGfhcJQwWFZo33" as Address;
const MATCH = "0x89fed006b1261efc676f5caafb0bdbe52955ce54938f21bae50e55d7ea747785" as Hash32;
const addressOf = (p: string) => (p.startsWith("creator") ? CREATOR : CHALLENGER);

function result(outcome: DuelResultC["outcome"], creatorPnl: bigint, challengerPnl: bigint): DuelResultC {
  return {
    venue: "venue::1220ff", creator: "creator::1220aa", challenger: "challenger::1220bb", arenaId: "arena-1", matchId: MATCH.slice(2), tierId: "t1", ranked: true,
    outcome, creatorPnl, challengerPnl, toCreator: 0n, toChallenger: 2_000_000n, serverSeed: null, cards: ["ETH-15m:5", "BTC-15m:5"],
  };
}

function serve(r: DuelResultC, picks: readonly ProjectedPick[] = []) {
  const view = withProjectedPicks(viewOfResult(r, addressOf, { deckHash: "0".repeat(64), deckSize: 2, policyVersion: 6, potEach: 1_000_000n, perCardCap: 1_000_000n }), picks);
  registerArenaSource({
    state: async () => { throw new Error("unused"); },
    season: async () => ok(null, 0),
    match: async () => ok({ ...view, serverSeed: null, clientSeeds: [], arenaId: "arena-1" }, 0),
  });
}

afterEach(() => registerArenaSource(null));

describe("a decided duel's snapshot (C9d)", () => {
  it("names the ledger's winner, with the ledger's PnL, and raises no replay warning", async () => {
    serve(result({ tag: "Won", winner: "challenger::1220bb" }, -1_210_784n, 2_162_083n));
    const snap = await buildMatchSnapshot(MATCH, 203);
    expect(snap.ok).toBe(true);
    if (!snap.ok || snap.state.phase !== "finalized") throw new Error("not finalized");
    expect(snap.state.outcome.winner).toBe(CHALLENGER);
    expect(snap.state.outcome.pnlBase).toEqual({ [CREATOR]: -1_210_784n, [CHALLENGER]: 2_162_083n });
    expect(snap.warning).toBeUndefined();
  });

  it("reads a ledger tie as a tie", async () => {
    serve(result({ tag: "Tied" }, 0n, 0n));
    const snap = await buildMatchSnapshot(MATCH, 203);
    if (!snap.ok || snap.state.phase !== "finalized") throw new Error("not finalized");
    expect(snap.state.outcome.winner).toBeNull();
  });
});

/** C4c: the C9d duel's four picks as the projection kept them (creator Up twice, challenger Down twice, both lost/won). */
const PICKS: ProjectedPick[] = [
  { cardIndex: 0, seat: 0, side: "up", quantity: 1_000_000n, costBase: 600_000n, payoutBase: 0n },
  { cardIndex: 0, seat: 1, side: "down", quantity: 1_000_000n, costBase: 400_000n, payoutBase: 1_500_000n },
  { cardIndex: 1, seat: 0, side: "up", quantity: 1_000_000n, costBase: 610_784n, payoutBase: 0n },
  { cardIndex: 1, seat: 1, side: "down", quantity: 1_000_000n, costBase: 437_917n, payoutBase: 1_500_000n },
];

describe("a decided duel's cards (C4c: the result keeps no picks; the projection does)", () => {
  it("lists every card's two picks and their masks, and the replay agrees with the ledger", async () => {
    const view = withProjectedPicks(viewOfResult(result({ tag: "Won", winner: "challenger::1220bb" }, -1_210_784n, 2_162_083n), addressOf), PICKS);
    expect(view.picks).toHaveLength(4);
    expect(view.picks.filter((p) => p.cardIndex === 0).map((p) => [p.seat, p.pick, p.settled])).toEqual([[0, "up", true], [1, "down", true]]);
    expect(view.match).toMatchObject({ pickedMask0: 0b11, pickedMask1: 0b11, settledMask: 0b11 });
    // The ledger's figures stand; the picks only describe them.
    expect([view.creatorPnlBase, view.challengerPnlBase]).toEqual([-1_210_784n, 2_162_083n]);

    serve(result({ tag: "Won", winner: "challenger::1220bb" }, -1_210_784n, 2_162_083n), PICKS);
    const snap = await buildMatchSnapshot(MATCH, 203);
    if (!snap.ok || snap.state.phase !== "finalized") throw new Error("not finalized");
    expect(snap.state.outcome.winner).toBe(CHALLENGER);
    expect(snap.warning).toBeUndefined();
  });

  it("an open card (no payout yet) is picked but not settled, and picks off the deck are dropped", () => {
    const view = withProjectedPicks(viewOfResult(result({ tag: "Tied" }, 0n, 0n), addressOf), [
      { cardIndex: 1, seat: 0, side: "up", quantity: 1n, costBase: 1n, payoutBase: null },
      { cardIndex: 9, seat: 1, side: "down", quantity: 1n, costBase: 1n, payoutBase: 2n },
    ]);
    expect(view.picks).toEqual([expect.objectContaining({ cardIndex: 1, seat: 0, settled: false, payoutBase: 0n })]);
    expect(view.match).toMatchObject({ pickedMask0: 0b10, pickedMask1: 0, settledMask: 0 });
    // Nothing projected: the view is unchanged (the result still reads, with "unplayed" cards).
    const bare = viewOfResult(result({ tag: "Tied" }, 0n, 0n), addressOf);
    expect(withProjectedPicks(bare, [])).toBe(bare);
  });
});
