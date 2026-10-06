import type { CreatedEvent, ExercisedEvent } from "@agari/ledger";
import { describe, expect, it } from "vitest";
import { dependentCreated, dependentExercised } from "./decode-dependents";

const created = (createArgument: Record<string, unknown>, contractId = "00prod") => ({ contractId, createArgument }) as unknown as CreatedEvent;
const exercised = (choice: string, consuming = true) => ({ contractId: "00prod", choice, consuming }) as unknown as ExercisedEvent;

describe("C-DAML-03: product dependents are counted in the projection", () => {
  it("a range round and a moonshot pin their one Window", () => {
    expect(dependentCreated("PM.Tickets.Range:RangeRound", created({ owner: "seat", termsCid: "00t1", marketId: "BTC-5m:4", kind: "Range" }))).toEqual([
      { kind: "dependent", contractId: "00prod", product: "range", owner: "seat", terms: [{ termsCid: "00t1", marketKey: "BTC-5m:4" }] },
    ]);
    expect(dependentCreated("PM.Tickets.Range:RangeRound", created({ owner: "seat", termsCid: "00t1", marketId: "BTC-5m:4", kind: "Moonshot" }))[0]).toMatchObject({ product: "moonshot" });
  });

  it("a parlay pins only the legs it has not decided, and a fully decided ticket pins nothing", () => {
    const legs = [
      { termsCid: "00a", marketId: "BTC-1m:9", won: true },
      { termsCid: "00b", marketId: "ETH-1m:9", won: false },
    ];
    expect(dependentCreated("PM.Tickets.Parlay:ParlayTicket", created({ owner: "seat", legs }))).toEqual([
      { kind: "dependent", contractId: "00prod", product: "parlay", owner: "seat", terms: [{ termsCid: "00b", marketKey: "ETH-1m:9" }] },
    ]);
    expect(dependentCreated("PM.Tickets.Parlay:ParlayTicket", created({ owner: "seat", legs: [{ ...legs[0], won: true }] }))).toEqual([]);
  });

  it("a boost on Down is a short; any consuming choice ends a dependent, a nonconsuming one does not", () => {
    expect(dependentCreated("PM.Tickets.Boost:BoostPosition", created({ owner: "seat", termsCid: "00t", marketId: "BTC-5m:2", side: "SideDown" }))[0]).toMatchObject({ product: "short" });
    expect(dependentExercised("PM.Tickets.Boost:BoostPosition", exercised("Boost_KnockOut"))).toEqual([{ kind: "dependent-closed", contractId: "00prod", how: "Boost_KnockOut" }]);
    expect(dependentExercised("PM.Tickets.Boost:BoostPosition", exercised("Boost_OfferExit", false))).toEqual([]);
    expect(dependentExercised("PM.Tickets.Earn:EarnDesk", exercised("Archive"))).toEqual([]);
  });
});
