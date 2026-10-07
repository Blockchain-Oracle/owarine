/**
 * The seat's two resting-call commands (C7c, K-235), each `actAs` = the leased seat party only, under the commandId the
 * client journaled before sending: place the venue's offer (`RestOffer_Place`, its own cash going into the call) and cancel
 * its own calls (`Rest_Cancel`). They share the seat commands' kit (`seatCommandKit` in `writes.ts`): journal, landed
 * recovery, rejection classification.
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import { LedgerError, type Command, type CreatedEvent, type JsTransaction, type Party } from "@owarine/ledger";
import type { RestedOrder } from "@owarine/core/ports";
import { diagnosis, type Diagnosis, type MarketId, type Signature } from "@owarine/core/types";
import { isEntity, restingCallView } from "./contracts";
import { seatCommandId } from "./ids";
import { contractsOf } from "./map";
import type { SeatReader } from "./reads";
import { classifyRejection, refuse, SeatRefusal, type RejectionContext } from "./rejection";
import { DEFAULT_COMMAND_DEADLINE_MS, paidTo, selectCash, type CommandJournal, type SeatActor, type SeatCommandKit } from "./writes";

const PAIR_TICKS = 1000n;

const createdEvents = (tx: JsTransaction): CreatedEvent[] => tx.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));

/** A resting call placed (C7c): built from the `RestingCall` the transaction created for the seat, never from the request. */
export type RestPlaceResult =
  | { kind: "confirmed"; rested: RestedOrder; updateId: Signature; recovered: boolean }
  | { kind: "refused"; diagnosis: Diagnosis }
  | { kind: "unknown"; diagnosis: Diagnosis };

/** Resting calls cancelled: what came back as venue credit. `gone`: none of them was resting any more, nothing was sent. */
export type RestCancelResult =
  | { kind: "confirmed"; updateId: Signature; refundedBase: bigint; cancelled: number; recovered: boolean }
  | { kind: "gone" }
  | { kind: "refused"; diagnosis: Diagnosis }
  | { kind: "unknown"; diagnosis: Diagnosis };

/** The resting call a placing transaction created for the seat, as the app's `RestedOrder` (price in YES terms, like a Book order). */
export function restedFrom(tx: JsTransaction, party: Party): RestedOrder {
  const event = createdEvents(tx).find((e) => isEntity(e, "RestingCall") && (e.createArgument as { owner?: unknown }).owner === party);
  if (!event) throw new Error(`transaction ${tx.updateId} created no resting call for the seat`);
  const c = restingCallView(event);
  return {
    marketId: c.marketId,
    side: c.side,
    txHash: tx.updateId as Signature,
    callRef: c.callRef,
    lots: c.lots,
    priceTicks: Number(c.side === "up" ? c.priceTicks : PAIR_TICKS - c.priceTicks),
    contractsRaw: contractsOf(c.lots, c.cashUnit),
    escrowBase: c.escrow,
    expireSec: Math.floor(c.expiresAtMs / 1000),
  };
}

