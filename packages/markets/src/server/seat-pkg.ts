/**
 * The seat's side of abu-pm-seat (R2, revamp step 4): its resting exits (trailing stop, stop, take-profit) and the
 * credits it sends and receives. Reads are AS the seat (it signs its exits and sees the offers it sends or receives);
 * the venue's `TransferDesk` is read AS the venue only for its disclosure blob, never written as it.
 *
 *   arm      create `RestingExit` (owner alone), cancelling the seat's earlier exits on that Window side in the same
 *            command, so a seat has at most one exit per position                              intent `exit`
 *   disarm   `RestExit_Cancel` on every exit the seat has on that Window side                  intent `exit-cancel`
 *   send     `TransferDesk_Offer` with the desk disclosed: the seat's own spendable credits in  intent `send`
 *   end      `Offer_Accept` / `Offer_Reject` (receiver) or `Offer_Withdraw` (sender)            intent `send-end`
 *
 * Until the R2 DAR is on the participant every read answers `deployed: false` with nothing in it (the ledger names the
 * package as unknown), so nothing that reads a seat breaks before the upload, and every write is refused `not-deployed`.
 */
import { SEAT_TEMPLATE_IDS, Seat } from "@owarine/daml";
import { LedgerError, type Command, type CreatedEvent, type DisclosedContract, type JsTransaction, type LedgerClient, type Party } from "@owarine/ledger";
import { diagnosis, type Diagnosis, type MarketId, type Side, type Signature } from "@owarine/core/types";
import { entityOf } from "./contracts";
import { appMarketId } from "./ids";
import { seatCommandId } from "./ids";
import type { MarketReader, SeatReader } from "./reads";
import { classifyRejection, refuse, SeatRefusal } from "./rejection";
import { DEFAULT_COMMAND_DEADLINE_MS, paidTo, selectCash, type CommandJournal, type SeatActor, type SeatCommandKit } from "./writes";

const S = Seat.PM.Seat;

/** One of the seat's resting exits, as the app reads it. Prices are the held side's own ticks of 1000. */
export interface ExitView {
  cid: string;
  exitRef: string;
  damlMarketId: string;
  marketId: MarketId;
  termsCid: string;
  side: Side;
  lots: bigint;
  cashUnit: bigint;
  floorTicks: number;
  takeProfitTicks: number | null;
  /** The level on the ledger (price × 10^8); with `trailBps` the venue moves it in the seat's favour. */
  stop: { stopE8: bigint; trailBps: number | null } | null;
  expiresAtMs: number;
}

/** A credit transfer the seat sent (`out`) or received (`in`), still open. */
export interface TransferView {
  cid: string;
  direction: "in" | "out";
  /** The other seat. */
  counterparty: Party;
  amount: bigint;
  memo: string;
  createdAtMs: number;
}

const EXIT = entityOf(SEAT_TEMPLATE_IDS.RestingExit);
const OFFER = entityOf(SEAT_TEMPLATE_IDS.CashTransferOffer);
const DESK = entityOf(SEAT_TEMPLATE_IDS.TransferDesk);
const is = (e: CreatedEvent, entity: string) => entityOf(e.templateId) === entity;
const big = (v: string) => BigInt(v);
const ms = (t: string) => {
  const v = Date.parse(t);
  if (!Number.isFinite(v)) throw new Error(`not a Daml Time: ${t}`);
  return v;
};

export function exitView(e: CreatedEvent): ExitView & { owner: Party } {
  const x = S.Exit.RestingExit.decoder.runWithException(e.createArgument);
  return {
    cid: e.contractId, owner: x.owner, exitRef: x.exitRef, damlMarketId: x.marketId, marketId: appMarketId(x.marketId), termsCid: x.termsCid,
    side: x.outcome === "SideUp" ? "up" : "down", lots: big(x.lots), cashUnit: big(x.cashUnit), floorTicks: Number(x.floorTicks),
    takeProfitTicks: x.takeProfitTicks === null ? null : Number(x.takeProfitTicks),
    stop: x.stop === null ? null : { stopE8: big(x.stop.stopE8), trailBps: x.stop.trailBps === null ? null : Number(x.stop.trailBps) },
    expiresAtMs: ms(x.expiresAt),
  };
}

