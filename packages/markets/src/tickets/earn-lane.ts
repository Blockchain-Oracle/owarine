/**
 * Earn on the ticket reserves (C8c): a firm supply or withdraw quote from ops, priced from the reserve's live
 * statement, then the seat's own `Supply_Accept` / `Withdraw_Accept`. Shared by range, parlay and boost.
 */
import type { IntentRecord, PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis } from "@agari/core/types";
import type { SeatLaneDeps } from "../submitter/seat-lane";
import { acceptTicketQuote, asTxOutcome } from "../submitter/ticket-lane";
import { earnCall } from "./client";
import type { TicketReserveId } from "./params";

export async function earnWrite(
  deps: SeatLaneDeps,
  reserve: TicketReserveId,
  body: { op: "supply"; amountBase: bigint } | { op: "withdraw"; shares: bigint },
  kind: IntentRecord["kind"],
  onPhase?: PhaseListener,
): Promise<TxOutcome> {
  const r = await earnCall({ ...body, reserve });
  if (!r.ok) return { status: "refused", diagnosis: r.diagnosis };
  const q = r.value;
  if (q.kind === "refused") return { status: "refused", diagnosis: q.diagnosis };
  const summary = q.kind === "supply-quote" ? `supply ${q.cashIn} to ${reserve} for ${q.sharesOut} shares` : `withdraw ${q.sharesIn} ${reserve} shares for ${q.cashOut}`;
  if (q.kind !== "supply-quote" && q.kind !== "withdraw-quote") return { status: "refused", diagnosis: diagnosis("unknown", "unexpected Earn reply") };
  return asTxOutcome(await acceptTicketQuote(deps, "earn", q.quoteCid, { kind, summary }, q.validUntilMs, onPhase));
}
