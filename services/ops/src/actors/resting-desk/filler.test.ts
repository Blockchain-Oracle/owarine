import { describe, expect, it, vi } from "vitest";
import { errorFromResponse, type LedgerClient } from "@owarine/ledger";
import { createLadderBoard, type LadderBoard } from "../market-maker/seat/ladder-board";
import { ShardPool } from "../quote-issuer/pool";
import { restingPass, type FillerDeps } from "./filler";

const V = "venue::1220abcdef";
const SEAT = "seat-1::1220cdef01";
const NOW = 1_790_000_000;
const iso = (sec: number) => new Date(sec * 1000).toISOString();
const CREATED = "";

const callContract = (cid: string, o: { start: number; expiresSec: number; lots?: string; priceTicks?: string; side?: string; termsCid?: string }) => ({
  createdEvent: {
    contractId: cid, templateId: "p:PM.Resting:RestingCall", offset: 9, nodeId: 0, packageName: "abu-pm-main", witnessParties: [V], signatories: [V, SEAT], "createdAt": CREATED,
    createArgument: {
      venue: V, owner: SEAT, callRef: `rc-${cid}`, termsCid: o.termsCid ?? "00terms", marketId: "TSLA-5m:7", side: o.side ?? "SideUp", priceTicks: o.priceTicks ?? "550", lotsPlaced: o.lots ?? "10", lots: o.lots ?? "10",
      cashUnit: "1000", escrow: "5500000", "tradingStart": iso(o.start), lockAt: iso(o.start + 240), refundAfter: iso(o.start + 1_000), expiresAt: iso(o.expiresSec),
    },
  },
});
const offerContract = (cid: string, validUntil: number) => ({
  createdEvent: {
    contractId: cid, templateId: "p:PM.Resting:RestingOffer", offset: 9, nodeId: 0, packageName: "abu-pm-main", witnessParties: [V], signatories: [V], "createdAt": CREATED,
    createArgument: {
      venue: V, owner: SEAT, callRef: `rc-${cid}`, termsCid: "00terms", marketId: "TSLA-5m:7", side: "SideUp", lots: "10", priceTicks: "550", cashUnit: "1000", "tradingStart": iso(NOW + 200),
      lockAt: iso(NOW + 440), refundAfter: iso(NOW + 1_200), expiresAt: iso(NOW + 290), validUntil: iso(validUntil),
    },
  },
});

function setup(contracts: unknown[], o: { fillEnabled?: boolean; ladder?: { up: Array<[number, bigint]>; down: Array<[number, bigint]> } | null; failWith?: Error } = {}) {
  const board: LadderBoard = createLadderBoard();
  if (o.ladder !== null) {
    board.put({
      marketId: "m", damlMarketId: "TSLA-5m:7", seriesId: "s", termsCid: "00terms", seriesKey: "TSLA-5m", symbol: "TSLA", index: 7, tradingStartSec: NOW - 10, lockAtSec: NOW + 230, expirySec: NOW + 290,
      quotingUntilSec: NOW + 230, cashUnit: 1000n, feeRateBps: 100, fairTicks: 500, openPriceE8: 1n, spotE8: 1n, up: o.ladder?.up ?? [[530, 100n]], down: o.ladder?.down ?? [[530, 100n]], asOfMs: NOW * 1000, state: "quoting",
    });
  }
  const pool = new ShardPool({ venue: V, maxWaitMs: 20 });
  pool.sync([{ cid: "shard1", data: { venue: V, owner: V, amount: 100_000_000n, bucket: "shard" } }]);
  const submitAndWaitForTransaction = vi.fn(async () => {
    if (o.failWith) throw o.failWith;
    return {
      transaction: { updateId: "u", offset: 9, effectiveAt: "", synchronizerId: "", recordTime: "", events: [{ ArchivedEvent: { contractId: "shard1", offset: 9, nodeId: 0, templateId: "p:PM.Money:VenueCash", packageName: "abu-pm-main", witnessParties: [V] } }] },
      submissionId: "s", attempts: 1, recovered: false,
    };
  });
  const client = { activeContracts: vi.fn(async () => ({ contracts, activeAtOffset: 9 })), submitAndWaitForTransaction, ledgerEnd: async () => 8 } as unknown as LedgerClient;
  const logs: string[] = [];
  const deps: FillerDeps = { venue: { role: "venue", party: V, client, dryRun: false }, board, pool, maker: null, capLots: 500n, fillEnabled: o.fillEnabled ?? true, log: (w) => logs.push(w), nowMs: () => NOW * 1000 };
  const sent = () => (submitAndWaitForTransaction.mock.calls as unknown as Array<[{ commandId: string; commands: Array<{ ExerciseCommand: { choice: string; contractId: string; choiceArgument: Record<string, unknown> } }> }]>).map((c) => c[0]);
  return { deps, board, pool, sent, logs };
}

