/**
 * The order lane on Canton (plan §6, §8): a firm quote at click time, then the seat's accept, through our routes.
 *
 *   freshQuote   POST /api/ledger/quotes {marketId, side, stakeBase, displayedMaxCostBase} → ops prices the ladder;
 *                above the confirmed cap it answers a requote and creates nothing (RequoteError)
 *   journal      the intent is recorded BEFORE the accept is sent; its id is the ledger commandId (AD-3 on Canton:
 *                never re-sent under a new id)
 *   accept       POST /api/ledger/quotes/<cid>/accept {commandId} → submit-and-wait as the seat's party;
 *                BookedOrder comes from the created Leg, never from the request
 *   confirm      only when the answer never came: GET /api/ledger/commands/<id> until landed, absent or 90 s
 *
 * No retries anywhere in the lane; idempotency is the commandId's. A quote gone at accept time (expired, withdrawn) is
 * re-quoted once and surfaced as `requote`, never silently re-accepted at a new price.
 */
import type { IntentJournal, OrderOutcome, OrderRequest, PhaseListener, StopGate, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Address, type Diagnosis, type MarketId, type Quote, type Signature } from "@agari/core/types";
import { ledgerRequest } from "../provider/ledger-api";
import { acceptReplyWire, commandStatusWire, legsReplyWire, quoteReplyWire, type CommandStatus } from "../provider/ledger-wire";
import { OrderRefusedError, RequoteError } from "./errors";

export interface SeatLaneDeps {
  wallet: Address;
  journal: IntentJournal;
  stopGate: StopGate;
  nowMs: () => number;
  /** Poll cadence and cap for an accept whose answer never came (the reference's CONFIRM_CAP_MS). */
  pollMs?: number;
  confirmCapMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export const CONFIRM_POLL_MS = 1_500;
export const CONFIRM_CAP_MS = 90_000;

const refused = (d: Diagnosis) => ({ status: "refused" as const, diagnosis: d });
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The firm quote the venue will honour for ~20 s, or a refusal; a price above the confirmed cap throws `RequoteError`. */
export async function requestFirmQuote(request: Pick<OrderRequest, "market" | "side" | "stakeBase" | "displayedQuote">): Promise<{ quoteCid: string; quote: Quote; validUntilMs: number }> {
  const r = await ledgerRequest("/quotes", {
    method: "POST",
    body: { marketId: request.market.marketId, side: request.side, stakeBase: request.stakeBase, displayedMaxCostBase: request.displayedQuote.maxCostBase },
    wire: quoteReplyWire,
  });
  if (!r.ok) throw new OrderRefusedError(r.diagnosis);
  if (r.value.kind === "refused") throw new OrderRefusedError(r.value.diagnosis);
  if (r.value.kind === "requote") throw new RequoteError(r.value.quote);
  return r.value;
}

export async function pollCommand(journalId: string, deps: SeatLaneDeps): Promise<CommandStatus | null> {
  const sleep = deps.sleep ?? defaultSleep;
  const cap = deps.nowMs() + (deps.confirmCapMs ?? CONFIRM_CAP_MS);
  for (;;) {
    const r = await ledgerRequest(`/commands/${journalId}`, { method: "GET", wire: commandStatusWire });
    if (r.ok && r.value.status !== "pending") return r.value;
    if (deps.nowMs() >= cap) return r.ok ? r.value : null;
    await sleep(deps.pollMs ?? CONFIRM_POLL_MS);
  }
}

export async function submitSeatOrder(deps: SeatLaneDeps, request: OrderRequest, onPhase?: PhaseListener): Promise<OrderOutcome> {
  if (request.wallet !== deps.wallet) return refused(diagnosis("signer-required", "this session writes for another seat"));
  const reservation = await deps.stopGate.checkAndReserve(deps.wallet, request.displayedQuote.maxCostBase);
  if (!reservation.ok) return refused(diagnosis("daily-stop", reservation.reason));
  const release = () => deps.stopGate.reconcile(reservation.reservationId, 0n);

  let firm: Awaited<ReturnType<typeof requestFirmQuote>>;
  try {
    firm = await requestFirmQuote(request);
  } catch (error) {
    await release();
    if (error instanceof RequoteError) return { status: "requote", quote: error.quote };
    if (error instanceof OrderRefusedError) return refused(error.diagnosis);
    throw error;
  }

  const record = await deps.journal.record({ kind: "order", wallet: deps.wallet, summary: `${request.side} ${request.stakeBase} on ${request.market.marketId}`, marketId: request.market.marketId });
  onPhase?.("submitted", { held: { quote: firm.quote, validUntilMs: firm.validUntilMs } });
  const reply = await ledgerRequest(`/quotes/${encodeURIComponent(firm.quoteCid)}/accept`, { method: "POST", body: { commandId: record.id }, wire: acceptReplyWire });
  const deadlineSec = Math.ceil(firm.validUntilMs / 1000);

  if (reply.ok && reply.value.kind === "confirmed") {
    const { booked, updateId } = reply.value;
    await deps.journal.markSent(record.id, updateId, deadlineSec);
    await deps.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: updateId });
    await deps.stopGate.reconcile(reservation.reservationId, booked.costBase);
    return { status: "confirmed", booked };
  }
  if (reply.ok && reply.value.kind === "refused") {
    await deps.journal.markFailed(record.id, reply.value.diagnosis.technical);
    await release();
    if (reply.value.diagnosis.kind !== "order-expired") return refused(reply.value.diagnosis);
    // The held price lapsed before the accept landed: ask again and show the new price (research 05 §E).
    try {
      const again = await requestFirmQuote(request);
      return { status: "requote", quote: again.quote };
    } catch (error) {
      if (error instanceof RequoteError) return { status: "requote", quote: error.quote };
      if (error instanceof OrderRefusedError) return refused(error.diagnosis);
      throw error;
    }
  }
  if (reply.ok && reply.value.kind === "requote") {
    await deps.journal.markFailed(record.id, "requoted at accept");
    await release();
    return { status: "requote", quote: reply.value.quote };
  }
  // No answer (network, 5xx, send-unknown): the accept may still land. Never re-send under a new id; ask the ledger.
  await deps.journal.markUnknown(record.id);
  onPhase?.("confirming");
  const settled = await pollCommand(record.id, deps);
  if (settled?.status === "landed") {
    // The same commandId again is idempotent: the server answers with the transaction that already landed.
    const again = await ledgerRequest(`/quotes/${encodeURIComponent(firm.quoteCid)}/accept`, { method: "POST", body: { commandId: record.id }, wire: acceptReplyWire });
    if (again.ok && again.value.kind === "confirmed") {
      await deps.journal.markSent(record.id, again.value.updateId, deadlineSec);
      await deps.journal.markConfirmed(record.id);
      onPhase?.("confirmed", { txHash: again.value.updateId });
      await deps.stopGate.reconcile(reservation.reservationId, again.value.booked.costBase);
      return { status: "confirmed", booked: again.value.booked };
    }
  }
  if (settled?.status === "failed" || settled?.status === "absent") {
    await deps.journal.markFailed(record.id, settled.diagnosis?.technical ?? settled.status);
    await release();
    return refused(settled.diagnosis ?? diagnosis("send-unknown", "the call did not land"));
  }
  const why = reply.ok ? ("diagnosis" in reply.value ? reply.value.diagnosis : diagnosis("send-unknown", "no answer")) : reply.diagnosis;
  onPhase?.("unknown");
  return { status: "unknown", diagnosis: diagnosis("send-unknown", why.technical) };
}

