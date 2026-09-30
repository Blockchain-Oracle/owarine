/**
 * The seat's side of the duel (C9b): its own choices on `abu-pm-games`, each submitted with `actAs` = the leased seat's
 * party ONLY, under the commandId the client journaled before sending (`duel:<journal uuid>`). Nothing is ever
 * submitted as the venue from here; the venue facts a choice needs (the arena terms, a Window's resolution) travel as
 * disclosed contracts read as the venue, read-only.
 *
 *   open      Arena_OpenDuel     the deckmaster's commitment (ops, only for the pending match's own creator), the pot
 *   join      Open_Join          the named challenger's pot
 *   pick      Quote_Accept + Duel_RecordPick   a firm quote within the tier's per-card cap, accepted with the duel's
 *                                tag (the seat's own leg: the opponent never witnesses its cash), then recorded
 *   cancel    Open_Cancel        the creator, before a join
 *   lock · settle · finalize · refund-*       the cranks any named player may run (settle = its own `Duel_Score`)
 */
import { GAMES_TEMPLATE_IDS, TEMPLATE_IDS } from "@agari/daml";
import type { ContractId, DisclosedContract, LedgerClient, Party } from "@agari/ledger";
import { diagnosis, type Signature } from "@agari/core/types";
import { decodeLeg, decodeResolution, templateSuffix, type LegC } from "../ops/canton/decode";
import { gcmd } from "../ops/games";
import { decodeDuelMatch, decodeDuelOpen, type DuelMatchC, type DuelOpenC } from "../ops/games/decode";
import type { DuelAction, DuelWriteReply, DuelWriteRequest } from "../provider/games-wire";
import { appMarketId, seatCommandId } from "./ids";
import type { OpsClient } from "./ops-client";
import { classifyRejection, refuse, SeatRefusal, type RejectionContext } from "./rejection";
import type { SeatLedger } from "./seat-ledger";
import { DEFAULT_COMMAND_DEADLINE_MS, inFlightBounds, selectCash, type CommandJournal, type CommandRow, type SeatActor } from "./writes";

export interface GamesSeatConfig {
  client: LedgerClient;
  venueParty: Party;
  journal: CommandJournal;
  ledger: SeatLedger;
  ops: OpsClient;
  now?: () => number;
}

/** A phase deadline the ledger bounds to (now, now + window]: a little inside the window, for the clock between us and it. */
const CLOCK_MARGIN_SEC = 3;

interface Plan {
  commands: ReturnType<typeof gcmd.lockDuel>[];
  disclosed?: DisclosedContract[];
  ctx: RejectionContext;
}

