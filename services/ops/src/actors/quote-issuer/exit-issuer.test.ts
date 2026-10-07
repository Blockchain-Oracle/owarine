import { describe, expect, it, vi } from "vitest";
import type { LedgerClient } from "@owarine/ledger";
import { marketIdFromDaml } from "@owarine/core/market";
import { exitQuoteReplyWire } from "@owarine/markets";
import { allocateLegs, bidLevels, walkExit } from "@owarine/markets/ops/canton";
import { createLadderBoard } from "../market-maker/seat/ladder-board";
import { readPricerSettings } from "../market-maker/seat/pricer";
import { jsonText } from "../../http/health";
import { issueExitQuote, parseExitRequest } from "./exit-issuer";
import { ShardPool } from "./pool";

const V = "venue::1220abcdef";
const SEAT = "seat-1::1220cdef01";
const MARKET = marketIdFromDaml("BTC-1m:9");
const CU = 1000n;
const iso = (sec: number) => new Date(sec * 1000).toISOString();

type Created = { contractId: string; templateId: string; createArgument: Record<string, unknown> };

function setup(legs: Array<{ cid: string; lots: number; outcome?: string; owner?: string }>, extra: Created[] = []) {
  const nowSec = Math.floor(Date.now() / 1000);
  const board = createLadderBoard();
  board.put({
    marketId: MARKET, damlMarketId: "BTC-1m:9", seriesId: "s", termsCid: "00aa", seriesKey: "BTC-1m", symbol: "BTC", index: 9, tradingStartSec: nowSec - 10, lockAtSec: nowSec + 40, expirySec: nowSec + 50,
    quotingUntilSec: nowSec + 35, cashUnit: CU, feeRateBps: 100, fairTicks: 500, sigmaBps: null, yearSec: null, minTick: 1, halfSpreadTicks: 30, openPriceE8: 1n, spotE8: 1n,
    // Up's bids are Down's ladder mirrored: 1000 − 540 = 460 for 30 lots, then 450 for 100.
    up: [[530, 100n]], down: [[540, 30n], [550, 100n]], asOfMs: Date.now(), state: "quoting",
  });
  const pool = new ShardPool({ venue: V, maxWaitMs: 50 });
  pool.sync([1, 2, 3].map((i) => ({ cid: `shard${i}`, data: { venue: V, owner: V, amount: 1_000_000_000n, bucket: "shard" } })));
  const leg = (l: (typeof legs)[number]): Created => ({
    contractId: l.cid, templateId: "p:PM.Leg:Leg",
    createArgument: {
      venue: V, owner: l.owner ?? SEAT, termsCid: "00aa", marketId: "BTC-1m:9", pairId: `p-${l.cid}`, outcome: l.outcome ?? "SideUp", lots: String(l.lots), cashUnit: "1000",
      backingShare: String(l.lots * 520 * 1000), feePaid: "100", refundAfter: iso(nowSec + 900), beneficiaryRef: null,
    },
  });
  const activeContracts = vi.fn(async () => ({ activeAtOffset: 5, contracts: [...legs.map(leg), ...extra].map((createdEvent) => ({ createdEvent, synchronizerId: "sync" })) }));
  const createdAt = "";
  const submitAndWaitForTransaction = vi.fn(async (input: { commands: Array<{ ExerciseCommand: { choice: string } }> }) => ({
    transaction: {
      updateId: "u", offset: 9, effectiveAt: "", synchronizerId: "", recordTime: "",
      events: input.commands.filter((c) => c.ExerciseCommand.choice === "Desk_IssueBuyQuote").map((_, i) => ({
        CreatedEvent: { contractId: `bq${i}`, templateId: "p:PM.Quote:BuyQuote", createArgument: {}, offset: 9, nodeId: i, packageName: "abu-pm-main", witnessParties: [V], signatories: [V], createdAt },
      })),
    },
    submissionId: "s", attempts: 1, recovered: false,
  }));
  const client = { activeContracts, submitAndWaitForTransaction, ledgerEnd: async () => 8 } as unknown as LedgerClient;
  const deps = { venue: { role: "venue", party: V, client, dryRun: false }, deskCid: async () => "desk1", board, pool, settings: readPricerSettings({}), infrastructure: new Set([V]), log: () => {} };
  return { deps, board, submitAndWaitForTransaction };
}

const body = (over: Record<string, unknown> = {}) => ({ party: SEAT, leaseId: "lease-1", marketId: MARKET, side: "up", contractsRaw: String(50n * 1000n * CU), displayedMinProceedsBase: "1", ...over });
const sentOf = (m: ReturnType<typeof setup>["submitAndWaitForTransaction"]) =>
  (m.mock.calls[0] as unknown as [{ commandId: string; commands: Array<{ ExerciseCommand: { choice: string; choiceArgument: Record<string, unknown> } }> }])[0];

