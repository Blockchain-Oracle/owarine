import type { PrivatePositionRow } from "@agari/db";
import { describe, expect, it } from "vitest";
import { positionOf } from "./position";

/** A private call's projection row (C8d): its leg, its Window, and once settled the receipt that says what it paid. */
const row = (o: Partial<PrivatePositionRow> = {}): PrivatePositionRow => ({
  pair_id: "p-1", market_key: "BTC-5m:73", symbol: "BTC", cadence_sec: 300, expiry_sec: "1791270000", outcome: 0, lots: "10",
  backing_share: "4700000", fee_paid: "70000", status: "open", result: null, payout: null, dismissed: null, receipt_cid: null, paid_into: null,
  leg_paid: null, created_update_id: "1220aa", created_ts_sec: "1791269800", ...o,
});

describe("private call rows on abu-pm-main 0.5.2 (C2e, K-315)", () => {
  it("an open call is open, with nothing paid", () => {
    expect(positionOf(row())).toMatchObject({ status: "open", payoutBase: null, paidInto: null, costBase: "4770000" });
  });

  it("a win the settle paid into the private bucket is home at once, and says so", () => {
    const p = positionOf(row({ status: "settled", result: "won", receipt_cid: "r-1", payout: "10000000", dismissed: false, paid_into: "private" }));
    expect(p).toMatchObject({ status: "credited", result: "won", payoutBase: "10000000", paidInto: "private" });
  });

  it("a loss and a void paid into the private bucket are home too (payout 0; stake + fee)", () => {
    expect(positionOf(row({ status: "settled", result: "lost", receipt_cid: "r-2", payout: "0", dismissed: false, paid_into: "private" }))).toMatchObject({
      status: "credited", result: "lost", payoutBase: "0", paidInto: "private",
    });
    expect(positionOf(row({ status: "claimed", result: "void", receipt_cid: "r-3", payout: "4770000", dismissed: false, paid_into: "private" }))).toMatchObject({
      status: "credited", result: "void", payoutBase: "4770000", paidInto: "private",
    });
  });

  it("a stale refund leaves no receipt: the leg's own payout, home in the private bucket", () => {
    expect(positionOf(row({ status: "refunded_stale", leg_paid: "4770000" }))).toMatchObject({ status: "credited", payoutBase: "4770000", paidInto: "private" });
  });

  it("a 0.5.1 receipt paid the public balance: settled until its cash-out dismisses it", () => {
    const live = row({ status: "settled", result: "won", receipt_cid: "r-4", payout: "10000000", dismissed: false });
    expect(positionOf(live)).toMatchObject({ status: "settled", paidInto: null });
    expect(positionOf({ ...live, dismissed: true })).toMatchObject({ status: "credited", paidInto: null });
  });
});
