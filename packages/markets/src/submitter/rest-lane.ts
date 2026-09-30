/**
 * The pre-open resting call on Canton (C7c, K-235, D-088): the venue's offer, then the seat's own place, through our routes.
 *
 *   offer     POST /api/ledger/resting {marketId, side, stakeBase, priceCents, restUntil, displayedEscrowBase} → ops checks the
 *             Window is still listed, re-sizes the call on its grid, counts the seat's calls (16 a Window) and makes a
 *             `RestingOffer` for the seat, good until the bell at the latest; a different escrow is a requote
 *   journal   the intent is recorded BEFORE the place is sent; its id is the ledger commandId (never re-sent under a new id)
 *   place     POST /api/ledger/resting/<cid>/place {commandId} → `RestOffer_Place` as the seat's party, its own cash going into
 *             the call; the rested order is built from the created `RestingCall`, never from the request
 *   confirm   only when the answer never came: GET /api/ledger/commands/<id> until landed, absent or 90 s
 *
 *   cancel    POST /api/ledger/resting/cancel {commandId, marketId, callRefs} → `Rest_Cancel` on each of the seat's calls, the
 *             escrow of the lots still resting back as venue credit; a call that already ended is `gone`
 *
 * The daily stop is asked before a call rests, but a call spends nothing until it fills, so its reservation is released at
 * once. No retries anywhere in the lane; idempotency is the commandId's.
 */
import type { OrderOutcome, OrderRequest, PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Diagnosis, type MarketId, type Signature } from "@agari/core/types";
import { ledgerRequest } from "../provider/ledger-api";
import { restingCancelReplyWire, restingOfferReplyWire, restingPlaceReplyWire } from "../provider/ledger-wire";
import { pollCommand, type SeatLaneDeps } from "./seat-lane";

const refused = (d: Diagnosis) => ({ status: "refused" as const, diagnosis: d });

/** A call that rests: the ticket's own-side price in cents (`Quote.oddsCents` of a `restingQuote`) and the escrow it showed. */
export async function submitSeatRest(deps: SeatLaneDeps, request: OrderRequest, onPhase?: PhaseListener): Promise<OrderOutcome> {
  if (request.wallet !== deps.wallet) return refused(diagnosis("signer-required", "this session writes for another seat"));
  const reservation = await deps.stopGate.checkAndReserve(deps.wallet, request.displayedQuote.maxCostBase);
  if (!reservation.ok) return refused(diagnosis("daily-stop", reservation.reason));
  // Nothing is spent until a call fills, and a fill is the venue's write: the gate is asked, then let go.
  const release = () => deps.stopGate.reconcile(reservation.reservationId, 0n);

  const offer = await ledgerRequest("/resting", {
    method: "POST",
    body: {
      marketId: request.market.marketId,
      side: request.side,
      stakeBase: request.stakeBase,
      priceCents: request.displayedQuote.oddsCents,
      restUntil: request.restUntil ?? "bell",
      displayedEscrowBase: request.displayedQuote.maxCostBase,
    },
    wire: restingOfferReplyWire,
  });
  if (!offer.ok) {
    await release();
    return refused(offer.diagnosis);
  }
  if (offer.value.kind === "refused") {
    await release();
    return refused(offer.value.diagnosis);
  }
  if (offer.value.kind === "requote") {
    await release();
    return { status: "requote", quote: offer.value.quote };
  }
  const { offerCid, validUntilMs } = offer.value;

  const record = await deps.journal.record({
    kind: "order",
    wallet: deps.wallet,
    summary: `rest ${request.side} ${request.displayedQuote.maxCostBase} on ${request.market.marketId}`,
    marketId: request.market.marketId,
  });
  onPhase?.("submitted");
  const place = () => ledgerRequest(`/resting/${encodeURIComponent(offerCid)}/place`, { method: "POST", body: { commandId: record.id }, wire: restingPlaceReplyWire });
  const reply = await place();
  const deadlineSec = Math.ceil(validUntilMs / 1000);

  if (reply.ok && reply.value.kind === "confirmed") {
    await deps.journal.markSent(record.id, reply.value.updateId, deadlineSec);
    await deps.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: reply.value.updateId });
    await release();
    return { status: "resting", rested: reply.value.rested };
  }
  if (reply.ok && reply.value.kind === "refused") {
    await deps.journal.markFailed(record.id, reply.value.diagnosis.technical);
    await release();
    return refused(reply.value.diagnosis);
  }
  // No answer (network, 5xx, send-unknown): the place may still land. Never re-send under a new id; ask the ledger.
  await deps.journal.markUnknown(record.id);
  onPhase?.("confirming");
  const settled = await pollCommand(record.id, deps);
  if (settled?.status === "landed") {
    // The same commandId again is idempotent: the server answers with the transaction that already landed.
    const again = await place();
    if (again.ok && again.value.kind === "confirmed") {
      await deps.journal.markSent(record.id, again.value.updateId, deadlineSec);
      await deps.journal.markConfirmed(record.id);
      onPhase?.("confirmed", { txHash: again.value.updateId });
      await release();
      return { status: "resting", rested: again.value.rested };
    }
  }
  await release();
  if (settled?.status === "failed" || settled?.status === "absent") {
    await deps.journal.markFailed(record.id, settled.diagnosis?.technical ?? settled.status);
    return refused(settled.diagnosis ?? diagnosis("send-unknown", "the call did not land"));
  }
  const why = reply.ok ? ("diagnosis" in reply.value ? reply.value.diagnosis : diagnosis("send-unknown", "no answer")) : reply.diagnosis;
  onPhase?.("unknown");
  return { status: "unknown", diagnosis: diagnosis("send-unknown", why.technical) };
}

