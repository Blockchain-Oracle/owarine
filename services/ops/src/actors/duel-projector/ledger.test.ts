import type { Address } from "@agari/core/types";
import { GAMES_TEMPLATE_IDS, TEMPLATE_IDS } from "@agari/daml";
import type { JsTransaction } from "@agari/ledger";
import { describe, expect, it } from "vitest";
import { createDuelTranslator } from "./ledger";

/**
 * The duel projection reads the venue's LEDGER_EFFECTS stream: each arena choice must become exactly the events the
 * reference's arena log carried, with the ledger's own figures (a pick's cost, a score's payout, the pot awarded).
 * Payloads here are the JSON API v2 encoding: Int as a string, a record-constructor variant as `{tag, value}`.
 */
const pkg = "p".repeat(64);
const tid = (t: string) => `${pkg}${t.slice(t.indexOf(":"))}`;
const matchId = `0x${"ab".repeat(32)}`;
const addresses: Record<string, Address> = { "alice::1": "Alice1111111111111111111111111111111111111" as Address, "bob::1": "Bob11111111111111111111111111111111111111" as Address };
const addressOf = (p: string) => addresses[p] ?? ("Unknown111111111111111111111111111111111111" as Address);

const tier = { tierId: "t1", potEach: "1000000", perCardCap: "1000000", ranked: true, enabled: true };
const params = { joinWindowSec: "120", revealWindowSec: "60", pickWindowSec: "240", minDeckSize: "1", maxDeckSize: "8" };
const base = { venue: "venue::1", creator: "alice::1", challenger: "bob::1", arenaId: "arena-1", matchId, policyVersion: "6", tier, params, deckHash: "cd".repeat(32), deckSize: "1", clientSeeds: ["s0", "s1"] };
const card = { termsCid: "00t0", marketId: "BTC-60:7", lockAt: "2026-09-29T12:05:00Z", refundAfter: "2026-09-29T12:20:00Z" };
const leg = (owner: string, outcome: string) => ({ venue: "venue::1", owner, termsCid: "00t0", marketId: "BTC-60:7", pairId: "x", outcome, lots: "3", cashUnit: "10000", backingShare: "12000", feePaid: "300", refundAfter: "2026-09-29T12:20:00Z", beneficiaryRef: `duel:arena-1:${matchId}` });
const pick = (seat: number, owner: string, outcome: string, payout: string | null) => ({ seat: String(seat), cardIndex: "0", legCid: `00leg${seat}`, leg: leg(owner, outcome), cost: "12300", payout });
const match = (status: unknown, picks: unknown[]) => ({ ...base, revealDeadline: "2026-09-29T12:01:00Z", status, serverSeed: "seed", cards: [card], pickDeadline: "2026-09-29T12:04:00Z", picks });

function tx(choice: string, on: string, argument: unknown, created: Array<{ templateId: string; payload: unknown; cid: string }>): JsTransaction {
  return {
    updateId: "1220aa", offset: 42, effectiveAt: "2026-09-29T12:03:00Z", recordTime: "2026-09-29T12:03:00Z", synchronizerId: "s",
    events: [
      { ExercisedEvent: { offset: 42, nodeId: 0, contractId: "00match", templateId: tid(on), choice, choiceArgument: argument, actingParties: [], consuming: true, witnessParties: [], lastDescendantNodeId: created.length, packageName: "abu-pm-games" } },
      ...created.map((c, i) => ({ CreatedEvent: { offset: 42, nodeId: i + 1, contractId: c.cid, templateId: tid(c.templateId), packageName: "abu-pm-games", createArgument: c.payload, witnessParties: [], signatories: [], createdAt: "" } })),
    ],
  } as JsTransaction;
}

