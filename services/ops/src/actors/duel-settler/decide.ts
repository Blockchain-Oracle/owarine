import type { DuelMatchC, DuelOpenC, PickC } from "@owarine/markets/ops/games";

/**
 * What the arena will accept for one duel right now: every venue choice's precondition, restated from
 * `PM.Games.Arena` in one place and decided without a ledger call. The ledger is the authority; this only avoids
 * sending a command it would refuse. Every deadline is inclusive (allowed while now <= T; the escape opens at T + 1 s),
 * the engine's convention, so each crank here waits for T + 1.
 *
 * Any named player may run the same cranks from their own seat, and the money still goes where the match already
 * recorded it should: the settler buys promptness, never an outcome.
 */

export type DuelAction =
  | { kind: "refund-unjoined"; matchId: string; why: string }
  | { kind: "reveal"; matchId: string; why: string }
  | { kind: "refund-unrevealed"; matchId: string; why: string }
  | { kind: "lock"; matchId: string; why: string }
  /** Every unscored pick whose Window has resolved, in one `Duel_Score`. */
  | { kind: "score"; matchId: string; items: readonly { seat: 0 | 1; cardIndex: number; termsCid: string }[]; why: string }
  | { kind: "finalize"; matchId: string; why: string }
  | { kind: "refund-stale"; matchId: string; why: string };

/** The latest `refundAfter` over the deck: where finalize closes and the pot's stale refund opens (`potRefundAfter`). */
export function potRefundAfterSec(m: DuelMatchC): number {
  return m.cards.reduce((a, c) => Math.max(a, c.refundAfterSec), 0);
}

export function decideOpen(o: DuelOpenC, nowSec: number): DuelAction[] {
  return nowSec > o.joinDeadlineSec ? [{ kind: "refund-unjoined", matchId: o.matchId, why: `nobody joined by ${o.joinDeadlineSec}` }] : [];
}

/**
 * The next crank for a live match. `resolved` holds the terms contract ids whose Window has a `Resolution`; `canReveal`
 * says whether the deck's sealed material is on hand (without it nothing is sent, and the reveal deadline refunds).
 */
export function decideMatch(m: DuelMatchC, resolved: ReadonlySet<string>, nowSec: number, canReveal: boolean): DuelAction[] {
  const matchId = m.matchId;
  switch (m.status.tag) {
    case "Unrevealed":
      if (nowSec > m.revealDeadlineSec) return [{ kind: "refund-unrevealed", matchId, why: `the deck was never opened by ${m.revealDeadlineSec}` }];
      return canReveal ? [{ kind: "reveal", matchId, why: `both pots are in; the deck closes at ${m.revealDeadlineSec}` }] : [];
    case "Picking":
      return m.pickDeadlineSec !== null && nowSec > m.pickDeadlineSec ? [{ kind: "lock", matchId, why: `the pick window closed at ${m.pickDeadlineSec}` }] : [];
    case "Settling":
    case "Forfeited": {
      const stale = potRefundAfterSec(m);
      if (nowSec > stale) return [{ kind: "refund-stale", matchId, why: `no decision by the last card's refund deadline ${stale}` }];
      const open = m.picks.filter((p) => p.payout === null);
      const items = open.flatMap((p: PickC) => {
        const termsCid = m.cards[p.cardIndex]?.termsCid;
        return termsCid && resolved.has(termsCid) ? [{ seat: p.seat, cardIndex: p.cardIndex, termsCid }] : [];
      });
      if (items.length > 0) return [{ kind: "score", matchId, items, why: `${items.length} pick(s) on resolved Windows` }];
      if (open.length === 0) return [{ kind: "finalize", matchId, why: `all ${m.picks.length} recorded pick(s) scored` }];
      return [];
    }
  }
}
