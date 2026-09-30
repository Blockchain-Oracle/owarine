import { describe, expect, it } from "vitest";
import { decodeAllowance, decodeHoldingView, decodeListing, decodeProposal, decodeStatement, decodeTransferInstructionView, decodeWithdrawal, interfaceViewOf } from "./decode";

describe("abu-pm-cc payloads (C7b)", () => {
  it("reads a listing with its Ints as bigints and its rate as an integer", () => {
    const l = decodeListing({ venue: "v", auditor: "a", listingId: "cc-1", instrumentAdmin: "dso", instrumentId: "Amulet", unitsPerCoin: "100000", minDepositUnits: "100", maxDepositUnits: "100000000000", depositsOpen: true });
    expect(l).toMatchObject({ unitsPerCoin: 100_000n, minDepositUnits: 100n, maxDepositUnits: 100_000_000_000n, depositsOpen: true });
    expect(() => decodeListing({ ...l, unitsPerCoin: 100000 })).toThrow();
  });

  it("reads allowances, proposals and statements", () => {
    expect(decodeAllowance({ venue: "v", auditor: "a", owner: "o", listingId: "cc-1", units: "42" }).units).toBe(42n);
    expect(decodeProposal({ owner: "o", venue: "v", listingId: "cc-1", units: "7", ref: "r" }).units).toBe(7n);
    const s = decodeStatement({
      venue: "v", auditor: "a", listingId: "cc-1", instrumentAdmin: "d", instrumentId: "Amulet", unitsPerCoin: "100000", seq: "3", "asOf": "2026-10-01T12:00:00Z",
      heldAtomic: "600000000", heldUnits: "6000", liabilityUnits: "5000", allowanceCount: "2", covered: true,
    });
    expect(s).toMatchObject({ seq: 3, heldAtomic: 600_000_000n, covered: true, allowanceCount: 2, asOfSec: Date.parse("2026-10-01T12:00:00Z") / 1000 });
  });

  it("reads a withdrawal's state and instruction", () => {
    const base = {
      venue: "v", owner: "o", auditor: "a", listingId: "cc-1", instrumentAdmin: "d", instrumentId: "Amulet", unitsPerCoin: "100000", units: "5", sentAtomic: "500000",
      openedAt: "2026-10-01T12:00:00Z", ref: "r",
    };
    expect(decodeWithdrawal({ ...base, state: "WdSent", instructionCid: "00i" })).toMatchObject({ state: "WdSent", instructionCid: "00i" });
    expect(decodeWithdrawal({ ...base, state: "WdRefunded", instructionCid: null }).instructionCid).toBeNull();
    expect(() => decodeWithdrawal({ ...base, state: "Gone", instructionCid: null })).toThrow(/unknown/);
  });
});

describe("CIP-56 views (C7b)", () => {
  it("reads a holding's Decimal exactly, with or without a lock", () => {
    const h = decodeHoldingView({ owner: "o", instrumentId: { admin: "dso", id: "Amulet" }, amount: "12.3456789012", lock: null, meta: { values: { k: "v" } } });
    expect(h).toMatchObject({ owner: "o", instrumentAdmin: "dso", instrumentId: "Amulet", amountAtomic: 123_456_789_012n, lock: null, meta: { k: "v" } });
    const locked = decodeHoldingView({ owner: "o", instrumentId: { admin: "dso", id: "Amulet" }, amount: "1.0", lock: { holders: ["a", "b"], expiresAt: "2026-10-01T12:00:00Z", expiresAfter: null, context: "why" }, meta: { values: {} } });
    expect(locked.lock).toEqual({ holders: ["a", "b"], expiresAtSec: Date.parse("2026-10-01T12:00:00Z") / 1000, context: "why" });
    expect(() => decodeHoldingView({ owner: "o", instrumentId: { admin: "d", id: "x" }, amount: 1.5, lock: null, meta: { values: {} } })).toThrow();
  });

  it("reads a transfer instruction's status variant", () => {
    const view = (status: unknown) => ({
      originalInstructionCid: null,
      transfer: { sender: "s", receiver: "r", amount: "2.5", instrumentId: { admin: "d", id: "Amulet" }, requestedAt: "2026-10-01T11:00:00Z", executeBefore: "2026-10-01T13:00:00Z", inputHoldingCids: [], meta: { values: {} } },
      status, meta: { values: {} },
    });
    expect(decodeTransferInstructionView(view({ tag: "TransferPendingReceiverAcceptance", value: {} }))).toMatchObject({ status: "PendingReceiverAcceptance", amountAtomic: 25_000_000_000n });
    expect(decodeTransferInstructionView(view({ tag: "TransferPendingInternalWorkflow", value: { pendingActions: {} } })).status).toBe("PendingInternalWorkflow");
    expect(() => decodeTransferInstructionView(view({ tag: "Other" }))).toThrow(/unknown/);
  });

  it("finds an interface view by name in either package form, and drops one the ledger could not render", () => {
    const event = { interfaceViews: [{ interfaceId: "abcd:Splice.Api.Token.HoldingV1:Holding", viewStatus: { code: 0 }, viewValue: { x: 1 } }] };
    expect(interfaceViewOf(event, "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding")).toEqual({ x: 1 });
    expect(interfaceViewOf(event, "#p:Splice.Api.Token.HoldingV1:Other")).toBeNull();
    expect(interfaceViewOf({ interfaceViews: [{ interfaceId: "a:M:H", viewStatus: { code: 3 }, viewValue: {} }] }, "#p:M:H")).toBeNull();
    expect(interfaceViewOf({}, "#p:M:H")).toBeNull();
  });
});