export function createRestWriter(deps: { seats: SeatReader; journal: CommandJournal; now?: () => number }, kit: SeatCommandKit) {
  const { seats, journal } = deps;
  const now = deps.now ?? Date.now;
  const { landedTx, owned, submit, settleFailure } = kit;

  /**
   * The seat places the venue's offer to hold a pre-open resting call (C7c): `RestOffer_Place` with `actAs` = the seat
   * only, its own cash going into the call. The offer is the venue's consent and lives at most until the bell; a gone or
   * lapsed one is `order-expired`, answered with the original transaction when this very command already landed.
   */
  async function placeRest(actor: SeatActor, o: { journalId: string; offerCid: string }): Promise<RestPlaceResult> {
    const commandId = seatCommandId("rest", o.journalId);
    const ctx = { step: "rest" as const, offerCid: o.offerCid };
    const confirmed = (tx: JsTransaction, recovered: boolean): RestPlaceResult => ({ kind: "confirmed", rested: restedFrom(tx, actor.party), updateId: tx.updateId as Signature, recovered });
    try {
      const prior = await owned(commandId, actor);
      const earlier = prior?.state === "landed" || prior?.state === "unknown" ? await landedTx(prior, actor.party) : null;
      if (earlier) return confirmed(earlier, true);

      const snap = await seats.read(actor.party, { fresh: true });
      const offer = (snap.restingOffers ?? []).find((x) => x.cid === o.offerCid);
      if (!offer) {
        const landed = await landedTx(prior, actor.party);
        if (landed) return confirmed(landed, true);
        throw refuse("order-expired", "the offer is no longer open for this seat (placed, lapsed or swept)");
      }
      if (offer.validUntilMs <= now()) throw refuse("order-expired", `the offer lapsed at ${new Date(offer.validUntilMs).toISOString()}`);
      const escrow = offer.lots * offer.priceTicks * offer.cashUnit;
      const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: "rest", beginOffset: snap.offset, deadlineMs: offer.validUntilMs }, now());

      const placeWith = async (cash: readonly { cid: string; amount: bigint }[]) => {
        const cashCids = selectCash(cash, escrow);
        if (!cashCids) throw refuse("insufficient-collateral", `the seat holds ${cash.reduce((s, c) => s + c.amount, 0n)} and the call holds ${escrow}`);
        const command: Command = { ExerciseCommand: { templateId: TEMPLATE_IDS.RestingOffer, contractId: offer.cid, choice: "RestOffer_Place", choiceArgument: { cash: cashCids } } };
        return submit(actor, row, [command], [], { ...ctx, cashCids });
      };
      let result = await placeWith(snap.cash);
      // Cash spent by another tab between the read and the submit: re-select once from a fresh read.
      if (!result.ok && result.diagnosis.kind === "insufficient-collateral" && result.error instanceof LedgerError && result.error.kind === "not-found") {
        result = await placeWith((await seats.read(actor.party, { fresh: true })).cash);
      }
      if (!result.ok) {
        if (result.diagnosis.kind === "order-expired") {
          const landed = await landedTx(row, actor.party);
          if (landed) return confirmed(landed, true);
        }
        return await settleFailure(commandId, result.diagnosis);
      }
      await journal.finish(commandId, { state: "landed", updateId: result.tx.updateId });
      return confirmed(result.tx, result.recovered);
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d = classifyRejection(error, ctx);
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  /**
   * The seat cancels its own resting calls on one Window (C7c): `Rest_Cancel` on each, in one command, `actAs` = the seat
   * only. The calls are found by `callRef`, never by contract id, because a partial fill re-creates a call. A call that
   * filled, expired or was cancelled before this ran is not an error: nothing left to cancel answers `gone`, and a call
   * that changed between the read and the submit is re-read once.
   */
  async function cancelRest(actor: SeatActor, o: { journalId: string; marketId: MarketId; callRefs: readonly string[] }): Promise<RestCancelResult> {
    const commandId = seatCommandId("rest-cancel", o.journalId);
    const ctx: RejectionContext = { step: "rest-cancel" };
    const confirmed = (tx: JsTransaction, cancelled: number, recovered: boolean): RestCancelResult => ({ kind: "confirmed", updateId: tx.updateId as Signature, refundedBase: paidTo(tx, actor.party), cancelled, recovered });
    const resting = (snap: { restingCalls?: readonly { cid: string; callRef: string; marketId: MarketId }[] }) => (snap.restingCalls ?? []).filter((c) => c.marketId === o.marketId && o.callRefs.includes(c.callRef));
    try {
      const prior = await owned(commandId, actor);
      const earlier = prior?.state === "landed" || prior?.state === "unknown" ? await landedTx(prior, actor.party) : null;
      if (earlier) return confirmed(earlier, 0, true);

      const snap = await seats.read(actor.party, { fresh: true });
      let calls = resting(snap);
      if (calls.length === 0) {
        const landed = await landedTx(prior, actor.party);
        return landed ? confirmed(landed, 0, true) : { kind: "gone" };
      }
      const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: "rest-cancel", beginOffset: snap.offset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      const cancelWith = (list: readonly { cid: string }[]) =>
        submit(actor, row, list.map((c): Command => ({ ExerciseCommand: { templateId: TEMPLATE_IDS.RestingCall, contractId: c.cid, choice: "Rest_Cancel", choiceArgument: {} } })), [], { ...ctx, callCids: list.map((c) => c.cid) });
      let result = await cancelWith(calls);
      // A partial fill re-created a call (or it ended) between the read and the submit: look again, once.
      if (!result.ok && result.error instanceof LedgerError && result.error.kind === "not-found") {
        calls = resting(await seats.read(actor.party, { fresh: true }));
        if (calls.length === 0) {
          await journal.finish(commandId, { state: "failed", diagnosis: diagnosis("order-expired", "the calls ended before the cancel") });
          return { kind: "gone" };
        }
        result = await cancelWith(calls);
      }
      if (!result.ok) return await settleFailure(commandId, result.diagnosis);
      await journal.finish(commandId, { state: "landed", updateId: result.tx.updateId });
      return confirmed(result.tx, calls.length, result.recovered);
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d = classifyRejection(error, ctx);
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  return { placeRest, cancelRest };
}

export type RestWriter = ReturnType<typeof createRestWriter>;
