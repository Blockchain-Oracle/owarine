/**
 * The duel projection, folded into the main projector (C9b): each venue transaction the projector applies is read
 * once more for arena choices, and every one becomes the `ArenaEvent`s the reference's arena log carried, so the rows,
 * the ladder and the room's deltas (`apply.ts`) are unchanged. The venue signs every games contract, so its one
 * `/v2/updates` stream (LEDGER_EFFECTS) holds every exercise with the contracts it created beneath it.
 *
 *   Arena_OpenDuel → created      Open_Join → joined        Duel_Reveal → revealed      Duel_RecordPick → picked (+ locked)
 *   Duel_Lock → locked | refunded Duel_Score → settled × n  Duel_Finalize → finalized   Open_Cancel, Open_RefundUnjoined,
 *   Duel_RefundUnrevealed, Duel_RefundStale → refunded
 *
 * Idempotent like the rest of the projection: a replayed transaction yields the same events, and `apply.ts` keys every
 * row by what the ledger decided (a match id, a pick's coordinates), so writing one twice changes nothing.
 */
import type { ArenaEvent, ArenaEventLog } from "@agari/core/games";
import { marketIdFromDaml } from "@agari/core/market";
import type { Address, Hash32, Signature } from "@agari/core/types";
import { GAMES_TEMPLATE_IDS, TEMPLATE_IDS } from "@agari/daml";
import type { CreatedEvent, ExercisedEvent, JsTransaction } from "@agari/ledger";
import { decodeVenueCash, templateSuffix } from "@agari/markets/ops/canton";
import { decodeDuelMatch, decodeDuelOpen, decodeDuelResult, tierIndexOf, type DuelMatchC, type DuelResultC } from "@agari/markets/ops/games";

const G = GAMES_TEMPLATE_IDS;
const is = (templateId: string, want: string) => templateSuffix(templateId) === templateSuffix(want);
const hex = (h: string): Hash32 => (h.startsWith("0x") ? h : `0x${h}`) as Hash32;

export interface DuelTranslator {
  /** Every arena event in one applied transaction, in node order. */
  eventsOf(tx: JsTransaction): ArenaEventLog[];
  /** The parties a transaction names, so the caller can learn their seat addresses before translating. */
  partiesOf(tx: JsTransaction): string[];
}