describe("exit kernel", () => {
  it("mirrors the opposite ladder into bids and walks them for one floored price", () => {
    const bids = bidLevels({ up: [[530, 100n]], down: [[540, 30n], [550, 100n]] }, "up");
    expect(bids).toEqual([[460, 30n], [450, 100n]]);
    // 30 × 460 + 20 × 450 = 22,800 over 50 lots: 456 exactly
    expect(walkExit(bids, 50n, CU)).toEqual({ lots: 50n, priceTicks: 456, proceedsBase: 50n * 456n * CU });
    // 30 × 460 + 1 × 450 = 14,250 over 31: 459.67… floors to 459
    expect(walkExit(bids, 31n, CU)?.priceTicks).toBe(459);
    expect(walkExit(bids, 500n, CU)?.lots).toBe(130n);
    expect(walkExit([], 5n, CU)).toBeNull();
  });

  it("takes whole legs largest first, then part of the next, capped in legs", () => {
    const legs = [{ cid: "a", lots: 10n }, { cid: "b", lots: 60n }, { cid: "c", lots: 30n }];
    expect(allocateLegs(legs, 50n, 4).map((p) => [p.leg.cid, p.sell])).toEqual([["b", 50n]]);
    expect(allocateLegs(legs, 75n, 4).map((p) => [p.leg.cid, p.sell])).toEqual([["b", 60n], ["c", 15n]]);
    expect(allocateLegs(legs, 100n, 2).map((p) => [p.leg.cid, p.sell])).toEqual([["b", 60n], ["c", 30n]]);
  });
});

describe("exit issuer", () => {
  it("validates the request", () => {
    expect(parseExitRequest({ ...body(), contractsRaw: "0" })).toMatch(/contractsRaw/);
    expect(parseExitRequest({ ...body(), party: "alice" })).toBe("party must be a party id");
    expect(parseExitRequest(body())).toMatchObject({ contractsRaw: 50_000_000n, side: "up" });
  });

  it("sells half of one leg: a partial BuyQuote at the walked bid, the bid side's depth consumed", async () => {
    const { deps, board, submitAndWaitForTransaction } = setup([{ cid: "leg1", lots: 100 }]);
    const r = await issueExitQuote(deps, parseExitRequest(body()) as never);
    expect(exitQuoteReplyWire.parse(JSON.parse(jsonText(r.body)))).toMatchObject({
      kind: "quote", quoteCids: ["bq0"],
      exit: { contractsRaw: 50_000_000n, expectedProceedsBase: 22_800_000n, minProceedsBase: 22_800_000n, avgPriceBps: 4560, limitPriceRaw: 456_000n },
    });
    const sent = sentOf(submitAndWaitForTransaction);
    expect(sent.commandId).toMatch(/^exitquote:[0-9a-f-]{36}$/);
    expect(sent.commands).toHaveLength(1);
    expect(sent.commands[0]!.ExerciseCommand).toMatchObject({ choice: "Desk_IssueBuyQuote", choiceArgument: { legCid: "leg1", priceTicks: "456", sellLots: "50" } });
    expect(board.get({ marketId: MARKET })!.down).toEqual([[550, 80n]]);
  });

  it("sells a whole leg without sellLots, spans legs, and withdraws the seat's earlier buy-backs on the Window", async () => {
    const stale: Created = { contractId: "old-bq", templateId: "p:PM.Quote:BuyQuote", createArgument: { venue: V, user: SEAT, legCid: "leg1", termsCid: "00aa", pairId: "p", outcome: "SideUp", lots: "40", cashUnit: "1000", priceTicks: "400", locked: "16000000", validUntil: iso(1) } };
    const { deps, submitAndWaitForTransaction } = setup([{ cid: "leg1", lots: 40 }, { cid: "leg2", lots: 30 }, { cid: "down", lots: 99, outcome: "SideDown" }, { cid: "theirs", lots: 99, owner: "seat-2::1220cdef02" }], [stale]);
    const r = await issueExitQuote(deps, parseExitRequest(body({ contractsRaw: String(60n * 1000n * CU) })) as never);
    expect(r.body).toMatchObject({ kind: "quote", quoteCids: ["bq0", "bq1"] });
    const choices = sentOf(submitAndWaitForTransaction).commands.map((c) => [c.ExerciseCommand.choice, c.ExerciseCommand.choiceArgument.legCid ?? null, c.ExerciseCommand.choiceArgument.sellLots ?? null]);
    expect(choices).toEqual([["BuyQuote_Withdraw", null, null], ["Desk_IssueBuyQuote", "leg1", null], ["Desk_IssueBuyQuote", "leg2", "20"]]);
  });

  it("answers a requote below the confirmed floor, and refuses nothing held, no bids and a locked Window", async () => {
    const { deps, submitAndWaitForTransaction } = setup([{ cid: "leg1", lots: 100 }]);
    const requote = await issueExitQuote(deps, parseExitRequest(body({ displayedMinProceedsBase: "22800001" })) as never);
    expect(requote.body).toMatchObject({ kind: "requote", exit: { minProceedsBase: 22_800_000n } });
    expect(submitAndWaitForTransaction).not.toHaveBeenCalled();
    expect((await issueExitQuote(deps, parseExitRequest(body({ side: "down" })) as never)).body).toMatchObject({ kind: "refused", diagnosis: { kind: "contract-revert" } });
    expect((await issueExitQuote(deps, parseExitRequest(body({ marketId: marketIdFromDaml("BTC-1m:8") })) as never)).body).toMatchObject({ kind: "refused", diagnosis: { kind: "market-not-trading" } });
    const dry = setup([{ cid: "leg1", lots: 100 }]);
    dry.board.put({ ...dry.board.get({ marketId: MARKET })!, down: [] });
    expect((await issueExitQuote(dry.deps, parseExitRequest(body()) as never)).body).toMatchObject({ kind: "refused", diagnosis: { kind: "no-liquidity" } });
  });
});
