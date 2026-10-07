/**
 * Ledger contracts → the reference's shapes (C8f), pure, shared by the web's seat routes and ops' agents:
 *
 *   AgentGrant       → VaultGrant          kind from the caps (K-087): the X no-cap sentinel with no price cap is the
 *                                           EXECUTOR grant; any other grant is a STRATEGY grant; SESSION never exists
 *   StrategyListing  → StrategyRecord      (+ the creator-signed Strategy's text, which the venue observes)
 *   Subscription     → StrategySubscription  live = consent plus a live grant from the subscriber to the runner
 *
 * and the reverse for the caps a write carries. Amounts are base units (6 decimals); a YES-terms raw price is
 * `ticks × 10^(decimals − 3)`. A grant's day index counts from its `dayZero`, which the app always sets to 00:00 UTC,
 * so `spentDay` is the reference's UTC day number.
 */
import type { StrategyRecord, StrategySubscription } from "@owarine/core/strategies";
import type { Address } from "@owarine/core/types";
import type { GrantKind, VaultCaps, VaultGrant } from "@owarine/core/vault";
import type { AgentGrantC, CreatorPayoutC, EnvelopeC, GrantCapsC, StrategyC, StrategyListingC, SubscriptionC } from "./decode";
import { capFromDaml, capToDaml, DAML_NO_CAP, grantIdOf, rawOfTicks, strategyNumOf, ticksOfRaw } from "./ids";

export const AGENT_DECIMALS = 6;
const DAY = 86_400;

export function grantKindOf(g: Pick<AgentGrantC, "caps">): GrantKind {
  const c = g.caps;
  return c.maxStakePerTrade >= DAML_NO_CAP && c.maxDailySpend >= DAML_NO_CAP && c.maxPriceTicks === 0 ? "executor" : "strategy";
}

export const grantIdOfC = (g: AgentGrantC): bigint => grantIdOf({ owner: g.owner, agent: g.agent, expiresAtSec: g.expiresAtSec, dayZeroSec: g.dayZeroSec });

/** Positions still open at `nowSec` (the grant's own rule: until the market's refundAfter). */
export const openPositionsOf = (g: AgentGrantC, nowSec: number): number => g.positions.filter((p) => p.refundAfterSec > nowSec).length;

export function capsView(c: GrantCapsC, decimals = AGENT_DECIMALS): VaultCaps {
  return {
    maxStakePerTradeBase: capFromDaml(c.maxStakePerTrade),
    maxDailySpendBase: capFromDaml(c.maxDailySpend),
    maxOpenPositions: c.maxOpenPositions,
    maxPriceRaw: c.maxPriceTicks === 0 ? 0n : rawOfTicks(c.maxPriceTicks, decimals),
  };
}

/** The caps a write carries, on the ledger's terms; a price cap rounds down to whole ticks and stays inside 0..999. */
export function capsToDaml(c: VaultCaps, decimals = AGENT_DECIMALS): GrantCapsC {
  const ticks = c.maxPriceRaw === 0n ? 0 : Math.min(999, Math.max(1, ticksOfRaw(c.maxPriceRaw, decimals)));
  return { maxStakePerTrade: capToDaml(c.maxStakePerTradeBase), maxDailySpend: capToDaml(c.maxDailySpendBase), maxPriceTicks: ticks, maxOpenPositions: c.maxOpenPositions };
}

export function envelopeView(e: EnvelopeC, decimals = AGENT_DECIMALS): VaultCaps {
  return { maxStakePerTradeBase: e.maxStakePerTrade, maxDailySpendBase: e.maxDailySpend, maxOpenPositions: e.maxOpenPositions, maxPriceRaw: e.maxPriceTicks === 0 ? 0n : rawOfTicks(e.maxPriceTicks, decimals) };
}

export function envelopeToDaml(c: VaultCaps, decimals = AGENT_DECIMALS): EnvelopeC {
  const caps = capsToDaml(c, decimals);
  return { maxStakePerTrade: caps.maxStakePerTrade, maxDailySpend: caps.maxDailySpend, maxOpenPositions: caps.maxOpenPositions, maxPriceTicks: caps.maxPriceTicks };
}