export function transferView(e: CreatedEvent, party: Party): TransferView | null {
  const o = S.Send.CashTransferOffer.decoder.runWithException(e.createArgument);
  const direction = o.sender === party ? "out" : o.receiver === party ? "in" : null;
  if (!direction) return null;
  return { cid: e.contractId, direction, counterparty: direction === "out" ? o.receiver : o.sender, amount: big(o.amount), memo: o.memo, createdAtMs: ms(e.createdAt) };
}

const NOT_DEPLOYED = new Set(["PACKAGE_NAMES_NOT_FOUND", "PACKAGE_NOT_FOUND", "TEMPLATES_OR_INTERFACES_NOT_FOUND", "NO_TEMPLATES_OR_INTERFACES_FOR_PACKAGE_NAME"]);
/** Whether an error says the participant does not know abu-pm-seat (R2 not uploaded yet). */
export const seatPkgMissing = (error: unknown): boolean =>
  error instanceof LedgerError && ((error.code !== undefined && NOT_DEPLOYED.has(error.code)) || /abu-pm-seat/.test(error.message) && /not found|unknown/i.test(error.message));

export interface SeatPkgSnapshot {
  /** False until the R2 DAR is on the participant. */
  deployed: boolean;
  exits: ExitView[];
  transfers: TransferView[];
}

export interface SeatPkgReader {
  read(party: Party, o?: { fresh?: boolean }): Promise<SeatPkgSnapshot>;
  invalidate(party: Party): void;
  /** The venue's transfer desk as a disclosed contract; null when there is none yet (ops creates it on start). */
  transferDesk(): Promise<DisclosedContract | null>;
}

const CACHE_MS = 1_500;
/** How long a "not on the participant" answer is believed before the reads try again. */
const MISSING_RECHECK_MS = 60_000;

export function createSeatPkgReader(client: LedgerClient, venue: Party, o: { now?: () => number } = {}): SeatPkgReader {
  const now = o.now ?? Date.now;
  const cache = new Map<Party, { at: number; value: Promise<SeatPkgSnapshot> }>();
  let missingSince: number | null = null;
  let desk: { at: number; value: Promise<DisclosedContract | null> } | null = null;

  const empty: SeatPkgSnapshot = { deployed: false, exits: [], transfers: [] };
  async function fetch(party: Party): Promise<SeatPkgSnapshot> {
    if (missingSince !== null && now() - missingSince < MISSING_RECHECK_MS) return empty;
    try {
      const r = await client.activeContracts({ parties: [party], templateIds: [SEAT_TEMPLATE_IDS.RestingExit, SEAT_TEMPLATE_IDS.CashTransferOffer] });
      missingSince = null;
      const snap: SeatPkgSnapshot = { deployed: true, exits: [], transfers: [] };
      for (const { createdEvent: e } of r.contracts) {
        if (is(e, EXIT)) {
          const { owner, ...x } = exitView(e);
          if (owner === party) snap.exits.push(x);
        } else if (is(e, OFFER)) {
          const t = transferView(e, party);
          if (t) snap.transfers.push(t);
        }
      }
      snap.transfers.sort((a, b) => b.createdAtMs - a.createdAtMs);
      return snap;
    } catch (error) {
      if (seatPkgMissing(error)) {
        missingSince = now();
        return empty;
      }
      throw error;
    }
  }

  return {
    read(party, opts = {}) {
      const hit = cache.get(party);
      if (!opts.fresh && hit && now() - hit.at < CACHE_MS) return hit.value;
      const value = fetch(party);
      const entry = { at: now(), value };
      cache.set(party, entry);
      value.catch(() => cache.get(party) === entry && cache.delete(party));
      if (cache.size > 512) for (const [key, e] of cache) if (now() - e.at >= CACHE_MS) cache.delete(key);
      return value;
    },
    invalidate(party) {
      cache.delete(party);
    },
    transferDesk() {
      if (desk && now() - desk.at < 60_000) return desk.value;
      const value = client
        .activeContracts({ parties: [venue], templateIds: [SEAT_TEMPLATE_IDS.TransferDesk], includeCreatedEventBlob: true })
        .then((r) => {
          const c = r.contracts.find((x) => is(x.createdEvent, DESK) && x.createdEvent.createdEventBlob);
          return c ? { createdEventBlob: c.createdEvent.createdEventBlob!, templateId: c.createdEvent.templateId, contractId: c.createdEvent.contractId, synchronizerId: c.synchronizerId } : null;
        })
        .catch((error: unknown) => {
          if (seatPkgMissing(error)) return null;
          throw error;
        });
      const entry = { at: now(), value };
      desk = entry;
      value.then((v) => v === null && desk === entry && (desk = null), () => desk === entry && (desk = null));
      return value;
    },
  };
}