describe("the duel projection's translation of arena choices", () => {
  const t = createDuelTranslator(addressOf);

  it("a recorded pick is `picked` at the leg's own cost and quantity; the last one also locks the match", () => {
    const m = match({ tag: "Settling", value: {} }, [pick(0, "alice::1", "SideUp", null), pick(1, "bob::1", "SideDown", null)]);
    const events = t.eventsOf(tx("Duel_RecordPick", GAMES_TEMPLATE_IDS.DuelMatch, { player: "bob::1", cardIndex: "0", legCid: "00leg1" }, [{ templateId: GAMES_TEMPLATE_IDS.DuelMatch, payload: m, cid: "00m2" }]));
    expect(events.map((e) => e.event.kind)).toEqual(["picked", "locked"]);
    const picked = events[0]!.event;
    expect(picked).toMatchObject({ kind: "picked", player: addresses["bob::1"], cardIndex: 0, pick: "down", quantity: 30_000n, costBase: 12_300n, refundBase: 0n });
    expect(events[0]!.txHash).toBe("1220aa");
    expect(events[0]!.blockNumber).toBe(42n);
  });

  it("a score is one `settled` per scored item, with payout − cost as the PnL", () => {
    const m = match({ tag: "Settling", value: {} }, [pick(0, "alice::1", "SideUp", "30000"), pick(1, "bob::1", "SideDown", "0")]);
    const events = t.eventsOf(tx("Duel_Score", GAMES_TEMPLATE_IDS.DuelMatch, { actor: "venue::1", items: [{ seat: "0", cardIndex: "0", resolutionCid: "r" }, { seat: "1", cardIndex: "0", resolutionCid: "r" }] }, [{ templateId: GAMES_TEMPLATE_IDS.DuelMatch, payload: m, cid: "00m3" }]));
    expect(events.map((e) => e.event)).toMatchObject([
      { kind: "settled", player: addresses["alice::1"], payoutBase: 30_000n, pnlBase: 17_700n },
      { kind: "settled", player: addresses["bob::1"], payoutBase: 0n, pnlBase: -12_300n },
    ]);
  });

  it("a forfeit names the absent seat; finalize awards the whole pot to the winner", () => {
    const f = t.eventsOf(tx("Duel_Lock", GAMES_TEMPLATE_IDS.DuelMatch, { actor: "venue::1" }, [{ templateId: GAMES_TEMPLATE_IDS.DuelMatch, payload: match({ tag: "Forfeited", value: { absent: "bob::1" } }, [pick(0, "alice::1", "SideUp", null)]), cid: "00m4" }]));
    expect(f[0]!.event).toMatchObject({ kind: "locked", status: "forfeited", forfeitedBy: addresses["bob::1"] });
    const result = { venue: "venue::1", creator: "alice::1", challenger: "bob::1", arenaId: "arena-1", matchId, tierId: "t1", ranked: true, outcome: { tag: "Won", value: { winner: "alice::1" } }, creatorPnl: "17700", challengerPnl: "-12300", toCreator: "2000000", toChallenger: "0", serverSeed: "seed", cards: ["BTC-60:7"] };
    const fin = t.eventsOf(tx("Duel_Finalize", GAMES_TEMPLATE_IDS.DuelMatch, { actor: "venue::1" }, [{ templateId: GAMES_TEMPLATE_IDS.DuelResult, payload: result, cid: "00r" }]));
    expect(fin[0]!.event).toMatchObject({ kind: "finalized", winner: addresses["alice::1"], creatorPnlBase: 17_700n, challengerPnlBase: -12_300n, potAwardedBase: 2_000_000n });
  });

  it("a cancel of an open duel is a creator refund of exactly the pot paid back", () => {
    const open = { ...base, joinDeadline: "2026-09-29T12:02:00Z" };
    const opened = t.eventsOf(tx("Arena_OpenDuel", GAMES_TEMPLATE_IDS.ArenaTerms, {}, [{ templateId: GAMES_TEMPLATE_IDS.DuelOpen, payload: open, cid: "00open" }]));
    expect(opened[0]!.event).toMatchObject({ kind: "created", creator: addresses["alice::1"], potBase: 1_000_000n, deckSize: 1, deckHash: `0x${"cd".repeat(32)}` });
    const cancel = tx("Open_Cancel", GAMES_TEMPLATE_IDS.DuelOpen, {}, [{ templateId: TEMPLATE_IDS.VenueCash, payload: { venue: "venue::1", owner: "alice::1", amount: "1000000", bucket: "duel-refund" }, cid: "00cash" }]);
    (cancel.events[0] as { ExercisedEvent: { contractId: string } }).ExercisedEvent.contractId = "00open";
    expect(t.eventsOf(cancel)[0]!.event).toMatchObject({ kind: "refunded", reason: "creator-cancelled", perPlayerBase: 1_000_000n });
  });
});