/** Cancels the seat's own resting calls on one Window, by `callRef`; journaled first, like every write. */
export async function submitRestingCancel(deps: SeatLaneDeps, o: { marketId: MarketId; callRefs: readonly string[] }, onPhase?: PhaseListener): Promise<TxOutcome> {
  const record = await deps.journal.record({ kind: "cancel-orders", wallet: deps.wallet, summary: `cancel ${o.callRefs.length} resting on ${o.marketId}`, marketId: o.marketId });
  onPhase?.("submitted");
  const send = () => ledgerRequest("/resting/cancel", { method: "POST", body: { commandId: record.id, marketId: o.marketId, callRefs: [...o.callRefs] }, wire: restingCancelReplyWire });
  const reply = await send();
  if (reply.ok && reply.value.kind === "confirmed") {
    await deps.journal.markSent(record.id, reply.value.updateId);
    await deps.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: reply.value.updateId });
    return { status: "confirmed", txHash: reply.value.updateId as Signature };
  }
  if (reply.ok && reply.value.kind === "gone") {
    // Each call filled, expired or was cancelled before this: nothing was sent, and there is nothing to undo.
    await deps.journal.markFailed(record.id, "the calls had already ended");
    return refused(diagnosis("order-expired", "This call already ended: it filled, expired or was cancelled."));
  }
  if (reply.ok && reply.value.kind === "refused") {
    await deps.journal.markFailed(record.id, reply.value.diagnosis.technical);
    return refused(reply.value.diagnosis);
  }
  await deps.journal.markUnknown(record.id);
  onPhase?.("confirming");
  const settled = await pollCommand(record.id, deps);
  if (settled?.status === "landed" && settled.updateId) {
    await deps.journal.markSent(record.id, settled.updateId);
    await deps.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: settled.updateId });
    return { status: "confirmed", txHash: settled.updateId };
  }
  if (settled?.status === "failed" || settled?.status === "absent") {
    await deps.journal.markFailed(record.id, settled.diagnosis?.technical ?? settled.status);
    return refused(settled.diagnosis ?? diagnosis("send-unknown", "the cancel did not land"));
  }
  onPhase?.("unknown");
  const why = reply.ok ? ("diagnosis" in reply.value ? reply.value.diagnosis.technical : "no answer") : reply.diagnosis.technical;
  return { status: "unknown", diagnosis: diagnosis("send-unknown", why) };
}