// ---- writes ---------------------------------------------------------------------------------------------------------

export interface ArmExitRequest {
  journalId: string;
  marketId: MarketId;
  side: Side;
  /** The least a fill pays per lot of the held side (ticks of 1000). */
  floorTicks: number;
  takeProfitTicks: number | null;
  stop: { stopE8: bigint; trailBps: number | null } | null;
}

export type ExitResult =
  | { kind: "confirmed"; exit: ExitView; replaced: number; updateId: Signature; recovered: boolean }
  | { kind: "refused"; diagnosis: Diagnosis }
  | { kind: "unknown"; diagnosis: Diagnosis };

export type ExitCancelResult =
  | { kind: "confirmed"; cancelled: number; updateId: Signature; recovered: boolean }
  | { kind: "gone" }
  | { kind: "refused"; diagnosis: Diagnosis }
  | { kind: "unknown"; diagnosis: Diagnosis };

export type SendResult =
  | { kind: "confirmed"; transfer: TransferView; updateId: Signature; recovered: boolean }
  | { kind: "refused"; diagnosis: Diagnosis }
  | { kind: "unknown"; diagnosis: Diagnosis };

export type TransferEndResult =
  | { kind: "confirmed"; creditedBase: bigint; updateId: Signature; recovered: boolean }
  | { kind: "refused"; diagnosis: Diagnosis }
  | { kind: "unknown"; diagnosis: Diagnosis };

/** The bound the ledger puts on a memo. */
export const MAX_MEMO_LENGTH = 140;

const createdEvents = (tx: JsTransaction): CreatedEvent[] => tx.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));
const damlSide = (s: Side) => (s === "up" ? "SideUp" : "SideDown");
const int = (v: bigint | number) => BigInt(v).toString();

