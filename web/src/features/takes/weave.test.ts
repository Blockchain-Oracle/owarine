import { describe, expect, it } from "vitest";
import type { EventMarket } from "@owarine/core/types";
import type { DeskReelDecision } from "@/features/desk/DeskReelCard";
import { DESK_AT, weaveReel } from "./weave";
import type { FeedTake } from "./protocol";

const market = (id: string) => ({ marketId: id }) as unknown as EventMarket;
const take = (id: string) => ({ id }) as unknown as FeedTake;
const decision = {} as unknown as DeskReelDecision;

describe("weaveReel", () => {
  it("alternates market, take, market, take and starts on a market", () => {
    const kinds = weaveReel([market("a"), market("b")], [take("t1")]).map((i) => i.kind);
    expect(kinds).toEqual(["market", "take", "market"]);
  });
  it("puts the desk's decision DESK_AT items in, or last in a short feed, and never into an empty one", () => {
    const rounds = Array.from({ length: 6 }, (_, i) => market(`m${i}`));
    expect(weaveReel(rounds, [], decision).findIndex((i) => i.kind === "desk")).toBe(DESK_AT);
    expect(weaveReel([market("a")], [], decision).map((i) => i.kind)).toEqual(["market", "desk"]);
    expect(weaveReel([], [], decision)).toEqual([]);
  });
});