describe("the resting desk's pass", () => {
  it("leaves a call alone before the bell", async () => {
    const { deps, sent } = setup([callContract("c1", { start: NOW + 60, expiresSec: NOW + 150 })]);
    const r = await restingPass(deps);
    expect(sent()).toHaveLength(0);
    expect(r.why).toMatch(/1 calls \(1 waiting for the bell\)/);
  });

  it("fills a call the ladder reaches, at its own price, from one shard, once", async () => {
    const { deps, board, pool, sent } = setup([callContract("c1", { start: NOW - 20, expiresSec: NOW + 70 })]);
    await restingPass(deps);
    expect(sent()).toHaveLength(1);
    const [tx] = sent();
    expect(tx!.commandId).toBe("restfill:c1:10");
    expect(tx!.commands[0]!.ExerciseCommand).toMatchObject({ choice: "Rest_Fill", contractId: "c1", choiceArgument: { shardCid: "shard1", fillLots: "10" } });
    // the depth it used is gone from the board until the pricer's next pass, and the shard left the pool
    expect(board.get({ termsCid: "00terms" })!.up[0]).toEqual([530, 90n]);
    expect(pool.stats().free).toBe(0);
  });

  it("a DOWN call is filled from the DOWN side of the ladder", async () => {
    const { deps, board, sent } = setup([callContract("c1", { start: NOW - 20, expiresSec: NOW + 70, side: "SideDown", priceTicks: "540", lots: "4" })], { ladder: { up: [[900, 10n]], down: [[530, 100n]] } });
    await restingPass(deps);
    expect(sent()[0]!.commands[0]!.ExerciseCommand.choiceArgument).toMatchObject({ fillLots: "4" });
    expect(board.get({ termsCid: "00terms" })!.down[0]).toEqual([530, 96n]);
  });

  it("fills only the depth the ladder has at the call's price; the rest keeps resting", async () => {
    const { deps, sent } = setup([callContract("c1", { start: NOW - 20, expiresSec: NOW + 70, lots: "100" })], { ladder: { up: [[530, 30n], [560, 500n]], down: [] } });
    await restingPass(deps);
    expect(sent()[0]!.commands[0]!.ExerciseCommand.choiceArgument).toMatchObject({ fillLots: "30" });
    expect(sent()[0]!.commandId).toBe("restfill:c1:30");
  });

  it("does nothing while the venue has no ladder or its best is under the call", async () => {
    const none = setup([callContract("c1", { start: NOW - 20, expiresSec: NOW + 70 })], { ladder: null });
    await restingPass(none.deps);
    expect(none.sent()).toHaveLength(0);
    const far = setup([callContract("c1", { start: NOW - 20, expiresSec: NOW + 70, priceTicks: "500" })]);
    await restingPass(far.deps);
    expect(far.sent()).toHaveLength(0);
  });

  it("sweeps a call past its expiry and an offer past its window, and never fills the swept call", async () => {
    const { deps, sent } = setup([callContract("c1", { start: NOW - 100, expiresSec: NOW - 5 }), offerContract("o1", NOW - 10)]);
    await restingPass(deps);
    expect(sent().map((s) => `${s.commandId} ${s.commands[0]!.ExerciseCommand.choice}`).sort()).toEqual(["restexp:c1 Rest_Expire", "restoexp:o1 RestOffer_Expire"]);
  });

  it("with the fill off, calls rest and refund but nothing fills them", async () => {
    const { deps, sent } = setup([callContract("c1", { start: NOW - 20, expiresSec: NOW + 70 }), callContract("c2", { start: NOW - 100, expiresSec: NOW - 5 })], { fillEnabled: false });
    const r = await restingPass(deps);
    expect(sent().map((s) => s.commands[0]!.ExerciseCommand.choice)).toEqual(["Rest_Expire"]);
    expect(r.why).toMatch(/FILL OFF/);
  });

  it("a call its owner cancelled first is done, not a failure, and the shard is free again", async () => {
    const gone = errorFromResponse("/v2/commands/submit-and-wait-for-transaction", 404, "application/json", JSON.stringify({ code: "CONTRACT_NOT_FOUND", cause: "Contract could not be found with id c1", errorCategory: 11, context: {} }));
    const { deps, pool, logs } = setup([callContract("c1", { start: NOW - 20, expiresSec: NOW + 70 })], { failWith: gone });
    const r = await restingPass(deps);
    expect(r.why).toMatch(/already ended 1, failed 0/);
    expect(logs.filter((l) => /refused/.test(l))).toHaveLength(0);
    expect(pool.stats().free).toBe(1);
  });
});