export function createSeatPkgWriter(deps: { seats: SeatReader; markets: MarketReader; pkg: SeatPkgReader; journal: CommandJournal; venueParty: Party; now?: () => number }, kit: SeatCommandKit) {
  const { seats, markets, pkg, journal } = deps;
  const now = deps.now ?? Date.now;
  const { landedTx, owned, submit, settleFailure } = kit;

  const notDeployed = () => refuse("not-deployed", "trailing stops and sending credits arrive with the next ledger release (R2)");
  const fail = (error: unknown, step: "exit" | "exit-cancel" | "send" | "send-end") => {
    if (error instanceof SeatRefusal) return { kind: "refused" as const, diagnosis: error.diagnosis };
    const d = classifyRejection(error, { step });
    return d.kind === "send-unknown" ? { kind: "unknown" as const, diagnosis: d } : { kind: "refused" as const, diagnosis: d };
  };
  const exitFrom = (tx: JsTransaction, party: Party): ExitView => {
    const e = createdEvents(tx).find((x) => is(x, EXIT) && (x.createArgument as { owner?: unknown }).owner === party);
    if (!e) throw new Error(`transaction ${tx.updateId} created no exit for the seat`);
    const { owner: _o, ...x } = exitView(e);
    return x;
  };

  /** Arms (or re-arms) the seat's exit on one Window side over every lot it holds there. */
  async function arm(actor: SeatActor, o: ArmExitRequest): Promise<ExitResult> {
    const commandId = seatCommandId("exit", o.journalId);
    try {
      const prior = await owned(commandId, actor);
      const earlier = prior?.state === "landed" || prior?.state === "unknown" ? await landedTx(prior, actor.party) : null;
      if (earlier) return { kind: "confirmed", exit: exitFrom(earlier, actor.party), replaced: 0, updateId: earlier.updateId as Signature, recovered: true };

      const [snap, mine] = await Promise.all([seats.read(actor.party, { fresh: true }), pkg.read(actor.party, { fresh: true })]);
      if (!mine.deployed) throw notDeployed();
      const legs = snap.legs.filter((l) => l.marketId === o.marketId && l.side === o.side);
      const held = legs.reduce((s, l) => s + l.lots, 0n);
      if (held === 0n) throw refuse("contract-revert", `nothing held on the ${o.side} side of this Window`);
      const leg = legs[0]!;
      const terms = await markets.terms(leg.termsCid);
      if (!terms) throw refuse("market-not-trading", "the Window's terms are not readable");
      if (terms.lockAtMs <= now()) throw refuse("market-not-trading", "this Window has locked; it pays at settlement");
      const replaced = mine.exits.filter((x) => x.termsCid === leg.termsCid && x.side === o.side);
      const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: "exit", beginOffset: snap.offset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      const commands: Command[] = [
        ...replaced.map((x): Command => ({ ExerciseCommand: { templateId: SEAT_TEMPLATE_IDS.RestingExit, contractId: x.cid, choice: "RestExit_Cancel", choiceArgument: {} } })),
        {
          CreateCommand: {
            templateId: SEAT_TEMPLATE_IDS.RestingExit,
            createArguments: {
              owner: actor.party, venue: deps.venueParty, exitRef: o.journalId.toLowerCase(), termsCid: leg.termsCid, marketId: leg.damlMarketId,
              outcome: damlSide(o.side), lots: int(held), cashUnit: int(leg.cashUnit), floorTicks: int(o.floorTicks),
              takeProfitTicks: o.takeProfitTicks === null ? null : int(o.takeProfitTicks),
              stop: o.stop === null ? null : { stopE8: int(o.stop.stopE8), trailBps: o.stop.trailBps === null ? null : int(o.stop.trailBps) },
              expiresAt: new Date(terms.lockAtMs).toISOString(),
            },
          },
        },
      ];
      const result = await submit(actor, row, commands, [], { step: "exit" });
      pkg.invalidate(actor.party);
      if (!result.ok) return await settleFailure(commandId, result.diagnosis);
      await journal.finish(commandId, { state: "landed", updateId: result.tx.updateId });
      return { kind: "confirmed", exit: exitFrom(result.tx, actor.party), replaced: replaced.length, updateId: result.tx.updateId as Signature, recovered: result.recovered };
    } catch (error) {
      return fail(error, "exit");
    }
  }

  /** Cancels every exit the seat has on one Window side. */
  async function disarm(actor: SeatActor, o: { journalId: string; marketId: MarketId; side: Side }): Promise<ExitCancelResult> {
    const commandId = seatCommandId("exit-cancel", o.journalId);
    try {
      const prior = await owned(commandId, actor);
      const earlier = prior?.state === "landed" || prior?.state === "unknown" ? await landedTx(prior, actor.party) : null;
      if (earlier) return { kind: "confirmed", cancelled: 0, updateId: earlier.updateId as Signature, recovered: true };
      const mine = await pkg.read(actor.party, { fresh: true });
      if (!mine.deployed) throw notDeployed();
      const exits = mine.exits.filter((x) => x.marketId === o.marketId && x.side === o.side);
      if (exits.length === 0) return { kind: "gone" };
      const snap = await seats.read(actor.party);
      const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: "exit-cancel", beginOffset: snap.offset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      const result = await submit(actor, row, exits.map((x): Command => ({ ExerciseCommand: { templateId: SEAT_TEMPLATE_IDS.RestingExit, contractId: x.cid, choice: "RestExit_Cancel", choiceArgument: {} } })), [], { step: "exit-cancel" });
      pkg.invalidate(actor.party);
      if (!result.ok) {
        // Filled, ratcheted or swept between the read and the submit: what was there is gone, and nothing else to cancel.
        if (result.error instanceof LedgerError && result.error.kind === "not-found") {
          await journal.finish(commandId, { state: "failed", diagnosis: diagnosis("order-expired", "the exit changed before the cancel") });
          return { kind: "gone" };
        }
        return await settleFailure(commandId, result.diagnosis);
      }
      await journal.finish(commandId, { state: "landed", updateId: result.tx.updateId });
      return { kind: "confirmed", cancelled: exits.length, updateId: result.tx.updateId as Signature, recovered: result.recovered };
    } catch (error) {
      return fail(error, "exit-cancel");
    }
  }

  /** Sends `amount` of the seat's spendable credits to another seat, as an offer the receiver accepts. */
  async function send(actor: SeatActor, o: { journalId: string; receiver: Party; amount: bigint; memo: string }): Promise<SendResult> {
    const commandId = seatCommandId("send", o.journalId);
    const confirmed = (tx: JsTransaction, recovered: boolean): SendResult => {
      const e = createdEvents(tx).find((x) => is(x, OFFER));
      const t = e ? transferView(e, actor.party) : null;
      if (!t) throw new Error(`transaction ${tx.updateId} created no transfer for the seat`);
      return { kind: "confirmed", transfer: t, updateId: tx.updateId as Signature, recovered };
    };
    try {
      const prior = await owned(commandId, actor);
      const earlier = prior?.state === "landed" || prior?.state === "unknown" ? await landedTx(prior, actor.party) : null;
      if (earlier) return confirmed(earlier, true);
      if (o.receiver === actor.party) throw refuse("contract-revert", "a transfer goes to another seat");
      if (o.amount <= 0n) throw refuse("invalid-price", "a transfer moves a positive amount");
      if ([...o.memo].length > MAX_MEMO_LENGTH) throw refuse("invalid-price", `a memo is at most ${MAX_MEMO_LENGTH} characters`);
      const desk = await pkg.transferDesk();
      if (!desk?.contractId) throw notDeployed();
      const deskCid = desk.contractId;
      const snap = await seats.read(actor.party, { fresh: true });
      const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: "send", beginOffset: snap.offset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      const sendWith = (cash: readonly { cid: string; amount: bigint }[]) => {
        const cashCids = selectCash(cash, o.amount);
        if (!cashCids) throw refuse("insufficient-collateral", `the seat holds ${cash.reduce((s, c) => s + c.amount, 0n)} and the transfer is ${o.amount}`);
        const command: Command = {
          ExerciseCommand: {
            templateId: SEAT_TEMPLATE_IDS.TransferDesk, contractId: deskCid, choice: "TransferDesk_Offer",
            choiceArgument: { sender: actor.party, receiver: o.receiver, cash: cashCids, amount: int(o.amount), memo: o.memo },
          },
        };
        return submit(actor, row, [command], [desk], { step: "send", cashCids });
      };
      let result = await sendWith(snap.cash);
      if (!result.ok && result.diagnosis.kind === "insufficient-collateral" && result.error instanceof LedgerError && result.error.kind === "not-found") {
        result = await sendWith((await seats.read(actor.party, { fresh: true })).cash);
      }
      pkg.invalidate(actor.party);
      if (!result.ok) return await settleFailure(commandId, result.diagnosis);
      await journal.finish(commandId, { state: "landed", updateId: result.tx.updateId });
      return confirmed(result.tx, result.recovered);
    } catch (error) {
      return fail(error, "send");
    }
  }

  /** The receiver accepts or rejects an offer, or the sender withdraws it. */
  async function endTransfer(actor: SeatActor, o: { journalId: string; offerCid: string; choice: "accept" | "reject" | "withdraw" }): Promise<TransferEndResult> {
    const commandId = seatCommandId("send-end", o.journalId);
    try {
      const prior = await owned(commandId, actor);
      const earlier = prior?.state === "landed" || prior?.state === "unknown" ? await landedTx(prior, actor.party) : null;
      if (earlier) return { kind: "confirmed", creditedBase: paidTo(earlier, actor.party), updateId: earlier.updateId as Signature, recovered: true };
      const mine = await pkg.read(actor.party, { fresh: true });
      if (!mine.deployed) throw notDeployed();
      const offer = mine.transfers.find((t) => t.cid === o.offerCid);
      if (!offer) throw refuse("order-expired", "the transfer is no longer open (accepted, rejected or withdrawn)");
      const want = o.choice === "withdraw" ? "out" : "in";
      if (offer.direction !== want) throw refuse("contract-revert", o.choice === "withdraw" ? "only the sender withdraws a transfer" : "only the receiver accepts or rejects a transfer");
      const choice = o.choice === "accept" ? "Offer_Accept" : o.choice === "reject" ? "Offer_Reject" : "Offer_Withdraw";
      const snap = await seats.read(actor.party);
      const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: "send-end", beginOffset: snap.offset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      const result = await submit(actor, row, [{ ExerciseCommand: { templateId: SEAT_TEMPLATE_IDS.CashTransferOffer, contractId: offer.cid, choice, choiceArgument: {} } }], [], { step: "send-end" });
      pkg.invalidate(actor.party);
      pkg.invalidate(offer.counterparty);
      seats.invalidate(offer.counterparty);
      if (!result.ok) return await settleFailure(commandId, result.diagnosis);
      await journal.finish(commandId, { state: "landed", updateId: result.tx.updateId });
      return { kind: "confirmed", creditedBase: paidTo(result.tx, actor.party), updateId: result.tx.updateId as Signature, recovered: result.recovered };
    } catch (error) {
      return fail(error, "send-end");
    }
  }

  return { arm, disarm, send, endTransfer };
}

export type SeatPkgWriter = ReturnType<typeof createSeatPkgWriter>;
