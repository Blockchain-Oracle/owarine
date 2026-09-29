/**
 * The seat's own commands (plan §8), each submitted with `actAs` = the leased seat party and nothing else, under the
 * `commandId` the client journaled before sending (`<intent>:<journal uuid>`), with a fresh `submissionId` per attempt
 * (`@agari/ledger`). Synchronous `submit-and-wait-for-transaction` with the ACS delta, so the created `Leg` comes back
 * in the same round trip and `BookedOrder` is built from it, never from the request.
 *
 * Measured on 3.5.17 (`scripts/drive/probe-rejections.ts`): re-sending an accept that already landed is rejected at
 * interpretation with `CONTRACT_NOT_FOUND` on the (consumed) quote, before deduplication could answer
 * `DUPLICATE_COMMAND`. So a missing quote is first checked against this command's own completion: a retry of a landed
 * accept is answered with its original transaction, never as "expired".
 */
import { TEMPLATE_IDS } from "@agari/daml";
import { LedgerError, type Command, type CreatedEvent, type DisclosedContract, type JsTransaction, type LedgerClient, type Party } from "@agari/ledger";
import type { BookedOrder } from "@agari/core/ports";
import { diagnosis, type Diagnosis, type MarketId, type Signature } from "@agari/core/types";
import { cashView, isEntity, legView } from "./contracts";
import { seatCommandId, type SeatIntent } from "./ids";
import { claimPlans, contractsOf, type ClaimPlan } from "./map";
import type { MarketReader, SeatReader } from "./reads";
import { classifyRejection, refuse, SeatRefusal, type RejectionContext } from "./rejection";

export type CommandState = "pending" | "landed" | "failed" | "unknown";

export interface CommandRow {
  commandId: string;
  leaseId: string;
  party: Party;
  kind: SeatIntent;
  /** The ledger end before the first submission: completions are searched from here. */
  beginOffset: number;
  /** Past this (plus a margin) a command with no completion cannot land. */
  deadlineMs: number;
  state: CommandState;
  updateId: string | null;
  diagnosis: Diagnosis | null;
  createdAtMs: number;
}

/** The server's command journal (plan §8): one row per logical action, owned by the lease that sent it. */
export interface CommandJournal {
  /** Inserts the row unless the command id exists; returns the row that is now stored. */
  begin(row: Omit<CommandRow, "state" | "updateId" | "diagnosis" | "createdAtMs">, nowMs: number): Promise<CommandRow>;
  finish(commandId: string, patch: { state: Exclude<CommandState, "pending">; updateId?: string | null; diagnosis?: Diagnosis | null }): Promise<void>;
  get(commandId: string): Promise<CommandRow | null>;
}

export interface SeatWriteDeps {
  client: LedgerClient;
  seats: SeatReader;
  markets: MarketReader;
  journal: CommandJournal;
  now?: () => number;
}

export interface SeatActor {
  party: Party;
  leaseId: string;
}

export type AcceptResult =
  | { kind: "confirmed"; booked: BookedOrder; updateId: Signature; recovered: boolean }
  | { kind: "refused"; diagnosis: Diagnosis }
  | { kind: "unknown"; diagnosis: Diagnosis };

export type LegsResult =
  | { kind: "confirmed"; updateId: Signature; payoutBase: bigint; legs: number; recovered: boolean }
  | { kind: "refused"; diagnosis: Diagnosis }
  | { kind: "unknown"; diagnosis: Diagnosis };

/** A deadline for commands with none of their own (claims, refunds): submit time plus this (research 05 §E). */
export const DEFAULT_COMMAND_DEADLINE_MS = 180_000;

const createdEvents = (tx: JsTransaction): CreatedEvent[] => tx.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));

