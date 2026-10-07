import { describe, expect, it, vi } from "vitest";
import type { LedgerClient } from "@owarine/ledger";
import { marketIdFromDaml } from "@owarine/core/market";
import { createLadderBoard } from "../market-maker/seat/ladder-board";
import { readPricerSettings } from "../market-maker/seat/pricer";
import { quoteReplyWire } from "@owarine/markets";
import { jsonText } from "../../http/health";
import { issueQuote, parseQuoteRequest } from "./issuer";
import { ShardPool } from "./pool";

const V = "venue::1220abcdef";
const SEAT = "seat-1::1220cdef01";
const MARKET = marketIdFromDaml("BTC-1m:9");

function setup() {
  const nowSec = Math.floor(Date.now() / 1000);
  const board = createLadderBoard();
  board.put({
    marketId: MARKET, damlMarketId: "BTC-1m:9", seriesId: "s", termsCid: "00aa", seriesKey: "BTC-1m", symbol: "BTC", index: 9, tradingStartSec: nowSec - 10, lockAtSec: nowSec + 40, expirySec: nowSec + 50,
    quotingUntilSec: nowSec + 35, cashUnit: 1000n, feeRateBps: 100, fairTicks: 500, sigmaBps: null, yearSec: null, minTick: 1, halfSpreadTicks: 30, openPriceE8: 1n, spotE8: 1n,
    up: [[530, 100n]], down: [[530, 100n]], asOfMs: Date.now(), state: "quoting",
  });
  const pool = new ShardPool({ venue: V, maxWaitMs: 50 });
  pool.sync([{ cid: "shard1", data: { venue: V, owner: V, amount: 2_000_000_000n, bucket: "shard" } }]);
  const createdAt = "";
  const submitAndWaitForTransaction = vi.fn(async () => ({
    transaction: {
      updateId: "u", offset: 9, effectiveAt: "", synchronizerId: "", recordTime: "",
      events: [
        { ArchivedEvent: { contractId: "shard1", offset: 9, nodeId: 0, templateId: "p:PM.Money:VenueCash", packageName: "abu-pm-main", witnessParties: [V] } },
        { CreatedEvent: { contractId: "quote1", templateId: "p:PM.Quote:Quote", createArgument: { validUntil: new Date((nowSec + 20) * 1000).toISOString() }, offset: 9, nodeId: 1, packageName: "abu-pm-main", witnessParties: [V], signatories: [V], createdAt } },
        { CreatedEvent: { contractId: "change1", templateId: "p:PM.Money:VenueCash", createArgument: { venue: V, owner: V, amount: "1995300000", bucket: "shard" }, offset: 9, nodeId: 2, packageName: "abu-pm-main", witnessParties: [V], signatories: [V], createdAt } },
      ],
    },
    submissionId: "s", attempts: 1, recovered: false,
  }));
  const client = { submitAndWaitForTransaction, ledgerEnd: async () => 8 } as unknown as LedgerClient;
  const deps = { venue: { role: "venue", party: V, client, dryRun: false }, deskCid: async () => "desk1", board, pool, settings: readPricerSettings({}), infrastructure: new Set([V]), log: () => {} };
  return { deps, pool, board, submitAndWaitForTransaction };
}

const body = (over: Record<string, unknown> = {}) => ({ party: SEAT, leaseId: "lease-1", marketId: MARKET, side: "up", stakeBase: "5000000", displayedMaxCostBase: "5000000", ...over });

describe("quote issuer", () => {
  it("validates the request before anything else", () => {
    expect(parseQuoteRequest({ ...body(), party: "alice" })).toBe("party must be a party id");
    expect(parseQuoteRequest({ ...body(), stakeBase: 5 })).toMatch(/stakeBase/);
    expect(parseQuoteRequest({ ...body(), marketId: "BTC-1m:9" })).toMatch(/base58/);
    expect(parseQuoteRequest(body())).toMatchObject({ stakeBase: 5_000_000n, side: "up", leaseId: "lease-1" });
  });

  it("issues a firm quote on a leased shard, in the web's reply shape, and the change joins the pool", async () => {
    const { deps, pool, board, submitAndWaitForTransaction } = setup();
    const r = await issueQuote(deps, parseQuoteRequest(body()) as never);
    expect(r.status).toBe(200);
    expect(quoteReplyWire.parse(JSON.parse(jsonText(r.body)))).toMatchObject({
      kind: "quote", quoteCid: "quote1",
      quote: { side: "up", stakeBase: 5_000_000n, contractsRaw: 9_000_000n, avgPriceBps: 5300, limitPriceRaw: 530_000n, maxCostBase: 4_770_000n + 22_419n, decimals: 6 },
    });
    const sent = (submitAndWaitForTransaction.mock.calls[0] as unknown as [{ commandId: string; commands: Array<{ ExerciseCommand: { choice: string; choiceArgument: Record<string, unknown> } }> }])[0];
    expect(sent.commandId).toMatch(/^quote:[0-9a-f-]{36}$/);
    expect(sent.commands[0]!.ExerciseCommand).toMatchObject({ choice: "Desk_IssueQuote", choiceArgument: { shardCid: "shard1", user: SEAT, side: "SideUp", priceTicks: "530", lots: "9" } });
    expect(pool.all().map((s) => [s.cid, s.state])).toEqual([["change1", "free"]]);
    expect(board.get({ marketId: MARKET })!.up).toEqual([[530, 91n]]);
  });

  it("answers a requote and creates nothing when the cost is above the confirmed cap", async () => {
    const { deps, submitAndWaitForTransaction } = setup();
    const r = await issueQuote(deps, parseQuoteRequest(body({ displayedMaxCostBase: "1000" })) as never);
    expect(quoteReplyWire.parse(JSON.parse(jsonText(r.body)))).toMatchObject({ kind: "requote", quote: { avgPriceBps: 5300 } });
    expect(submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it("refuses an infrastructure party, a draining seat, a Window not quoting, and a busy pool", async () => {
    const { deps, pool } = setup();
    expect((await issueQuote({ ...deps, draining: new Set([SEAT]) }, parseQuoteRequest(body()) as never)).body).toMatchObject({ kind: "refused", diagnosis: { kind: "market-not-trading" } });
    expect((await issueQuote(deps, parseQuoteRequest(body({ party: V })) as never)).body).toMatchObject({ kind: "refused", diagnosis: { kind: "unknown" } });
    expect((await issueQuote(deps, parseQuoteRequest(body({ marketId: marketIdFromDaml("BTC-1m:8") })) as never)).body).toMatchObject({ kind: "refused", diagnosis: { kind: "market-not-trading" } });
    await pool.lease(1n, "hold");
    expect((await issueQuote(deps, parseQuoteRequest(body()) as never)).body).toMatchObject({ kind: "refused", diagnosis: { kind: "rpc-down", retryable: true } });
  });
});