/** A live grant as the reference's `VaultGrant`; `owner` is shown as `ownerLabel` (the seat's address) when given. */
export function grantView(g: AgentGrantC, nowSec: number, ownerLabel?: string, decimals = AGENT_DECIMALS): VaultGrant {
  return {
    grantId: grantIdOfC(g),
    owner: (ownerLabel ?? g.owner) as Address,
    actor: g.agent as Address,
    kind: grantKindOf(g),
    revoked: false,
    expiresAtSec: g.expiresAtSec,
    spentDay: Math.floor(g.dayZeroSec / DAY) + g.day,
    spentTodayBase: g.spentToday,
    openPositions: openPositionsOf(g, nowSec),
    caps: capsView(g.caps, decimals),
    budgetBase: g.budget,
  };
}

/** A grant that is no longer on the ledger: it left only by its owner's revoke (a trade or top-up keeps its id). */
export function goneGrantView(grantId: bigint, owner: string, actor: string): VaultGrant {
  return {
    grantId, owner: owner as Address, actor: actor as Address, kind: "strategy", revoked: true, expiresAtSec: 0, spentDay: 0, spentTodayBase: 0n, openPositions: 0,
    caps: { maxStakePerTradeBase: 0n, maxDailySpendBase: 0n, maxOpenPositions: 0, maxPriceRaw: 0n }, budgetBase: 0n,
  };
}

/** Per kind, the live grant (the reference's one-per-kind slots); the largest budget wins if an owner holds two. */
export function grantsByKind(grants: readonly VaultGrant[]): Record<GrantKind, VaultGrant | null> {
  const pick = (kind: GrantKind) => grants.filter((g) => g.kind === kind).sort((a, b) => (a.budgetBase === b.budgetBase ? 0 : a.budgetBase > b.budgetBase ? -1 : 1))[0] ?? null;
  return { session: null, executor: pick("executor"), strategy: pick("strategy") };
}

/** A listed strategy as the reference's `StrategyRecord`. The metadata is the creator's sealed text (the Strategy's `spec`). */
export function strategyView(l: StrategyListingC, s: StrategyC | null, subscribers: number, labels: { creator?: string } = {}, decimals = AGENT_DECIMALS): StrategyRecord {
  return {
    strategyId: strategyNumOf(l.strategyId),
    creator: (labels.creator ?? l.creator) as Address,
    runner: l.runner as Address,
    specHash: `0x${l.specHash}`,
    metadata: s && s.specHash === l.specHash ? s.spec : "",
    envelope: envelopeView(l.envelope, decimals),
    feeBase: l.fee,
    active: l.active,
    createdAtSec: l.publishedAtSec ?? 0,
    subscribers,
    revision: l.version,
  };
}

/** A consent as the reference's `StrategySubscription`; `liveGrant` is the subscriber's current grant to the runner, if any. */
export function subscriptionView(sub: SubscriptionC, liveGrant: AgentGrantC | null, nowSec: number, subscribedAtSec: number, subscriberLabel?: string): StrategySubscription {
  const live = liveGrant !== null && liveGrant.agent === sub.runner && liveGrant.owner === sub.subscriber && liveGrant.expiresAtSec >= nowSec && liveGrant.budget > 0n;
  return {
    strategyId: strategyNumOf(sub.strategyId),
    subscriber: (subscriberLabel ?? sub.subscriber) as Address,
    grantId: liveGrant ? grantIdOfC(liveGrant) : 0n,
    subscribedAtSec,
    active: true,
    live,
    fade: sub.kind === "SubFade",
  };
}

/** The strategy grant an owner holds for one runner (the one a runner trades through): the largest live budget. */
export function grantFor(grants: readonly AgentGrantC[], owner: string, runner: string, nowSec: number): AgentGrantC | null {
  return grants
    .filter((g) => g.owner === owner && g.agent === runner && grantKindOf(g) === "strategy" && g.expiresAtSec >= nowSec)
    .sort((a, b) => (a.budget === b.budget ? 0 : a.budget > b.budget ? -1 : 1))[0] ?? null;
}

/** A creator's fees waiting on the ledger (C8i): the venue's aggregate payouts, each a period's total and fee count. */
export interface CreatorPayoutsView {
  totalBase: bigint;
  feeCount: number;
  payouts: { period: number; feeCount: number; amountBase: bigint }[];
}

/** The payouts made to `creator`, oldest period first; another creator's never count. */
export function creatorPayoutsView(payouts: readonly CreatorPayoutC[], creator: string): CreatorPayoutsView {
  const mine = payouts.filter((p) => p.creator === creator).sort((a, b) => a.period - b.period);
  return {
    totalBase: mine.reduce((sum, p) => sum + p.amount, 0n),
    feeCount: mine.reduce((sum, p) => sum + p.feeCount, 0),
    payouts: mine.map((p) => ({ period: p.period, feeCount: p.feeCount, amountBase: p.amount })),
  };
}
