import { describe, expect, it } from "vitest";
import { AGENT_TEMPLATE_IDS, CC_TEMPLATE_IDS, GAMES_TEMPLATE_IDS, TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import type { CreatedEvent } from "@agari/ledger";
import { holdingsOf, holdingsText, isSeatEmpty } from "./seat-holdings";

const SEAT = "agari-user-seat-1::1220aa";
const OTHER = "agari-user-seat-2::1220bb";
const VENUE = "venue::1220ff";
const NOW = Date.parse("2026-09-29T12:00:00Z");
const LATER = "2026-09-29T12:05:00Z";
const EARLIER = "2026-09-29T11:55:00Z";

let n = 0;
const ev = (templateId: string, arg: Record<string, unknown>): CreatedEvent => ({ templateId, contractId: `00c${n++}`, createArgument: { venue: VENUE, ...arg } }) as unknown as CreatedEvent;
/** The same template under its package hash instead of its package name: the participant may answer either. */
const hashed = (templateId: string) => `8cb07279eb4d${templateId.slice(templateId.indexOf(":"))}`;

describe("seat holdings (C9d)", () => {
  it("a seat holding only cash is empty, and its cash is listed for the sweep", () => {
    const h = holdingsOf(SEAT, [ev(TEMPLATE_IDS.VenueCash, { owner: SEAT, amount: "5" }), ev(TEMPLATE_IDS.VenueCash, { owner: OTHER, amount: "7" })], NOW);
    expect(isSeatEmpty(h)).toBe(true);
    expect(h.cash).toHaveLength(1);
    expect(holdingsText(h)).toBe("nothing");
  });

  it("an open leg holds the seat, whatever its market's state, and under either template-id form", () => {
    const h = holdingsOf(SEAT, [ev(TEMPLATE_IDS.Leg, { owner: SEAT }), ev(hashed(TEMPLATE_IDS.Leg), { owner: SEAT }), ev(TEMPLATE_IDS.Leg, { owner: OTHER })], NOW);
    expect(h.counts.legs).toBe(2);
    expect(isSeatEmpty(h)).toBe(false);
    expect(holdingsText(h)).toBe("2 legs");
  });

  it("a live quote holds the seat; an expired one does not", () => {
    const h = holdingsOf(SEAT, [
      ev(TEMPLATE_IDS.Quote, { user: SEAT, validUntil: LATER }),
      ev(TEMPLATE_IDS.Quote, { user: SEAT, validUntil: EARLIER }),
      ev(TICKET_TEMPLATE_IDS.RangeQuote, { user: SEAT, validUntil: EARLIER }),
      ev(TEMPLATE_IDS.WithdrawQuote, { provider: SEAT, validUntil: LATER }),
    ], NOW);
    expect(h.counts.quotes).toBe(2);
  });

  it("counts duels (as creator or challenger), tickets, Earn shares and agent grants", () => {
    const h = holdingsOf(SEAT, [
      ev(GAMES_TEMPLATE_IDS.DuelOpen, { creator: SEAT, challenger: OTHER }),
      ev(GAMES_TEMPLATE_IDS.DuelMatch, { creator: OTHER, challenger: SEAT }),
      ev(GAMES_TEMPLATE_IDS.DuelMatch, { creator: OTHER, challenger: "x::1220cc" }),
      ev(TICKET_TEMPLATE_IDS.RangeRound, { owner: SEAT }),
      ev(TICKET_TEMPLATE_IDS.ParlayTicket, { owner: SEAT }),
      ev(TICKET_TEMPLATE_IDS.BoostPosition, { owner: SEAT }),
      ev(TEMPLATE_IDS.LpShare, { provider: SEAT, reserveId: "range", shares: "1200" }),
      ev(TEMPLATE_IDS.AgentGrant, { owner: SEAT, agent: OTHER }),
      ev(AGENT_TEMPLATE_IDS.Subscription, { subscriber: SEAT, creator: OTHER }),
      ev(AGENT_TEMPLATE_IDS.DeskMandate, { owner: SEAT }),
    ], NOW);
    expect(h.counts).toEqual({ legs: 0, quotes: 0, tickets: 3, shares: 1, duels: 2, agents: 3, creator: 0, coin: 0 });
    expect(h.lpShares).toEqual([{ cid: expect.any(String), reserveId: "range", shares: 1200n }]);
    expect(holdingsText(h)).toBe("3 tickets, 1 Earn share, 2 duels, 3 agent grants");
  });

  it("a subscription the seat CREATED as a strategy's creator is not the seat's consent", () => {
    const h = holdingsOf(SEAT, [ev(AGENT_TEMPLATE_IDS.Subscription, { subscriber: OTHER, creator: SEAT })], NOW);
    expect(isSeatEmpty(h)).toBe(true);
  });

  it("a live strategy the seat published, or a fee payout made to it, holds the seat; a deactivated strategy does not (C8i)", () => {
    const h = holdingsOf(SEAT, [
      ev(AGENT_TEMPLATE_IDS.Strategy, { creator: SEAT, active: true }),
      ev(AGENT_TEMPLATE_IDS.Strategy, { creator: SEAT, active: false }),
      ev(AGENT_TEMPLATE_IDS.Strategy, { creator: OTHER, active: true }),
      ev(AGENT_TEMPLATE_IDS.CreatorPayout, { creator: SEAT, amount: "500000", feeCount: "1" }),
      ev(AGENT_TEMPLATE_IDS.CreatorPayout, { creator: OTHER, amount: "500000", feeCount: "1" }),
    ], NOW);
    expect(h.counts.creator).toBe(2);
    expect(holdingsText(h)).toBe("2 live strategies or fee payouts");
    expect(isSeatEmpty(holdingsOf(SEAT, [ev(AGENT_TEMPLATE_IDS.Strategy, { creator: SEAT, active: false })], NOW))).toBe(true);
  });

  it("a Canton Coin claim holds the seat: the venue owes it coin, or a request or a transfer to it is open (C7b)", () => {
    const h = holdingsOf(SEAT, [
      ev(CC_TEMPLATE_IDS.CcAllowance, { owner: SEAT, units: "1000000" }),
      ev(CC_TEMPLATE_IDS.CcAllowance, { owner: OTHER, units: "5" }),
      ev(CC_TEMPLATE_IDS.CcWithdrawProposal, { owner: SEAT, units: "1" }),
      ev(CC_TEMPLATE_IDS.CcWithdrawal, { owner: SEAT, state: "WdSent" }),
      ev(CC_TEMPLATE_IDS.CcWithdrawal, { owner: SEAT, state: "WdCompleted" }),
      ev(CC_TEMPLATE_IDS.CcWithdrawal, { owner: SEAT, state: "WdRefunded" }),
      ev(CC_TEMPLATE_IDS.CcDeposit, { owner: SEAT, units: "9" }),
    ], NOW);
    expect(h.counts.coin).toBe(3);
    expect(holdingsText(h)).toBe("3 Canton Coin claims");
    expect(isSeatEmpty(holdingsOf(SEAT, [ev(CC_TEMPLATE_IDS.CcWithdrawal, { owner: SEAT, state: "WdCompleted" }), ev(CC_TEMPLATE_IDS.CcDeposit, { owner: SEAT, units: "9" })], NOW))).toBe(true);
  });
});