/** The booked order from the transaction's created `Leg` held by the seat (research 05 §C). */
export function bookedFrom(tx: JsTransaction, party: Party): BookedOrder {
  const event = createdEvents(tx).find((e) => isEntity(e, "Leg") && (e.createArgument as { owner?: unknown }).owner === party);
  if (!event) throw new Error(`transaction ${tx.updateId} created no leg for the seat`);
  const leg = legView(event);
  const ticks = leg.backingShare / (leg.lots * leg.cashUnit);
  return {
    marketId: leg.marketId,
    side: leg.side,
    contractsRaw: contractsOf(leg.lots, leg.cashUnit),
    costBase: leg.backingShare + leg.feePaid,
    avgPriceBps: Number(ticks) * 10,
    txHash: tx.updateId as Signature,
    fillCount: 1,
  };
}

/** Cash paid to the seat in a transaction (claims and refunds), from its created `VenueCash`. */
export function paidTo(tx: JsTransaction, party: Party): bigint {
  return createdEvents(tx)
    .filter((e) => isEntity(e, "VenueCash") && (e.createArgument as { owner?: unknown }).owner === party)
    .reduce((sum, e) => sum + cashView(e).amount, 0n);
}

/** Largest first, until the cost is covered; null when the seat's cash cannot cover it. */
export function selectCash(cash: readonly { cid: string; amount: bigint }[], cost: bigint): string[] | null {
  const picked: string[] = [];
  let total = 0n;
  for (const c of [...cash].sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1))) {
    if (total >= cost) break;
    picked.push(c.cid);
    total += c.amount;
  }
  return total >= cost ? picked : null;
}

