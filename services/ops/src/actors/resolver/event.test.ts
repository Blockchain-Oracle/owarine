import type { Active, EventAttestationC, EventTermsC } from "@agari/markets/ops/canton";
import { describe, expect, it } from "vitest";
import { decideEvent, EVENT_ALL_MEMBERS_WAIT_SEC, eventEvidence } from "./event";

const e: EventTermsC = {
  venue: "v", resolver: "r", termsCid: "t", marketId: "EVT-DEMO-1:0", question: "Q?", closeTimeSec: 1_000, closeDeadlineSec: 4_600, attestors: ["a", "b", "c"], quorum: 2,
};
let n = 0;
const att = (attestor: string, answer: boolean, attestedAtSec: number, over: Partial<EventAttestationC> = {}): Active<EventAttestationC> => ({
  cid: `att-${n++}`, data: { attestor, venue: "v", resolver: "r", marketId: e.marketId, answer, attestedAtSec, statementHash: "h", ...over },
});

describe("resolver: committee events (engine 0.4.0)", () => {
  it("counts one attestation per member, inside [close, deadline], for this market and venue, as the ledger does", () => {
    const counted = eventEvidence(e, [
      att("a", true, 1_010), att("a", false, 1_020), // later second answer ignored
      att("b", true, 999), // before the close: ignored
      att("c", true, 4_601), // after closeDeadlineSec: ignored
      att("x", true, 1_010), // not a member
      att("b", true, 1_030, { marketId: "EVT-OTHER:0" }),
      att("b", true, 1_040, { venue: "other" }),
    ]);
    expect(counted.map((c) => [c.data.attestor, c.data.answer])).toEqual([["a", true]]);
    const tie = eventEvidence(e, [att("a", true, 1_010), att("a", false, 1_010)]);
    expect(tie[0]!.data.answer).toBe(false);
  });

  it("waits before the close and below the quorum, resolves at once when every member answered", () => {
    expect(decideEvent(e, [], 999, 2).kind).toBe("wait");
    const one = eventEvidence(e, [att("a", true, 1_001)]);
    expect(decideEvent(e, one, 1_100, 2)).toMatchObject({ kind: "wait" });
    const all = eventEvidence(e, [att("a", true, 1_001), att("b", true, 1_002), att("c", false, 1_003)]);
    expect(decideEvent(e, all, 1_010, 2)).toMatchObject({ kind: "resolve" });
  });

  it("gives a dissenting member time to be heard before resolving on the quorum alone", () => {
    const two = eventEvidence(e, [att("a", true, 1_001), att("b", true, 1_002)]);
    expect(decideEvent(e, two, 1_010, 2)).toMatchObject({ kind: "wait", untilSec: 1_000 + EVENT_ALL_MEMBERS_WAIT_SEC });
    expect(decideEvent(e, two, 1_000 + EVENT_ALL_MEMBERS_WAIT_SEC, 2)).toMatchObject({ kind: "resolve" });
  });

  it("voids only past the deadline plus the margin, whatever was counted", () => {
    expect(decideEvent(e, [], 4_601, 2)).toMatchObject({ kind: "wait", untilSec: 4_602 });
    expect(decideEvent(e, [], 4_602, 2)).toMatchObject({ kind: "void" });
  });
});