export function createGamesSeat(cfg: GamesSeatConfig) {
  const { client, journal, ledger } = cfg;
  const now = cfg.now ?? Date.now;
  const nowSec = () => Math.floor(now() / 1000);

  /** The seat's duels, as the seat's party sees them (it is a stakeholder of both). */
  async function duels(party: Party): Promise<{ opens: { cid: ContractId; data: DuelOpenC }[]; matches: { cid: ContractId; data: DuelMatchC }[]; offset: number }> {
    const r = await client.activeContracts({ parties: [party], templateIds: [GAMES_TEMPLATE_IDS.DuelOpen, GAMES_TEMPLATE_IDS.DuelMatch] });
    const opens: { cid: ContractId; data: DuelOpenC }[] = [];
    const matches: { cid: ContractId; data: DuelMatchC }[] = [];
    for (const { createdEvent: e } of r.contracts) {
      if (templateSuffix(e.templateId) === templateSuffix(GAMES_TEMPLATE_IDS.DuelOpen)) opens.push({ cid: e.contractId, data: decodeDuelOpen(e.createArgument) });
      else matches.push({ cid: e.contractId, data: decodeDuelMatch(e.createArgument) });
    }
    return { opens, matches, offset: r.activeAtOffset };
  }

  /** The seat's legs tagged for one match. */
  async function taggedLegs(party: Party, ref: string): Promise<{ cid: ContractId; data: LegC }[]> {
    const r = await client.activeContracts({ parties: [party], templateIds: [TEMPLATE_IDS.Leg] });
    return r.contracts
      .map(({ createdEvent: e }) => ({ cid: e.contractId, data: decodeLeg(e.createArgument) }))
      .filter((l) => l.data.owner === party && l.data.beneficiaryRef === ref);
  }

  /** A Window's resolution with its disclosure, read as the venue (read-only). */
  async function resolutionFor(termsCid: ContractId): Promise<{ cid: ContractId; disclosure: DisclosedContract } | null> {
    const r = await client.activeContracts({ parties: [cfg.venueParty], templateIds: [TEMPLATE_IDS.Resolution], includeCreatedEventBlob: true });
    for (const c of r.contracts) {
      const e = c.createdEvent;
      if (decodeResolution(e.createArgument).termsCid !== termsCid || !e.createdEventBlob) continue;
      return { cid: e.contractId, disclosure: { contractId: e.contractId, templateId: e.templateId, createdEventBlob: e.createdEventBlob, synchronizerId: c.synchronizerId } };
    }
    return null;
  }

  async function owned(commandId: string, actor: SeatActor): Promise<CommandRow | null> {
    const row = await journal.get(commandId);
    if (row && (row.party !== actor.party || row.leaseId !== actor.leaseId)) throw refuse("contract-revert", "this command id belongs to another seat");
    return row;
  }

  async function landed(row: CommandRow | null, party: Party): Promise<string | null> {
    if (!row) return null;
    if (row.updateId) return row.updateId;
    const found = await client.findAcceptedCompletion(row.commandId, [party], row.beginOffset);
    if (found?.updateId) await journal.finish(row.commandId, { state: "landed", updateId: found.updateId });
    return found?.updateId ?? null;
  }

  const confirmed = (updateId: string, recovered: boolean, pick?: { quantity: bigint; costBase: bigint }): DuelWriteReply => ({
    kind: "confirmed", updateId: updateId as Signature, recovered, quantity: pick?.quantity ?? null, costBase: pick?.costBase ?? null,
  });

  /** One journaled seat command; a retry of a landed one answers with its first transaction. */
  async function run(actor: SeatActor, journalId: string, offset: number, plan: Plan, pick?: { quantity: bigint; costBase: bigint }): Promise<DuelWriteReply> {
    const commandId = seatCommandId("duel", journalId);
    const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: "duel", beginOffset: offset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
    try {
      const r = await client.submitAndWaitForTransaction({ actAs: [actor.party], commandId, commands: plan.commands, ...inFlightBounds(row), ...(plan.disclosed?.length ? { disclosedContracts: plan.disclosed } : {}) });
      await journal.finish(commandId, { state: "landed", updateId: r.transaction.updateId });
      return confirmed(r.transaction.updateId, r.recovered, pick);
    } catch (error) {
      const d = classifyRejection(error, plan.ctx);
      const earlier = d.kind === "order-expired" || d.kind === "already-claimed" || d.kind === "contract-revert" ? await landed(row, actor.party) : null;
      if (earlier) return confirmed(earlier, true, pick);
      const state = d.kind === "send-unknown" ? "unknown" : "failed";
      await journal.finish(commandId, { state, diagnosis: d });
      return { kind: state === "unknown" ? "unknown" : "refused", diagnosis: d };
    } finally {
      ledger.seats.invalidate(actor.party);
    }
  }

  const matchOf = (all: Awaited<ReturnType<typeof duels>>, matchId: string, party: Party) =>
    all.matches.find((m) => m.data.matchId === matchId && (m.data.creator === party || m.data.challenger === party)) ?? null;
  const openOf = (all: Awaited<ReturnType<typeof duels>>, matchId: string) => all.opens.find((o) => o.data.matchId === matchId) ?? null;

  async function payFor(party: Party, amount: bigint): Promise<string[]> {
    if (amount === 0n) return [];
    const snap = await ledger.seats.read(party, { fresh: true });
    const cash = selectCash(snap.cash, amount);
    if (!cash) throw refuse("insufficient-collateral", `the seat holds ${snap.cash.reduce((s, c) => s + c.amount, 0n)} and the side pot is ${amount}`);
    return cash;
  }

  /** The seat's pick: recover a tagged leg already bought for this card, else buy one within the cap; then record it. */
  async function pick(actor: SeatActor, req: DuelWriteRequest, m: { cid: ContractId; data: DuelMatchC }, offset: number): Promise<DuelWriteReply> {
    const { data } = m;
    const i = req.cardIndex;
    if (i === undefined || !req.side) throw refuse("invalid-price", "a pick names a card and a side");
    const card = data.cards[i];
    if (!card) throw refuse("invalid-price", `the deck has no card ${i}`);
    const seat = data.creator === actor.party ? 0 : 1;
    if (data.picks.some((p) => p.seat === seat && p.cardIndex === i)) throw refuse("already-claimed", `this seat already called card ${i}`);
    const ref = gcmd.duelRef(data.arenaId, data.matchId);
    const recorded = new Set(data.picks.map((p) => p.legCid));
    const want = req.side === "up" ? "SideUp" : "SideDown";
    const find = async () => (await taggedLegs(actor.party, ref)).find((l) => l.data.termsCid === card.termsCid && l.data.outcome === want && !recorded.has(l.cid)) ?? null;
    let leg = await find();
    if (!leg) {
      const cap = data.tier.perCardCap;
      const quote = await cfg.ops.quote({ marketId: appMarketId(card.marketId), side: req.side, stakeBase: cap, displayedMaxCostBase: cap, party: actor.party, leaseId: actor.leaseId });
      if (quote.kind === "refused") return { kind: "refused", diagnosis: quote.diagnosis };
      if (quote.kind !== "quote") return { kind: "refused", diagnosis: diagnosis("requote", "the Window's price moved past the tier's per-card cap") };
      const accepted = await ledger.writer.accept(actor, { journalId: req.commandId, quoteCid: quote.quoteCid, beneficiaryRef: ref });
      if (accepted.kind !== "confirmed") return accepted;
      leg = await find();
      if (!leg) return { kind: "unknown", diagnosis: diagnosis("send-unknown", "the pick's leg landed but is not yet visible to the seat") };
    }
    const cost = leg.data.backingShare + leg.data.feePaid;
    return run(actor, req.commandId, offset, { commands: [gcmd.recordPick(m.cid, actor.party, i, leg.cid)], ctx: { step: "accept", legCids: [leg.cid] } }, { quantity: leg.data.lots * leg.data.cashUnit, costBase: cost });
  }

  /** One duel action for this seat. `address` is the lease's seat address (the deckmaster's pairing is by address). */
  async function write(actor: SeatActor, action: DuelAction, req: DuelWriteRequest, address: string): Promise<DuelWriteReply> {
    try {
      const prior = await owned(seatCommandId("duel", req.commandId), actor);
      if (prior?.state === "landed" || prior?.state === "unknown") {
        const earlier = await landed(prior, actor.party);
        if (earlier) return confirmed(earlier, true);
      }
      const all = await duels(actor.party);
      const matchId = req.matchId.toLowerCase();
      const self = actor.party;
      switch (action) {
        case "open": {
          const args = await cfg.ops.gameOpen({ matchId, party: self, address });
          if (args.kind === "refused") return { kind: "refused", diagnosis: args.diagnosis };
          const cash = await payFor(self, args.potEach);
          const cmd = gcmd.openDuel(args.arenaCid, {
            creator: self, challenger: args.challenger, matchId, tierId: args.tierId, deckHash: args.deckHash, deckSize: args.deckSize,
            clientSeeds: args.clientSeeds, joinDeadlineSec: nowSec() + args.joinWindowSec - CLOCK_MARGIN_SEC, cash,
          });
          return run(actor, req.commandId, all.offset, { commands: [cmd], disclosed: [args.disclosure], ctx: { step: "accept", cashCids: cash } });
        }
        case "join":
        case "cancel":
        case "refund-unjoined": {
          const o = openOf(all, matchId);
          if (!o) throw refuse("order-expired", "no open duel by that id for this seat (joined, cancelled or refunded)");
          if (action === "join") {
            if (o.data.challenger !== self) throw refuse("contract-revert", "this seat is not the named challenger");
            const cash = await payFor(self, o.data.tier.potEach);
            const cmd = gcmd.joinDuel(o.cid, cash, nowSec() + o.data.params.revealWindowSec - CLOCK_MARGIN_SEC);
            return run(actor, req.commandId, all.offset, { commands: [cmd], ctx: { step: "accept", cashCids: cash } });
          }
          if (action === "cancel" && o.data.creator !== self) throw refuse("contract-revert", "only the creator cancels an unjoined duel");
          const cmd = action === "cancel" ? gcmd.cancelDuel(o.cid) : gcmd.refundUnjoined(o.cid, self);
          return run(actor, req.commandId, all.offset, { commands: [cmd], ctx: { step: "refund" } });
        }
        default: {
          const m = matchOf(all, matchId, self);
          if (!m) throw refuse("order-expired", "no live duel by that id for this seat (decided or refunded)");
          if (action === "pick") return await pick(actor, req, m, all.offset);
          if (action === "settle") {
            const i = req.cardIndex ?? -1;
            const seat = m.data.creator === self ? 0 : 1;
            const card = m.data.cards[i];
            if (!card || !m.data.picks.some((p) => p.seat === seat && p.cardIndex === i && p.payout === null)) throw refuse("already-claimed", "this seat has no unscored pick on that card");
            const res = await resolutionFor(card.termsCid);
            if (!res) throw refuse("not-settled", "the card's Window has no resolution yet");
            return run(actor, req.commandId, all.offset, { commands: [gcmd.scoreDuel(m.cid, self, [{ seat, cardIndex: i, resolutionCid: res.cid }])], disclosed: [res.disclosure], ctx: { step: "claim", resolutionCids: [res.cid] } });
          }
          const cmd =
            action === "lock" ? gcmd.lockDuel(m.cid, self)
            : action === "finalize" ? gcmd.finalizeDuel(m.cid, self)
            : action === "refund-unrevealed" ? gcmd.refundUnrevealed(m.cid, self)
            : action === "refund-stale" ? gcmd.refundStale(m.cid, self)
            : null;
          if (!cmd) throw refuse("contract-revert", `no duel action ${action}`);
          return run(actor, req.commandId, all.offset, { commands: [cmd], ctx: { step: "refund" } });
        }
      }
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d = classifyRejection(error, { step: "read" });
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  return { write, duels };
}

export type GamesSeat = ReturnType<typeof createGamesSeat>;
