/**
 * A duel on the ledger → the app's arena vocabulary (`@agari/core/games`): the room, the projection, the screens and
 * the settler all reason about `ArenaMatch`, masks and seats, whichever contract currently holds the match.
 *
 *   DuelOpen                → waiting
 *   DuelMatch Unrevealed    → activeUnrevealed      Picking → picking      Settling → settling      Forfeited → forfeited
 *   DuelResult Won | Tied   → finalized             Refunded → refunded
 *
 * Players are seats: the ledger names parties, the app names seat addresses, and the caller supplies the mapping (the
 * seat pool's lease row). A party with no known address maps to a derived, stable, address-shaped id so nothing on a
 * screen is ever blank or wrong about who is who. Cards are the app's derived `MarketId`s.
 */
import { arenaStatusOf, stakeTierIndex, type ArenaMatch, type ArenaParams, type ArenaPick, type ArenaStatus, type ArenaTier, type StakeTierId, STAKE_TIERS } from "@agari/core/games";
import { marketIdFromDaml, seriesIdFromDaml } from "@agari/core/market";
import type { Address, Hash32, MarketId } from "@agari/core/types";
import type { ArenaParamsC, ArenaTermsC, DuelMatchC, DuelOpenC, DuelResultC, PickC, TierC } from "./decode";

export type AddressOf = (party: string) => Address;

/** The arena's address-shaped id (the reference's `gameArena`), derived from its `arenaId`; never a chain address. */
export const arenaAddressOf = (arenaId: string): Address => seriesIdFromDaml(`agari-arena:${arenaId}`);

/** A party no lease names: a stable derived id, so a screen can still tell two such players apart. */
export const partyAddress = (party: string): Address => seriesIdFromDaml(`agari-party:${party}`);

const TIER_IDS = new Set<string>(STAKE_TIERS.map((t) => t.id));
export const isStakeTierId = (id: string): id is StakeTierId => TIER_IDS.has(id);

/** The core tier index of a ledger tier id; an unknown id (a tier added on the ledger later) reads as free. */
export const tierIndexOf = (tierId: string): number => (isStakeTierId(tierId) ? stakeTierIndex(tierId) : 0);

export function arenaParamsOf(p: ArenaParamsC): ArenaParams {
  // The ledger has no separate card-life floor: `Duel_Reveal` requires every card to trade until the pick deadline.
  return { joinWindowSec: p.joinWindowSec, revealWindowSec: p.revealWindowSec, pickWindowSec: p.pickWindowSec, minDeckSize: p.minDeckSize, maxDeckSize: p.maxDeckSize, minCardLifeSec: 0 };
}

export function arenaTierOf(t: TierC): ArenaTier {
  return { tier: tierIndexOf(t.tierId), potBase: t.potEach, perCardCapBase: t.perCardCap, enabled: t.enabled };
}

export function arenaTiersOf(terms: ArenaTermsC): ArenaTier[] {
  return terms.tiers.filter((t) => isStakeTierId(t.tierId)).map(arenaTierOf);
}

const hash32 = (hex: string): Hash32 => (hex.startsWith("0x") ? hex : `0x${hex}`) as Hash32;

function masksOf(picks: readonly PickC[], deckSize: number): { pickedMask0: number; pickedMask1: number; settledMask: number } {
  let pickedMask0 = 0;
  let pickedMask1 = 0;
  let settledMask = 0;
  for (const p of picks) {
    if (p.seat === 0) pickedMask0 |= 1 << p.cardIndex;
    else pickedMask1 |= 1 << p.cardIndex;
  }
  for (let i = 0; i < deckSize; i += 1) {
    const onCard = picks.filter((p) => p.cardIndex === i);
    if (onCard.length > 0 && onCard.every((p) => p.payout !== null)) settledMask |= 1 << i;
  }
  return { pickedMask0, pickedMask1, settledMask };
}

export function arenaPickOf(p: PickC): ArenaPick {
  return {
    cardIndex: p.cardIndex,
    seat: p.seat,
    placed: true,
    settled: p.payout !== null,
    pick: p.leg.outcome === "SideUp" ? "up" : "down",
    quantity: p.leg.lots * p.leg.cashUnit,
    costBase: p.cost,
    payoutBase: p.payout ?? 0n,
  };
}

/** One seat's running PnL: payout − cost over its scored picks (the pot's own rule, `Duel_Finalize`). */
export const seatPnl = (picks: readonly PickC[], seat: 0 | 1): bigint =>
  picks.filter((p) => p.seat === seat && p.payout !== null).reduce((s, p) => s + (p.payout as bigint) - p.cost, 0n);