export function createDuelTranslator(addressOf: (party: string) => Address): DuelTranslator {
  /** DuelOpen and DuelMatch contract ids → match id: a cancel or an unjoined refund creates no games contract to read it from. */
  const matchOfCid = new Map<string, string>();

  function remember(c: CreatedEvent): void {
    if (is(c.templateId, G.DuelOpen) || is(c.templateId, G.DuelMatch)) {
      const matchId = (c.createArgument as { matchId?: unknown }).matchId;
      if (typeof matchId === "string") matchOfCid.set(c.contractId, matchId);
    }
  }

  function translate(ex: ExercisedEvent, kids: readonly CreatedEvent[]): ArenaEvent[] {
    const find = (t: string) => kids.find((k) => is(k.templateId, t));
    const newOpen = find(G.DuelOpen);
    const newMatch = find(G.DuelMatch);
    const newResult = find(G.DuelResult);
    const m: DuelMatchC | null = newMatch ? decodeDuelMatch(newMatch.createArgument) : null;
    const r: DuelResultC | null = newResult ? decodeDuelResult(newResult.createArgument) : null;
    const refunds = kids.filter((k) => is(k.templateId, TEMPLATE_IDS.VenueCash)).map((k) => decodeVenueCash(k.createArgument)).filter((c) => c.bucket === "duel-refund");
    const playerOf = (x: DuelMatchC, seat: 0 | 1) => addressOf(seat === 0 ? x.creator : x.challenger);
    switch (ex.choice) {
      case "Arena_OpenDuel": {
        if (!newOpen) return [];
        const o = decodeDuelOpen(newOpen.createArgument);
        return [{ kind: "created", matchId: hex(o.matchId), creator: addressOf(o.creator), tier: tierIndexOf(o.tier.tierId), potBase: o.tier.potEach, deckHash: hex(o.deckHash), deckSize: o.deckSize, joinDeadlineSec: o.joinDeadlineSec }];
      }
      case "Open_Join":
        return m ? [{ kind: "joined", matchId: hex(m.matchId), challenger: addressOf(m.challenger), potBase: m.tier.potEach, revealDeadlineSec: m.revealDeadlineSec }] : [];
      case "Open_Cancel":
      case "Open_RefundUnjoined": {
        const matchId = matchOfCid.get(ex.contractId);
        if (!matchId) return [];
        return [{ kind: "refunded", matchId: hex(matchId), reason: ex.choice === "Open_Cancel" ? "creator-cancelled" : "join-timeout", perPlayerBase: refunds.reduce((s, c) => s + c.amount, 0n) }];
      }
      case "Duel_Reveal":
        return m ? [{ kind: "revealed", matchId: hex(m.matchId), policyVersion: m.policyVersion, cards: m.cards.map((c) => marketIdFromDaml(c.marketId)), pickDeadlineSec: m.pickDeadlineSec ?? 0 }] : [];
      case "Duel_RecordPick": {
        if (!m) return [];
        const p = m.picks[m.picks.length - 1];
        const card = p ? m.cards[p.cardIndex] : undefined;
        if (!p || !card) return [];
        const out: ArenaEvent[] = [{
          kind: "picked", matchId: hex(m.matchId), player: playerOf(m, p.seat), marketId: marketIdFromDaml(card.marketId), cardIndex: p.cardIndex,
          pick: p.leg.outcome === "SideUp" ? "up" : "down", quantity: p.leg.lots * p.leg.cashUnit, costBase: p.cost, refundBase: 0n,
        }];
        // The last pick locks the match by itself (`Duel_RecordPick` moves it to Settling).
        if (m.status.tag === "Settling") out.push({ kind: "locked", matchId: hex(m.matchId), status: "settling", forfeitedBy: null });
        return out;
      }
      case "Duel_Lock": {
        if (r) return [{ kind: "refunded", matchId: hex(r.matchId), reason: "both-incomplete", perPlayerBase: r.toCreator }];
        if (!m) return [];
        const forfeited = m.status.tag === "Forfeited";
        return [{ kind: "locked", matchId: hex(m.matchId), status: forfeited ? "forfeited" : "settling", forfeitedBy: m.status.tag === "Forfeited" ? addressOf(m.status.absent) : null }];
      }
      case "Duel_Score": {
        if (!m) return [];
        const items = ((ex.choiceArgument as { items?: Array<{ seat?: unknown; cardIndex?: unknown }> }).items ?? []).map((i) => ({ seat: Number(i.seat), cardIndex: Number(i.cardIndex) }));
        return items.flatMap((i): ArenaEvent[] => {
          const p = m.picks.find((x) => x.seat === i.seat && x.cardIndex === i.cardIndex);
          const card = m.cards[i.cardIndex];
          if (!p || p.payout === null || !card) return [];
          return [{ kind: "settled", matchId: hex(m.matchId), player: playerOf(m, p.seat), marketId: marketIdFromDaml(card.marketId), cardIndex: p.cardIndex, payoutBase: p.payout, pnlBase: p.payout - p.cost }];
        });
      }
      case "Duel_Finalize": {
        if (!r) return [];
        const winner = r.outcome.tag === "Won" ? addressOf(r.outcome.winner) : null;
        return [{ kind: "finalized", matchId: hex(r.matchId), winner, creatorPnlBase: r.creatorPnl, challengerPnlBase: r.challengerPnl, potAwardedBase: r.toCreator + r.toChallenger }];
      }
      case "Duel_RefundUnrevealed":
      case "Duel_RefundStale":
        return r ? [{ kind: "refunded", matchId: hex(r.matchId), reason: ex.choice === "Duel_RefundUnrevealed" ? "reveal-unavailable" : "stale-settlement", perPlayerBase: r.toCreator }] : [];
      default:
        return [];
    }
  }

  return {
    partiesOf(tx) {
      const out = new Set<string>();
      for (const e of tx.events) {
        if (!("CreatedEvent" in e)) continue;
        const c = e.CreatedEvent;
        if (!is(c.templateId, G.DuelOpen) && !is(c.templateId, G.DuelMatch) && !is(c.templateId, G.DuelResult)) continue;
        const a = c.createArgument as { creator?: unknown; challenger?: unknown };
        if (typeof a.creator === "string") out.add(a.creator);
        if (typeof a.challenger === "string") out.add(a.challenger);
      }
      return [...out];
    },
    eventsOf(tx) {
      const created = tx.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));
      const exercised = tx.events.flatMap((e) => ("ExercisedEvent" in e ? [e.ExercisedEvent] : [])).sort((a, b) => a.nodeId - b.nodeId);
      const out: ArenaEventLog[] = [];
      const base = { blockNumber: BigInt(tx.offset), txHash: tx.updateId as Signature, blockTimeSec: Math.floor(Date.parse(tx.effectiveAt) / 1000) };
      for (const ex of exercised) {
        if (!is(ex.templateId, G.ArenaTerms) && !is(ex.templateId, G.DuelOpen) && !is(ex.templateId, G.DuelMatch)) continue;
        const kids = created.filter((c) => c.nodeId > ex.nodeId && c.nodeId <= ex.lastDescendantNodeId);
        for (const event of translate(ex, kids)) out.push({ ...base, event, logIndex: ex.nodeId });
      }
      for (const c of created) remember(c);
      return out;
    },
  };
}
