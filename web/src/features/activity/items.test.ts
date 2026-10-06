import type { SocialFillRow, SocialSettlementRow } from "@agari/db";
import { expect, it } from "vitest";
import { fillItem, settlementFacts, settlementItems } from "./items";

const fill = (over: Partial<SocialFillRow>): SocialFillRow => ({
  signature: "3VFzTVV7FJkaksFDrQtsuJFfaT437SKBx6Gwd93fPLnken3Fuv7tDjpYNq3rA5nQtTKppincNuwWWoDhcJR1SURg",
  outer_ix: 0,
  inner_ix: 0,
  fill_ix: 0,
  market: "4SCCa1z6oYARC8BNPHsuCaaTdycuN6wuYGADgeBBMgki",
  wallet: "DcCD3pcMnnnfigaS5BzyKCkcyLxDjhcDutQKcYYuzZvP",
  kind: 0,
  seat: "taker",
  symbol: "TSLA",
  cadence_sec: 300,
  lots: "1000",
  amount_base: "550000",
  ts_sec: "1789397131",
  ...over,
});

it("reads a fill from the taker's seat as a call and from the maker's seat as a resting call that filled (D-088)", () => {
  expect(fillItem(fill({}))).toMatchObject({ kind: "fill", side: "up", lots: "1000", amountBase: "550000" });
  expect(fillItem(fill({ seat: "maker", kind: 2 }))).toMatchObject({ kind: "resting-filled", side: "down" });
  expect(fillItem(fill({ seat: "maker" })).id).toBe(fillItem(fill({})).id);
});

/** The two drive wallets' seats on devnet TSLA 5m Window 4SCCa1z6… (S2 drive, 2026-09-14), as the index holds them. */
const seat = (over: Partial<SocialSettlementRow>): SocialSettlementRow => ({
  market: "4SCCa1z6oYARC8BNPHsuCaaTdycuN6wuYGADgeBBMgki",
  owner: "DcCD3pcMnnnfigaS5BzyKCkcyLxDjhcDutQKcYYuzZvP",
  symbol: "TSLA",
  cadence_sec: 300,
  state: "resolved",
  winner: 0,
  resolved_ts_sec: "1789397131",
  expiry_sec: "1789397100",
  held_yes_lots: "2000",
  held_no_lots: "0",
  lot_base: "1000",
  cost_base: "2480000",
  proceeds_base: "1400000",
  redeemed: true,
  redeemed_by_crank: false,
  payout_base: "2000000",
  last_signature: "3VFzTVV7FJkaksFDrQtsuJFfaT437SKBx6Gwd93fPLnken3Fuv7tDjpYNq3rA5nQtTKppincNuwWWoDhcJR1SURg",
  last_ts_sec: "1789397143",
  ...over,
});

it("pays the held Up leg on an Up win and nets the round's cash", () => {
  const facts = settlementFacts(seat({}));
  expect(facts.payoutBase).toBe(2_000_000n);
  expect(facts.pnlBase).toBe(920_000n);
  expect(facts.verdict).toBe("settled-win");
});

it("calls a hedged seat that was paid but lost money a loss", () => {
  const hedged = seat({ owner: "5jVoTHRN6uydxNEbxXDvNm5gbkyV5Y7oypgRureA3wjU", held_yes_lots: "1000", held_no_lots: "3000", cost_base: "2220000", proceeds_base: "300000", payout_base: "1000000" });
  const facts = settlementFacts(hedged);
  expect(facts.payoutBase).toBe(1_000_000n);
  expect(facts.pnlBase).toBe(-920_000n);
  expect(facts.verdict).toBe("settled-loss");
  expect(settlementItems(hedged, { payouts: true }).map((i) => [i.kind, i.amountBase, i.side])).toEqual([["settled-loss", "-920000", "down"]]);
});

it("gives no verdict to a seat that sold out before expiry", () => {
  expect(settlementItems(seat({ held_yes_lots: "0", payout_base: "0" }), { payouts: true })).toEqual([]);
});

/**
 * C9e: a void on Canton returns each leg's backing plus the fee paid at the fill (`PM.Leg.legPayout`), never half a
 * contract. A 10-contract Up leg bought at 400 ticks: backing 4.00, fee 0.05, so the void pays 4.05 and the round nets 0.
 */
const cantonVoid = seat({ state: "voided", winner: 2, held_yes_lots: "10000", held_no_lots: "0", cost_base: "4050000", proceeds_base: "0", redeemed: false, payout_base: "0" });

it("refunds a void's backing plus fee from the row's cost, and says it is claimable until paid", () => {
  const facts = settlementFacts(cantonVoid);
  expect(facts.payoutBase).toBe(4_050_000n);
  expect(facts.payoutBase).not.toBe(5_000_000n);
  expect(facts.pnlBase).toBe(0n);
  expect(settlementItems(cantonVoid, { payouts: true }).map((i) => [i.kind, i.amountBase])).toEqual([
    ["voided", "4050000"],
    ["claimable", "4050000"],
  ]);
});

it("reads what the ledger paid once the legs closed, and a two-sided void refunds both legs' cost", () => {
  const paid = seat({ ...cantonVoid, redeemed: true, redeemed_by_crank: true, payout_base: "4050000" });
  expect(settlementItems(paid, { payouts: true }).map((i) => [i.kind, i.amountBase])).toEqual([
    ["voided", "4050000"],
    ["paid-automatically", "4050000"],
  ]);
  const both = seat({ ...cantonVoid, held_no_lots: "3000", cost_base: "5860000" });
  expect(settlementFacts(both).payoutBase).toBe(5_860_000n);
  expect(settlementFacts(both).verdict).toBe("voided");
});

it("pays a Canton win one credit per contract with the fee already in the cost: nothing is taken at settlement", () => {
  const won = seat({ ...cantonVoid, state: "resolved", winner: 0 });
  expect(settlementFacts(won).payoutBase).toBe(10_000_000n);
  expect(settlementFacts(won).pnlBase).toBe(5_950_000n);
  expect(settlementFacts(seat({ ...cantonVoid, state: "resolved", winner: 1 })).verdict).toBe("settled-loss");
});

it("reports the settler's crank payout with the crank's signature and time", () => {
  const crank = seat({ redeemed_by_crank: true, last_ts_sec: "1789397431" });
  const paid = settlementItems(crank, { payouts: true }).find((i) => i.kind === "paid-automatically");
  expect(paid).toMatchObject({ amountBase: "2000000", signature: crank.last_signature, atSec: 1789397431 });
  expect(settlementItems(crank, { payouts: false }).map((i) => i.kind)).toEqual(["settled-win"]);
});
