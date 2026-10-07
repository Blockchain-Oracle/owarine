import { X_MONETARY_CEILING, isBalanceOnlyXGrant, xGrantCaps } from "@owarine/core/x";
import { simulateCaps } from "@owarine/core/vault";
import { describe, expect, it } from "vitest";
import type { AgentGrantC, StrategyListingC, SubscriptionC } from "./decode";
import { grantBuyCommandId } from "./executor";
import { DAML_NO_CAP, grantIdOf, rawOfTicks, strategyNumOf, ticksOfRaw, utcDayStartSec } from "./ids";
import { capsToDaml, grantFor, grantKindOf, grantsByKind, grantView, strategyView, subscriptionView } from "./views";

const OWNER = "seat-1::1220aaaa";
const RUNNER = "agent-runner::1220bbbb";
const DAY0 = utcDayStartSec(1_790_856_000);

const grant = (over: Partial<AgentGrantC> = {}): AgentGrantC => ({
  venue: "venue::1220cccc", owner: OWNER, agent: RUNNER,
  caps: { maxStakePerTrade: 700_000n, maxDailySpend: 1_000_000n, maxPriceTicks: 650, maxOpenPositions: 9 },
  budget: 2_000_000n, expiresAtSec: DAY0 + 2 * 86_400, dayZeroSec: DAY0, day: 0, spentToday: 0n, positions: [], ...over,
});

describe("grant ids and units (C8f)", () => {
  it("keeps a grant's id across its trades, top-ups and day rollovers, and changes it for a new grant", () => {
    const g = grant();
    const id = grantIdOf({ owner: g.owner, agent: g.agent, expiresAtSec: g.expiresAtSec, dayZeroSec: g.dayZeroSec });
    expect(grantView({ ...g, budget: 1n, day: 3, spentToday: 5n }, DAY0).grantId).toBe(id);
    expect(grantView({ ...g, expiresAtSec: g.expiresAtSec + 1 }, DAY0).grantId).not.toBe(id);
    expect(id).toBeLessThan(2n ** 52n);
    expect(strategyNumOf("creator::1220/0")).toBe(strategyNumOf("creator::1220/0"));
    expect(strategyNumOf("creator::1220/0")).not.toBe(strategyNumOf("creator::1220/1"));
  });

  it("maps price raw and ticks both ways at 6 decimals", () => {
    expect(ticksOfRaw(650_000n, 6)).toBe(650);
    expect(rawOfTicks(650, 6)).toBe(650_000n);
  });

  it("reads the grant's day index as the reference's UTC day", () => {
    const v = grantView(grant({ day: 1, spentToday: 300_000n }), DAY0 + 86_400);
    expect(v.spentDay).toBe(DAY0 / 86_400 + 1);
    expect(v.spentTodayBase).toBe(300_000n);
  });
});

describe("grant kinds (K-087)", () => {
  it("reads the X no-cap sentinel with no price cap as the executor grant, round trip", () => {
    const caps = capsToDaml(xGrantCaps());
    expect(caps.maxStakePerTrade).toBe(DAML_NO_CAP);
    expect(caps.maxPriceTicks).toBe(0);
    const g = grant({ caps });
    expect(grantKindOf(g)).toBe("executor");
    const v = grantView(g, DAY0);
    expect(v.caps.maxStakePerTradeBase).toBe(X_MONETARY_CEILING);
    expect(isBalanceOnlyXGrant(v)).toBe(true);
  });

  it("reads any other grant as a strategy grant, and never a session grant", () => {
    expect(grantKindOf(grant())).toBe("strategy");
    const slots = grantsByKind([grantView(grant(), DAY0), grantView(grant({ budget: 5n, expiresAtSec: DAY0 + 1 }), DAY0)]);
    expect(slots.session).toBeNull();
    expect(slots.executor).toBeNull();
    expect(slots.strategy?.budgetBase).toBe(2_000_000n);
  });

  it("clamps a price cap into the ledger's 1..999 ticks and keeps 0 as no cap", () => {
    expect(capsToDaml({ maxStakePerTradeBase: 1n, maxDailySpendBase: 1n, maxOpenPositions: 1, maxPriceRaw: 999_999n }).maxPriceTicks).toBe(999);
    expect(capsToDaml({ maxStakePerTradeBase: 1n, maxDailySpendBase: 1n, maxOpenPositions: 1, maxPriceRaw: 0n }).maxPriceTicks).toBe(0);
  });
});

