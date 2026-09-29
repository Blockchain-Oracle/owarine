import { describe, expect, it } from "vitest";
import { errorFromResponse, type JsTransaction } from "@agari/ledger";
import type { LegView, TermsView } from "./contracts";
import { appMarketId } from "./ids";
import { ladderMid2, openPositions } from "./map";
import { classifyRejection } from "./rejection";
import { bookedSaleFrom } from "./writes";

const DAML_ID = "PRB-60:0";
const MARKET = appMarketId(DAML_ID);
const T = Date.parse("2026-09-29T12:00:00Z");
const SEAT = "seat-1::1220cdef01";
const V = "venue::1220abcdef";
const terms: TermsView = { cid: "00terms", damlMarketId: DAML_ID, marketId: MARKET, seriesKey: "PRB-60", symbol: "PRB", cashUnit: 10n, tradingStartMs: T, lockAtMs: T + 50_000, expiryMs: T + 60_000, refundAfterMs: T + 900_000 };
const leg = (o: Partial<LegView> = {}): LegView => ({
  cid: "00leg", damlMarketId: DAML_ID, marketId: MARKET, termsCid: "00terms", pairId: "p1", side: "up", lots: 100n, cashUnit: 10n,
  backingShare: 620_000n, feePaid: 1_414n, refundAfterMs: T + 900_000, createdAtMs: T, ...o,
});

describe("positions at the ladder mid (C7a)", () => {
  it("takes the mid of Up's ask and Up's bid (1000 − Down's ask), doubled so a half tick stays exact", () => {
    expect(ladderMid2({ up: [[530, "1"]], down: [[480, "1"]], state: "quoting" })).toBe(530 + 520);
    expect(ladderMid2({ up: [[530, "1"]], down: [], fairTicks: 512, state: "quoting" })).toBe(1024);
    expect(ladderMid2({ up: [[530, "1"]], down: [[480, "1"]], state: "closed" })).toBeNull();
  });

  it("marks Up and Down lots at the mid, and at entry where no ladder quotes", () => {
    const up = leg();
    const down = leg({ cid: "00leg2", side: "down", lots: 10n, backingShare: 38_000n });
    // 100 lots Up = 1,000,000 contracts; 10 lots Down = 100,000. mid2 1051: Up × 1051/2000, Down × 949/2000.
    const [row] = openPositions([up, down], new Map([["00terms", terms]]), 6, new Map([["00terms", 1051]]));
    expect(row!.markValueBase).toBe((1_000_000n * 1051n + 100_000n * 949n) / 2000n);
    const [entry] = openPositions([up], new Map([["00terms", terms]]), 6);
    expect(entry!.markValueBase).toBe(620_000n);
  });
});

describe("a sale's booking and rejections (C7a)", () => {
  const createdAt = new Date(T).toISOString();
  const created = (contractId: string, entity: string, createArgument: Record<string, unknown>) => ({
    CreatedEvent: { contractId, templateId: `pkg:${entity}`, createArgument, offset: 9, nodeId: 1, packageName: "abu-pm-main", witnessParties: [SEAT], signatories: [V], createdAt },
  });
  const legArg = (owner: string, lots: string) => ({
    venue: V, owner, termsCid: "00terms", marketId: DAML_ID, pairId: "p1", outcome: "SideUp", lots, cashUnit: "10", backingShare: "310000", feePaid: "0",
    refundAfter: new Date(T + 900_000).toISOString(), beneficiaryRef: null,
  });

  it("books proceeds from the sale cash and lots from the venue's new legs, never the seat's remainder", () => {
    const tx = {
      updateId: "1220aa", offset: 9, effectiveAt: "", synchronizerId: "", recordTime: "", commandId: "sell:x", workflowId: "",
      events: [
        created("c1", "PM.Money:VenueCash", { venue: V, owner: SEAT, amount: "228000", bucket: "sale" }),
        created("c2", "PM.Leg:Leg", legArg(V, "50")),
        created("c3", "PM.Leg:Leg", legArg(SEAT, "50")),
        created("c4", "PM.Money:VenueCash", { venue: V, owner: V, amount: "707", bucket: "fee" }),
      ],
    } as unknown as JsTransaction;
    expect(bookedSaleFrom(tx, SEAT)).toMatchObject({ marketId: MARKET, side: "up", contractsRaw: 500_000n, costBase: 0n, proceedsBase: 228_000n, avgPriceBps: 4560, fillCount: 1 });
  });

  it("a gone buy-back is the held price lapsing; a gone leg was settled or claimed first", () => {
    const notFound = (cid: string) => errorFromResponse("/v2/commands/submit-and-wait-for-transaction", 404, "application/json", JSON.stringify({ code: "CONTRACT_NOT_FOUND", cause: `Contract could not be found with id ${cid}`, errorCategory: 11, context: {} }));
    const ctx = { step: "sell" as const, buyQuoteCids: ["00b0"], legCids: ["00e1"] };
    expect(classifyRejection(notFound("00b0"), ctx).kind).toBe("order-expired");
    expect(classifyRejection(notFound("00e1"), ctx).kind).toBe("already-claimed");
  });
});
