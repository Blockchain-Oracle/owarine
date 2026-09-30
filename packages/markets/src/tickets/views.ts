/**
 * The ticket routes' answers in the reference's shapes (C8c), so every screen that read the Solana programs reads
 * these unchanged. What Canton does not carry is stated, never invented:
 *
 *   - a live ticket here is `live`, or decided-but-unsettled by its resolution; once it ends the ledger archives it and
 *     its `SettlementReceipt` carries it in history (`./receipt-views.ts`, K-093);
 *   - `openedAtSec` is not on the contract: 0;
 *   - a provider's lifetime supplied/withdrawn counters are not on the ledger: supplied reads as today's worth, so
 *     no yield is claimed that the ledger cannot show.
 */
import type { LeverageParams, LeveragePosition, LeverageReserveState } from "@agari/core/leverage";
import type { ParlayLeg, ParlayParams, ParlayReserveState, ParlayTicket } from "@agari/core/parlay";
import type { ProviderShares } from "@agari/core/reserves";
import type { RangeParams, RangeReserveState, RangeRound } from "@agari/core/range";
import type { Address } from "@agari/core/types";
import type { BoostPositionView, ParlayTicketView, RangeRoundView, TicketReserveState, TicketsMine } from "../provider/ticket-wire";
import { rememberTicket, reserveAddressOf } from "./client";
import { leverageParams, parlayParams, rangeParams, TICKET_DECIMALS, TICKET_ONE, type TicketReserveId } from "./params";

const utilization = (locked: bigint, total: bigint) => (total > 0n ? Number((locked * 10_000n) / total) : 0);

export function rangeReserveOf(r: TicketReserveState, params: RangeParams = rangeParams()): RangeReserveState {
  return {
    deployment: { chainId: 0, rangeReserve: reserveAddressOf("range"), fromBlock: 0n },
    params, liquidBase: r.liquidBase, lockedBase: r.lockedBase, totalValueBase: r.assetsBase, utilizationBps: utilization(r.lockedBase, r.assetsBase),
    supplyShares: r.shares, paused: r.paused, decimals: TICKET_DECIMALS,
  };
}

export function parlayReserveOf(r: TicketReserveState, params: ParlayParams = parlayParams()): ParlayReserveState {
  return {
    deployment: { chainId: 0, parlayReserve: reserveAddressOf("parlay"), fromBlock: 0n },
    params, liquidBase: r.liquidBase, lockedBase: r.lockedBase, totalValueBase: r.assetsBase, utilizationBps: utilization(r.lockedBase, r.assetsBase),
    supplyShares: r.shares, paused: r.paused, decimals: TICKET_DECIMALS,
  };
}

export function leverageReserveOf(r: TicketReserveState, params: LeverageParams = leverageParams()): LeverageReserveState {
  return {
    deployment: { chainId: 0, leverageReserve: reserveAddressOf("boost"), fromBlock: 0n },
    params, liquidBase: r.liquidBase, outstandingBase: r.lockedBase, totalValueBase: r.assetsBase, utilizationBps: utilization(r.lockedBase, r.assetsBase),
    supplyShares: r.shares, paused: r.paused, openPositions: r.openTickets, decimals: TICKET_DECIMALS,
  };
}

export function sharesOf(mine: TicketsMine, reserve: TicketReserveId): ProviderShares {
  const s = mine.shares.find((x) => x.reserveId === reserve);
  return s ? { shares: s.shares, worthBase: s.worthBase, suppliedBase: s.worthBase, withdrawnBase: 0n } : { shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n };
}

export function rangeRoundOf(r: RangeRoundView, owner: Address): RangeRound {
  const res = r.resolution;
  const inside = res?.closeE8 != null ? res.closeE8 >= r.lowE8 && res.closeE8 <= r.highE8 : null;
  const status: RangeRound["status"] = !res ? "live" : res.void ? "void" : inside === (r.side === "inside") ? "won" : "lost";
  // The priced probability is not on the contract; the round's own odds are (stake / maxPayout, margin included).
  const probRaw = r.maxPayoutBase > 0n ? (r.stakeBase * TICKET_ONE) / r.maxPayoutBase : 0n;
  return {
    roundId: rememberTicket("range", r.cid), owner, status, side: r.side, marketId: r.marketId, oracleQuestionId: 0n, expirySec: r.expirySec, openedAtSec: 0,
    settledAtSec: null, openingPrint: r.openingPrint ?? 0n, lowPrint: r.lowE8, highPrint: r.highE8, closingPrint: res?.closeE8 ?? null,
    stakeBase: r.stakeBase, maxPayoutBase: r.maxPayoutBase, houseLockedBase: r.maxPayoutBase - r.stakeBase, probRaw,
  };
}

export function parlayTicketOf(t: ParlayTicketView, owner: Address): ParlayTicket {
  const legs: ParlayLeg[] = t.legs.map((l) => ({ marketId: l.marketId, side: l.side, status: l.resolved, expirySec: l.expirySec, resolvedAtSec: null, priceRaw: 0n }));
  const status: ParlayTicket["status"] = legs.some((l) => l.status === "void") ? "void" : legs.some((l) => l.status === "lost") ? "lost" : legs.every((l) => l.status === "won") ? "won" : "live";
  return {
    parlayId: rememberTicket("parlay", t.cid), owner, status, legCount: legs.length, wonCount: legs.filter((l) => l.status === "won").length, openedAtSec: 0,
    lastExpirySec: Math.max(...t.legs.map((l) => l.expirySec)), stakeBase: t.stakeBase, maxPayoutBase: t.maxPayoutBase, houseLockedBase: t.maxPayoutBase - t.stakeBase,
    combinedProbRaw: t.maxPayoutBase > 0n ? (t.stakeBase * TICKET_ONE) / t.maxPayoutBase : 0n, legs,
  };
}

export function leveragePositionOf(p: BoostPositionView, owner: Address): LeveragePosition {
  const quantityRaw = p.lots * 1000n * p.cashUnit;
  return {
    positionId: rememberTicket("boost", p.cid), owner, status: "live", side: p.side, leverageBps: p.leverageBps, marketId: p.marketId, openedAtSec: 0,
    expirySec: p.expirySec, exitedAtSec: null, quantityRaw, stakeBase: p.stakeBase, frontedBase: p.frontedBase, premiumBase: p.premiumBase,
    entryPriceRaw: (BigInt(p.priceTicks) * TICKET_ONE) / 1000n, proceedsBase: 0n, reclaimedBase: 0n, returnedBase: 0n, owedBase: 0n,
  };
}
