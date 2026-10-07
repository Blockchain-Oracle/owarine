import type { StrategyRecord, StrategySubscription } from "@owarine/core/strategies";
import type { Address, Hex } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { strategiesReplyWire, subscriptionsReplyWire } from "./agents-wire";
import { toWire } from "./ledger-wire";

// What the routes send: the server's views through the same `toWire` the web's `replyWith` uses.
const record: StrategyRecord = {
  strategyId: 2408802789779914n,
  creator: "HzXB6xLpFR1MZjumubVpnzgBibX8EdDn9apqDYsqP5eA" as Address,
  runner: "owarine-agent-runner-x::1220ebefb9f0b35a544f9616a09b7203e91b08d99c5b321ad74f38df937403f70bff" as Address,
  specHash: "0xc25e3a492f5d2835c531a602c79ad5d8b93dcd59cf3174b50b223596f283ade0" as Hex,
  metadata: "{\"name\":\"Open Drift\"}",
  envelope: { maxStakePerTradeBase: 1_000_000n, maxDailySpendBase: 5_000_000n, maxOpenPositions: 2, maxPriceRaw: 0n },
  feeBase: 500_000n,
  active: true,
  createdAtSec: 1_790_710_645,
  subscribers: 0,
  revision: 0,
};

describe("the agents wires read what the routes send (C8g)", () => {
  it("parses the public registry as GET /api/ledger/agents/strategies answers it, a party creator included", () => {
    const orphan = { ...record, strategyId: 339553305689042n, creator: record.runner };
    const parsed = strategiesReplyWire.parse(toWire({ strategies: [record, orphan] }));
    expect(parsed.strategies.map((s) => s.strategyId)).toEqual([record.strategyId, orphan.strategyId]);
    expect(parsed.strategies[0]!.feeBase).toBe(500_000n);
    expect(parsed.strategies[1]!.creator).toBe(record.runner);
  });

  it("parses the seat's consents as GET /api/ledger/agents/subscriptions answers them", () => {
    const sub: StrategySubscription = { strategyId: record.strategyId, subscriber: record.creator, grantId: 77n, subscribedAtSec: 1_790_710_700, active: true, live: true, fade: true };
    expect(subscriptionsReplyWire.parse(toWire({ subscriptions: [sub] })).subscriptions[0]).toEqual(sub);
  });
});
