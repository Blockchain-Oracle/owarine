/**
 * The plain cash-out on Canton (L-35, C7a): sell a held side back to the venue at a firm price, through our routes.
 *
 *   exit quote   POST /api/ledger/exit-quotes {marketId, side, contractsRaw, displayedMinProceedsBase} → ops walks the
 *                ladder's bid side; below the confirmed floor it answers a requote and creates nothing
 *   journal      the intent is recorded BEFORE the accept is sent; its id is the ledger commandId (never re-sent under a new id)
 *   accept       POST /api/ledger/exit-quotes/<cid>/accept {commandId, with} → `BuyQuote_Accept` as the seat's party; the
 *                sale is booked from the transaction (proceeds from the `sale` cash, lots from the venue's new legs)
 *   confirm      only when the answer never came: GET /api/ledger/commands/<id> until landed, absent or 90 s
 *
 * The confirmed exit's `minProceedsBase` is the floor: a fresh price below it is a requote, never accepted silently. A
 * held price that lapsed before the accept landed is quoted again once and surfaced as a requote. A partial size
 * (`contractsRaw` below the holding, "sell half") sells exactly that many lots.
 */
import type { CashOutOutcome, CashOutRequest, PhaseListener } from "@agari/core/ports";
import { diagnosis, type Diagnosis, type ExitQuote, type Signature } from "@agari/core/types";
import { ledgerRequest } from "../provider/ledger-api";
import { exitAcceptReplyWire, exitQuoteReplyWire } from "../provider/ledger-wire";
import { pollCommand, type SeatLaneDeps } from "./seat-lane";

/** The firm buy-back the venue holds for this sale: the cash-out's held-price row and its ring. */
export interface HeldExit {
  exit: ExitQuote;
  validUntilMs: number;
}
export type HeldExitListener = (held: HeldExit | null) => void;

type Firm = { kind: "quote"; quoteCids: string[]; exit: ExitQuote; validUntilMs: number } | { kind: "requote"; exit: ExitQuote } | { kind: "refused"; diagnosis: Diagnosis };

const refused = (d: Diagnosis): CashOutOutcome => ({ status: "refused", diagnosis: d });

export async function requestFirmExit(req: Pick<CashOutRequest, "market" | "side" | "contractsRaw" | "displayedExit">): Promise<Firm> {
  const r = await ledgerRequest("/exit-quotes", {
    method: "POST",
    body: { marketId: req.market.marketId, side: req.side, contractsRaw: req.contractsRaw, displayedMinProceedsBase: req.displayedExit.minProceedsBase },
    wire: exitQuoteReplyWire,
  });
  return r.ok ? r.value : { kind: "refused", diagnosis: r.diagnosis };
}

function summarize(req: CashOutRequest): string {
  return `cash out ${req.contractsRaw} ${req.side} on ${req.market.marketId}`;
}

export async function submitSeatCashOut(deps: SeatLaneDeps, req: CashOutRequest, onPhase?: PhaseListener, onHeld?: HeldExitListener): Promise<CashOutOutcome> {
  if (req.wallet !== deps.wallet) return refused(diagnosis("signer-required", "this session writes for another seat"));
  if (req.route && req.route.kind !== "wallet") return refused(diagnosis("not-deployed", "the Trading Balance's cash-out is not live on this network yet"));
  onPhase?.("composing");
  const firm = await requestFirmExit(req);
  if (firm.kind === "refused") return refused(firm.diagnosis);
  if (firm.kind === "requote") return { status: "requote", exit: firm.exit };

  const record = await deps.journal.record({ kind: "order", wallet: deps.wallet, summary: summarize(req), marketId: req.market.marketId });
  onHeld?.({ exit: firm.exit, validUntilMs: firm.validUntilMs });
  onPhase?.("submitted");
  const [first, ...rest] = firm.quoteCids;
  const path = `/exit-quotes/${encodeURIComponent(first!)}/accept`;
  const send = () => ledgerRequest(path, { method: "POST", body: { commandId: record.id, with: rest }, wire: exitAcceptReplyWire });
  const reply = await send();
  const deadlineSec = Math.ceil(firm.validUntilMs / 1000);

  if (reply.ok && reply.value.kind === "confirmed") {
    await deps.journal.markSent(record.id, reply.value.updateId, deadlineSec);
    await deps.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: reply.value.updateId });
    return { status: "confirmed", booked: reply.value.booked };
  }
  if (reply.ok && reply.value.kind === "refused") {
    await deps.journal.markFailed(record.id, reply.value.diagnosis.technical);
    onHeld?.(null);
    if (reply.value.diagnosis.kind !== "order-expired") return refused(reply.value.diagnosis);
    // The held price lapsed before the accept landed: ask again and show the new price, never accept it silently.
    const again = await requestFirmExit(req);
    if (again.kind === "refused") return refused(again.diagnosis);
    return { status: "requote", exit: again.exit };
  }
  // No answer (network, 5xx, send-unknown): the accept may still land. Never re-send under a new id; ask the ledger.
  await deps.journal.markUnknown(record.id);
  onPhase?.("confirming");
  const settled = await pollCommand(record.id, deps);
  if (settled?.status === "landed") {
    // The same commandId again is idempotent: the server answers with the transaction that already landed.
    const again = await send();
    if (again.ok && again.value.kind === "confirmed") {
      await deps.journal.markSent(record.id, again.value.updateId, deadlineSec);
      await deps.journal.markConfirmed(record.id);
      onPhase?.("confirmed", { txHash: again.value.updateId });
      return { status: "confirmed", booked: again.value.booked };
    }
  }
  if (settled?.status === "failed" || settled?.status === "absent") {
    await deps.journal.markFailed(record.id, settled.diagnosis?.technical ?? settled.status);
    return refused(settled.diagnosis ?? diagnosis("send-unknown", "the sale did not land"));
  }
  const why = reply.ok ? ("diagnosis" in reply.value ? reply.value.diagnosis.technical : "no answer") : reply.diagnosis.technical;
  onPhase?.("unknown");
  return { status: "unknown", diagnosis: diagnosis("send-unknown", why), ...(settled?.updateId ? { txHash: settled.updateId as Signature } : {}) };
}