/**
 * One tap exits a Window's legs: a claim against its resolution, or, when there is none past `refundAfter`, the stale
 * refund (`mode: "claim"` falls back to it; `"refund"` asks for it alone). Journaled first, like every write.
 */
export async function submitLegExit(deps: SeatLaneDeps, o: { marketId: MarketId; mode: "claim" | "refund" }, onPhase?: PhaseListener): Promise<TxOutcome> {
  const record = await deps.journal.record({ kind: "redeem", wallet: deps.wallet, summary: `${o.mode} on ${o.marketId}`, marketId: o.marketId });
  onPhase?.("submitted");
  const path = o.mode === "claim" ? "/legs/claim" : "/legs/refund-stale";
  const reply = await ledgerRequest(path, { method: "POST", body: { commandId: record.id, marketId: o.marketId }, wire: legsReplyWire });
  if (reply.ok && reply.value.kind === "confirmed") {
    await deps.journal.markSent(record.id, reply.value.updateId);
    await deps.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: reply.value.updateId });
    return { status: "confirmed", txHash: reply.value.updateId as Signature };
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
    return refused(settled.diagnosis ?? diagnosis("send-unknown", "the exit did not land"));
  }
  onPhase?.("unknown");
  const why = reply.ok ? ("diagnosis" in reply.value ? reply.value.diagnosis.technical : "no answer") : reply.diagnosis.technical;
  return { status: "unknown", diagnosis: diagnosis("send-unknown", why) };
}

/** Recovery's question about an open intent: the server's journal (by the same id) and the ledger's completions. */
export async function commandVerdict(journalId: string): Promise<"confirmed" | "reverted" | "absent" | "unknown"> {
  const r = await ledgerRequest(`/commands/${journalId}`, { method: "GET", wire: commandStatusWire });
  if (!r.ok) return r.status === 404 ? "absent" : "unknown";
  if (r.value.status === "landed") return "confirmed";
  if (r.value.status === "failed") return "reverted";
  if (r.value.status === "absent") return "absent";
  return "unknown";
}
