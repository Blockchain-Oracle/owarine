/**
 * The ticket lane on Canton (C8c), the order lane's shape (`seat-lane.ts`) for Range/Moonshot, Parlay, Boost/Short
 * and Earn:
 *
 *   firm quote   POST /api/ledger/tickets/<product> {op: issue | exit | supply | withdraw, …} → ops prices and issues a
 *                quote to the seat's party, or answers a requote above the confirmed cap and creates nothing
 *   journal      the intent is recorded BEFORE the accept; its id is the ledger commandId (never re-sent under another)
 *   accept       POST /api/ledger/tickets/<product>/accept {commandId, quoteCid} → submit-and-wait as the seat's party
 *   confirm      only when no answer came: GET /api/ledger/commands/<id> until landed, absent or 90 s
 *
 * Claims and stale refunds are one journaled call each (`/claim`, `/refund-stale`). No retries anywhere.
 */
import type { IntentRecord, PhaseListener, TxOutcome } from "@owarine/core/ports";
import { diagnosis, type Diagnosis, type Signature } from "@owarine/core/types";
import { ledgerRequest } from "../provider/ledger-api";
import { ticketWriteReplyWire, type TicketProduct, type TicketWriteReply } from "../provider/ticket-wire";
import { forgetTicketReads } from "../tickets/client";
import { pollCommand, type SeatLaneDeps } from "./seat-lane";

export type TicketConfirmed = { status: "confirmed"; txHash: Signature; ticketCid: string | null; paidBase: bigint };
export type TicketWrite = TicketConfirmed | { status: "refused"; diagnosis: Diagnosis } | { status: "unknown"; diagnosis: Diagnosis };

const refused = (d: Diagnosis) => ({ status: "refused" as const, diagnosis: d });

/**
 * One journaled seat write to a ticket route and its outcome. An answer that never came is asked of the ledger by
 * the same id; a landed one is asked for again under that id, which the server answers with the original transaction.
 */
async function journaledWrite(
  deps: SeatLaneDeps,
  entry: Pick<IntentRecord, "kind" | "summary"> & Partial<Pick<IntentRecord, "marketId">>,
  path: string,
  body: Record<string, unknown>,
  onPhase?: PhaseListener,
  deadlineSec?: number,
): Promise<TicketWrite> {
  const record = await deps.journal.record({ ...entry, wallet: deps.wallet });
  onPhase?.("submitted");
  const send = () => ledgerRequest(path, { method: "POST", body: { ...body, commandId: record.id }, wire: ticketWriteReplyWire });
  const done = async (r: Extract<TicketWriteReply, { kind: "confirmed" }>): Promise<TicketConfirmed> => {
    await deps.journal.markSent(record.id, r.updateId, deadlineSec);
    await deps.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: r.updateId });
    return { status: "confirmed", txHash: r.updateId, ticketCid: r.ticketCid, paidBase: r.paidBase };
  };
  try {
    const reply = await send();
    if (reply.ok && reply.value.kind === "confirmed") return await done(reply.value);
    if (reply.ok && reply.value.kind === "refused") {
      await deps.journal.markFailed(record.id, reply.value.diagnosis.technical);
      return refused(reply.value.diagnosis);
    }
    await deps.journal.markUnknown(record.id);
    onPhase?.("confirming");
    const settled = await pollCommand(record.id, deps);
    if (settled?.status === "landed") {
      const again = await send();
      if (again.ok && again.value.kind === "confirmed") return await done(again.value);
    }
    if (settled?.status === "failed" || settled?.status === "absent") {
      await deps.journal.markFailed(record.id, settled.diagnosis?.technical ?? settled.status);
      return refused(settled.diagnosis ?? diagnosis("send-unknown", "the write did not land"));
    }
    onPhase?.("unknown");
    const why = reply.ok ? ("diagnosis" in reply.value ? reply.value.diagnosis.technical : "no answer") : reply.diagnosis.technical;
    return { status: "unknown", diagnosis: diagnosis("send-unknown", why) };
  } finally {
    forgetTicketReads();
  }
}

/** Accept a firm quote the venue issued this seat (a ticket, a boost exit, a liquidity quote). */
export function acceptTicketQuote(deps: SeatLaneDeps, product: TicketProduct, quoteCid: string, entry: Pick<IntentRecord, "kind" | "summary"> & Partial<Pick<IntentRecord, "marketId">>, validUntilMs: number, onPhase?: PhaseListener): Promise<TicketWrite> {
  return journaledWrite(deps, entry, `/tickets/${product}/accept`, { quoteCid }, onPhase, Math.ceil(validUntilMs / 1000));
}

/** The owner's own settle (`claim`) or stale refund of one ticket. */
export function exitTicket(deps: SeatLaneDeps, product: Exclude<TicketProduct, "earn">, mode: "claim" | "refund", ticketCid: string, entry: Pick<IntentRecord, "kind" | "summary"> & Partial<Pick<IntentRecord, "marketId">>, onPhase?: PhaseListener): Promise<TicketWrite> {
  return journaledWrite(deps, entry, `/tickets/${product}/${mode === "claim" ? "claim" : "refund-stale"}`, { ticketCid }, onPhase);
}

/** A ticket write's outcome in the port's `TxOutcome` terms. */
export function asTxOutcome(w: TicketWrite): TxOutcome {
  return w.status === "confirmed" ? { status: "confirmed", txHash: w.txHash } : w;
}