function statusOfMatch(m: DuelMatchC): ArenaStatus {
  switch (m.status.tag) {
    case "Unrevealed":
      return "activeUnrevealed";
    case "Picking":
      return "picking";
    case "Settling":
      return "settling";
    case "Forfeited":
      return "forfeited";
  }
}

export interface DuelViewOf {
  match: ArenaMatch;
  cards: MarketId[];
  picks: ArenaPick[];
  creatorPnlBase: bigint;
  challengerPnlBase: bigint;
}

export function viewOfOpen(o: DuelOpenC, addressOf: AddressOf): DuelViewOf {
  return {
    match: {
      matchId: hash32(o.matchId), creator: addressOf(o.creator), challenger: addressOf(o.challenger), tier: tierIndexOf(o.tier.tierId),
      status: arenaStatusOf(0), deckSize: o.deckSize, pickedMask0: 0, pickedMask1: 0, settledMask: 0, policyVersion: o.policyVersion,
      deckHash: hash32(o.deckHash), createdAtSec: o.joinDeadlineSec - o.params.joinWindowSec, joinedAtSec: 0, revealedAtSec: 0, pickDeadlineSec: 0,
      potBase: o.tier.potEach, perCardCapBase: o.tier.perCardCap,
    },
    cards: [], picks: [], creatorPnlBase: 0n, challengerPnlBase: 0n,
  };
}

export function viewOfMatch(m: DuelMatchC, addressOf: AddressOf): DuelViewOf {
  const joinedAtSec = m.revealDeadlineSec - m.params.revealWindowSec;
  return {
    match: {
      matchId: hash32(m.matchId), creator: addressOf(m.creator), challenger: addressOf(m.challenger), tier: tierIndexOf(m.tier.tierId),
      status: statusOfMatch(m), deckSize: m.deckSize, ...masksOf(m.picks, m.deckSize), policyVersion: m.policyVersion, deckHash: hash32(m.deckHash),
      // The ledger keeps deadlines, not event times; each phase's start is its deadline less its window (the windows are the arena's).
      createdAtSec: joinedAtSec, joinedAtSec, revealedAtSec: m.pickDeadlineSec === null ? 0 : m.pickDeadlineSec - m.params.pickWindowSec,
      pickDeadlineSec: m.pickDeadlineSec ?? 0, potBase: m.tier.potEach, perCardCapBase: m.tier.perCardCap,
    },
    cards: m.cards.map((c) => marketIdFromDaml(c.marketId)),
    picks: m.picks.map(arenaPickOf),
    creatorPnlBase: seatPnl(m.picks, 0),
    challengerPnlBase: seatPnl(m.picks, 1),
  };
}

const RESULT_REFUND = { BothIncomplete: "both-incomplete", RevealUnavailable: "reveal-unavailable", StaleSettlement: "stale-settlement" } as const;

/** A decided match. The result keeps the deck and both PnLs; its picks are in the projection's history. */
export function viewOfResult(r: DuelResultC, addressOf: AddressOf, deck?: { deckHash: string; deckSize: number; policyVersion: number; potEach: bigint; perCardCap: bigint }): DuelViewOf {
  const tierId = r.tierId;
  const tier = STAKE_TIERS.find((t) => t.id === tierId);
  return {
    match: {
      matchId: hash32(r.matchId), creator: addressOf(r.creator), challenger: addressOf(r.challenger), tier: tierIndexOf(tierId),
      status: r.outcome.tag === "Refunded" ? "refunded" : "finalized", deckSize: deck?.deckSize ?? r.cards.length, pickedMask0: 0, pickedMask1: 0, settledMask: 0,
      policyVersion: deck?.policyVersion ?? 0, deckHash: hash32(deck?.deckHash ?? "0".repeat(64)), createdAtSec: 0, joinedAtSec: 0, revealedAtSec: 0, pickDeadlineSec: 0,
      potBase: deck?.potEach ?? (r.outcome.tag === "Refunded" ? r.toCreator : 0n), perCardCapBase: deck?.perCardCap ?? BigInt(tier?.perCardCapUnits ?? 0),
      // A `DuelResult` exists only for a joined match, so its refund is never "withdrawn before anyone joined" (C9c).
      ...(r.outcome.tag === "Refunded" ? { refundReason: RESULT_REFUND[r.outcome.reason] } : {}),
    },
    cards: r.cards.map((c) => marketIdFromDaml(c)),
    picks: [],
    creatorPnlBase: r.creatorPnl,
    challengerPnlBase: r.challengerPnl,
  };
}