describe("the executor's pre-check agrees with the reference's caps (caps.vectors.json semantics)", () => {
  const view = grantView(grant(), DAY0);
  const one = 1_000_000n;
  it("passes an in-cap buy and names the stake, daily and price refusals", () => {
    expect(simulateCaps({ grant: view, nowSec: DAY0, sidePriceRaw: 600_000n, quantityRaw: 1_000_000n, spendBase: 600_000n, one, opensNewPosition: true }).ok).toBe(true);
    const over = simulateCaps({ grant: view, nowSec: DAY0, sidePriceRaw: 600_000n, quantityRaw: 2_000_000n, spendBase: 1_200_000n, one, opensNewPosition: true });
    expect(over.ok ? null : over.refusal.kind).toBe("stake");
    const price = simulateCaps({ grant: view, nowSec: DAY0, sidePriceRaw: 651_000n, quantityRaw: 1_000_000n, spendBase: 651_000n, one, opensNewPosition: true });
    expect(price.ok ? null : price.refusal.kind).toBe("price");
    const daily = simulateCaps({ grant: grantView(grant({ spentToday: 600_000n }), DAY0), nowSec: DAY0, sidePriceRaw: 500_000n, quantityRaw: 1_000_000n, spendBase: 500_000n, one, opensNewPosition: true });
    expect(daily.ok ? null : daily.refusal.kind).toBe("daily");
    const expired = simulateCaps({ grant: view, nowSec: view.expiresAtSec + 1, sidePriceRaw: 500_000n, quantityRaw: 1_000_000n, spendBase: 500_000n, one, opensNewPosition: true });
    expect(expired.ok ? null : expired.refusal.kind).toBe("expired");
  });

  it("derives one command id per attempt, stable across a restart", () => {
    const a = { owner: OWNER, actor: RUNNER, marketId: "M", grantId: 7n, side: "up" as const, fromOffset: 42n };
    expect(grantBuyCommandId(a)).toBe(grantBuyCommandId({ ...a, fromOffset: 42 }));
    expect(grantBuyCommandId(a)).not.toBe(grantBuyCommandId({ ...a, fromOffset: 43n }));
    expect(grantBuyCommandId(a)).not.toBe(grantBuyCommandId({ ...a, side: "down" }));
  });
});

describe("the registry's views", () => {
  const listing: StrategyListingC = {
    venue: "venue::1220cccc", creator: "creator::1220dddd", strategyId: "creator::1220dddd/0", strategyCid: "00ab", runner: RUNNER,
    envelope: { maxStakePerTrade: 700_000n, maxDailySpend: 1_000_000n, maxOpenPositions: 2, maxPriceTicks: 0 }, fee: 50n, specHash: "ab".repeat(32), version: 1, active: true, publishedAtSec: 100,
  };
  it("shows the sealed text only when the Strategy's hash matches the listing's", () => {
    const s = { venue: listing.venue, creator: listing.creator, strategyId: listing.strategyId, runner: RUNNER, envelope: listing.envelope, fee: 50n, spec: "{\"name\":\"x\"}", specHash: listing.specHash, version: 1, active: true, publishedAtSec: 100 };
    const r = strategyView(listing, s, 3, { creator: "SeatAddress" });
    expect(r).toMatchObject({ strategyId: strategyNumOf(listing.strategyId), creator: "SeatAddress", runner: RUNNER, metadata: s.spec, subscribers: 3, revision: 1, createdAtSec: 100, feeBase: 50n, specHash: `0x${listing.specHash}` });
    expect(strategyView(listing, { ...s, specHash: "00".repeat(32) }, 0).metadata).toBe("");
  });

  it("is live only with a consent and a live funded grant to the runner; fade is its own consent", () => {
    const sub: SubscriptionC = { venue: listing.venue, subscriber: OWNER, creator: listing.creator, strategyId: listing.strategyId, runner: RUNNER, kind: "SubFade", version: 1, specHash: listing.specHash, grantCid: "00cd", feePaid: 50n };
    const g = grant();
    const live = subscriptionView(sub, grantFor([g], OWNER, RUNNER, DAY0), DAY0, 5);
    expect(live).toMatchObject({ live: true, fade: true, active: true, subscribedAtSec: 5 });
    expect(live.grantId).toBe(grantView(g, DAY0).grantId);
    expect(subscriptionView({ ...sub, kind: "SubCopy" }, null, DAY0, 5)).toMatchObject({ live: false, fade: false, grantId: 0n });
    expect(grantFor([grant({ caps: capsToDaml(xGrantCaps()) })], OWNER, RUNNER, DAY0)).toBeNull();
    expect(grantFor([g], OWNER, RUNNER, g.expiresAtSec + 1)).toBeNull();
  });
});