export function createSeatWriter(deps: SeatWriteDeps) {
  const { client, seats, markets, journal } = deps;
  const now = deps.now ?? Date.now;

  /** The earlier transaction of a command that already landed, if it did. */
  async function landedTx(row: CommandRow | null, party: Party): Promise<JsTransaction | null> {
    if (!row) return null;
    let updateId = row.updateId;
    if (!updateId) updateId = (await client.findAcceptedCompletion(row.commandId, [party], row.beginOffset))?.updateId ?? null;
    if (!updateId) return null;
    const tx = await client.updateById(updateId, { transactionShape: "TRANSACTION_SHAPE_ACS_DELTA", eventFormat: { filtersByParty: { [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: {} } } }] } }, verbose: true } });
    if (tx && row.state !== "landed") await journal.finish(row.commandId, { state: "landed", updateId });
    return tx ?? null;
  }

  async function owned(commandId: string, actor: SeatActor): Promise<CommandRow | null> {
    const row = await journal.get(commandId);
    // A command id is one lease's: another lease presenting it is refused, and learns nothing about it.
    if (row && (row.party !== actor.party || row.leaseId !== actor.leaseId)) throw refuse("contract-revert", "this command id belongs to another seat");
    return row;
  }

  async function submit(actor: SeatActor, commandId: string, commands: Command[], disclosed: DisclosedContract[], ctx: RejectionContext) {
    try {
      const r = await client.submitAndWaitForTransaction({ actAs: [actor.party], commandId, commands, ...(disclosed.length ? { disclosedContracts: disclosed } : {}) });
      return { ok: true as const, tx: r.transaction, recovered: r.recovered };
    } catch (error) {
      return { ok: false as const, error, diagnosis: classifyRejection(error, ctx) };
    } finally {
      seats.invalidate(actor.party);
    }
  }

  async function settleFailure(commandId: string, d: Diagnosis) {
    const state = d.kind === "send-unknown" ? "unknown" : "failed";
    await journal.finish(commandId, { state, diagnosis: d });
    return state === "unknown" ? { kind: "unknown" as const, diagnosis: d } : { kind: "refused" as const, diagnosis: d };
  }

  async function accept(actor: SeatActor, o: { journalId: string; quoteCid: string }): Promise<AcceptResult> {
    const commandId = seatCommandId("accept", o.journalId);
    try {
      const prior = await owned(commandId, actor);
      const earlier = prior?.state === "landed" || prior?.state === "unknown" ? await landedTx(prior, actor.party) : null;
      if (earlier) return { kind: "confirmed", booked: bookedFrom(earlier, actor.party), updateId: earlier.updateId as Signature, recovered: true };

      const snap = await seats.read(actor.party, { fresh: true });
      const quote = snap.quotes.find((q) => q.cid === o.quoteCid);
      if (!quote) {
        const landed = await landedTx(prior, actor.party);
        if (landed) return { kind: "confirmed", booked: bookedFrom(landed, actor.party), updateId: landed.updateId as Signature, recovered: true };
        throw refuse("order-expired", "the quote is no longer open for this seat (accepted, expired or withdrawn)");
      }
      if (quote.validUntilMs <= now()) throw refuse("order-expired", `the quote expired at ${new Date(quote.validUntilMs).toISOString()}`);
      const cost = quote.lots * quote.priceTicks * quote.cashUnit + quote.fee;
      const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: "accept", beginOffset: snap.offset, deadlineMs: quote.validUntilMs }, now());

      const acceptWith = async (cash: readonly { cid: string; amount: bigint }[]) => {
        const cashCids = selectCash(cash, cost);
        if (!cashCids) throw refuse("insufficient-collateral", `the seat holds ${cash.reduce((s, c) => s + c.amount, 0n)} and the call costs ${cost}`);
        const command: Command = { ExerciseCommand: { templateId: TEMPLATE_IDS.Quote, contractId: quote.cid, choice: "Quote_Accept", choiceArgument: { cash: cashCids, beneficiaryRef: null } } };
        return submit(actor, commandId, [command], [], { step: "accept", quoteCid: quote.cid, cashCids });
      };
      let result = await acceptWith(snap.cash);
      // Cash spent by another tab between the read and the submit: re-select once from a fresh read (research 05 §E).
      if (!result.ok && result.diagnosis.kind === "insufficient-collateral" && result.error instanceof LedgerError && result.error.kind === "not-found") {
        result = await acceptWith((await seats.read(actor.party, { fresh: true })).cash);
      }
      if (!result.ok) {
        if (result.diagnosis.kind === "order-expired") {
          const landed = await landedTx(row, actor.party);
          if (landed) return { kind: "confirmed", booked: bookedFrom(landed, actor.party), updateId: landed.updateId as Signature, recovered: true };
        }
        return await settleFailure(commandId, result.diagnosis);
      }
      await journal.finish(commandId, { state: "landed", updateId: result.tx.updateId });
      return { kind: "confirmed", booked: bookedFrom(result.tx, actor.party), updateId: result.tx.updateId as Signature, recovered: result.recovered };
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d = classifyRejection(error, { step: "accept", quoteCid: o.quoteCid });
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  /**
   * One tap exits every leg the seat holds on a Window: `Leg_Claim` against its resolution (disclosed), or, in `auto`
   * mode or as asked, `Leg_RefundStale` once `refundAfter` has passed with no resolution. Works with ops down: it needs
   * only the seat's own legs and the resolution contract.
   */
  async function exitLegs(actor: SeatActor, o: { journalId: string; marketId: MarketId; mode: "claim" | "refund" }): Promise<LegsResult> {
    const intent: SeatIntent = o.mode === "claim" ? "claim" : "refund";
    const commandId = seatCommandId(intent, o.journalId);
    try {
      const prior = await owned(commandId, actor);
      const earlier = prior?.state === "landed" || prior?.state === "unknown" ? await landedTx(prior, actor.party) : null;
      if (earlier) return { kind: "confirmed", updateId: earlier.updateId as Signature, payoutBase: paidTo(earlier, actor.party), legs: 0, recovered: true };

      const snap = await seats.read(actor.party, { fresh: true });
      const legs = snap.legs.filter((l) => l.marketId === o.marketId);
      if (legs.length === 0) {
        const landed = await landedTx(prior, actor.party);
        if (landed) return { kind: "confirmed", updateId: landed.updateId as Signature, payoutBase: paidTo(landed, actor.party), legs: 0, recovered: true };
        throw refuse("already-claimed", "the seat holds nothing on this Window");
      }
      const plans = claimPlans(legs, o.mode === "claim" ? await markets.resolutions() : new Map(), now());
      const claims = plans.filter((p): p is Extract<ClaimPlan, { kind: "claim" }> => p.kind === "claim");
      const chosen: ClaimPlan[] = o.mode === "claim" && claims.length > 0 ? claims : plans.filter((p) => p.kind === "stale-refund");
      if (chosen.length === 0) throw refuse("not-settled", o.mode === "claim" ? "the Window has no resolution yet" : "the refund opens at the leg's refundAfter");
      const disclosed = new Map<string, DisclosedContract>();
      const commands: Command[] = chosen.map((p) => {
        if (p.kind === "stale-refund") return { ExerciseCommand: { templateId: TEMPLATE_IDS.Leg, contractId: p.leg.cid, choice: "Leg_RefundStale", choiceArgument: {} } };
        if (!p.resolution.disclosure) throw new Error("resolution read without its created-event blob");
        disclosed.set(p.resolution.cid, p.resolution.disclosure);
        return { ExerciseCommand: { templateId: TEMPLATE_IDS.Leg, contractId: p.leg.cid, choice: "Leg_Claim", choiceArgument: { resolutionCid: p.resolution.cid } } };
      });
      await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: intent, beginOffset: snap.offset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      const result = await submit(actor, commandId, commands, [...disclosed.values()], {
        step: chosen[0]!.kind === "claim" ? "claim" : "refund",
        legCids: chosen.map((p) => p.leg.cid),
        resolutionCids: [...disclosed.keys()],
      });
      if (!result.ok) return await settleFailure(commandId, result.diagnosis);
      await journal.finish(commandId, { state: "landed", updateId: result.tx.updateId });
      return { kind: "confirmed", updateId: result.tx.updateId as Signature, payoutBase: paidTo(result.tx, actor.party), legs: chosen.length, recovered: result.recovered };
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d = classifyRejection(error, { step: o.mode === "claim" ? "claim" : "refund" });
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  /** A command's outcome for the lease that sent it; null when it is not that lease's (the route answers 404). */
  async function status(actor: SeatActor, commandId: string): Promise<{ status: "landed" | "failed" | "pending" | "absent"; updateId: string | null; diagnosis: Diagnosis | null } | null> {
    const row = await journal.get(commandId);
    if (!row || row.party !== actor.party || row.leaseId !== actor.leaseId) return null;
    if (row.state === "landed") return { status: "landed", updateId: row.updateId, diagnosis: null };
    if (row.state === "failed") return { status: "failed", updateId: null, diagnosis: row.diagnosis };
    const done = await client.findAcceptedCompletion(commandId, [actor.party], row.beginOffset);
    if (done?.updateId) {
      await journal.finish(commandId, { state: "landed", updateId: done.updateId });
      return { status: "landed", updateId: done.updateId, diagnosis: null };
    }
    // Past the command's own deadline plus a sequencing margin, it cannot land any more (research 05 §E).
    if (now() > row.deadlineMs + 60_000) {
      const d = diagnosis("send-unknown", "no completion before the command's deadline, so it did not land");
      await journal.finish(commandId, { state: "failed", diagnosis: d });
      return { status: "absent", updateId: null, diagnosis: d };
    }
    return { status: "pending", updateId: null, diagnosis: row.diagnosis };
  }

  /** Recycling a drained seat: every `VenueCash` it still holds is withdrawn (its owner's own choice). */
  async function sweepCash(party: Party, tag: string): Promise<number> {
    const snap = await seats.read(party, { fresh: true });
    if (snap.cash.length === 0) return 0;
    const commands: Command[] = snap.cash.map((c) => ({ ExerciseCommand: { templateId: TEMPLATE_IDS.VenueCash, contractId: c.cid, choice: "VenueCash_Withdraw", choiceArgument: {} } }));
    await client.submitAndWaitForTransaction({ actAs: [party], commandId: `sweep:${tag}`, commands });
    seats.invalidate(party);
    return snap.cash.length;
  }

  return { accept, exitLegs, status, sweepCash };
}

export type SeatWriter = ReturnType<typeof createSeatWriter>;
