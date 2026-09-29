/**
 * Canton rejections onto the existing 28 `Diagnosis` kinds (research 05 §E; none added). Classification reads the
 * structured `JsCantonError` first: the `error_id` a `failWithStatus` or `DA.Assert` deadline carries in its context,
 * then the Canton code, then which contract a `CONTRACT_NOT_FOUND` names (its id is in `cause`), measured on a local
 * 3.5.17 sandbox (`scripts/drive/probe-rejections.ts`). Noders may return only a trace id; the trace id is always kept
 * in `technical` so a report can be matched to the participant's log.
 */
import { diagnosis, type Diagnosis, type DiagnosisKind } from "@agari/core/types";
import { LedgerError } from "@agari/ledger";
import { ReadingError } from "../errors/reading-error";

/** Which seat action failed: a submit's outcome can be unknown, a read's never is. */
export type SeatStep = "accept" | "sell" | "claim" | "refund" | "read" | "quote";

export interface RejectionContext {
  step: SeatStep;
  quoteCid?: string;
  /** A sale's `BuyQuote`s (C7a exit): one gone means the price lapsed or was superseded. */
  buyQuoteCids?: readonly string[];
  cashCids?: readonly string[];
  legCids?: readonly string[];
  resolutionCids?: readonly string[];
}

/** `failWithStatus` ids from `PM.Types.refuse` (prefix `abu-pm/`) and `DA.Assert`'s deadline ids. */
const BY_ERROR_ID: Record<string, DiagnosisKind> = {
  "abu-pm/insufficient-cash": "insufficient-collateral",
  "abu-pm/foreign-cash": "contract-revert",
  "abu-pm/duplicate-cash": "contract-revert",
  "abu-pm/wrong-venue": "contract-revert",
  "abu-pm/wrong-resolution": "contract-revert",
  "abu-pm/leg-mismatch": "contract-revert",
  "abu-pm/bad-grid": "invalid-price",
  "abu-pm/bad-amount": "invalid-price",
  "abu-pm/shard-too-small": "no-liquidity",
  "abu-pm/bad-shard": "contract-revert",
  "abu-pm/bad-lots": "invalid-price",
  // C8c: the ticket reserves' caps and a ticket's own order.
  "abu-pm/over-ticket-cap": "reserve-cap",
  "abu-pm/over-expiry-cap": "reserve-cap",
  "abu-pm/over-exposure": "reserve-cap",
  "abu-pm/wrong-product": "contract-revert",
  "abu-pm/position-mismatch": "order-expired",
  "abu-pm/share-mismatch": "order-expired",
  "abu-pm/ticket-done": "already-claimed",
  "abu-pm/wrong-leg": "not-settled",
  "abu-pm/leg-out-of-order": "not-settled",
  "abu-pm/bad-terms": "invalid-price",
  "abu-pm/bad-band": "invalid-price",
  "abu-pm/bad-legs": "invalid-price",
  "abu-pm/duplicate-leg": "invalid-price",
  "abu-pm/leg-locked": "market-not-trading",
  "abu-pm/below-one-share": "below-min-quantity",
  "abu-pm/below-one-unit": "below-min-quantity",
  // C8f: grants (PM.Grant's caps, K-024's order), the grant desk, the strategy registry and the desk mandate.
  "abu-pm/over-price-cap": "grant-refused",
  "abu-pm/over-stake-cap": "grant-refused",
  "abu-pm/over-daily-cap": "grant-refused",
  "abu-pm/over-position-cap": "grant-refused",
  "abu-pm/insufficient-budget": "grant-refused",
  "abu-pm/before-day-zero": "grant-refused",
  "abu-pm/stale-day": "grant-refused",
  "abu-pm/no-fill": "requote",
  "abu-pm/wrong-quote": "contract-revert",
  "abu-pm/not-grant-owner": "grant-refused",
  "abu-pm/bad-budget": "invalid-price",
  "abu-pm/wrong-runner": "grant-refused",
  "abu-pm/caps-outside-envelope": "grant-refused",
  "abu-pm/fee-above-max": "requote",
  "abu-pm/version-changed": "requote",
  "abu-pm/strategy-inactive": "market-not-trading",
  "abu-pm/already-subscribed": "grant-refused",
  "abu-pm/not-subscribed": "already-claimed",
  "abu-pm/no-fee-due": "contract-revert",
  "abu-pm/spec-hash-mismatch": "contract-revert",
  "abu-pm/bad-envelope": "invalid-price",
  "abu-pm/bad-fee": "invalid-price",
  "abu-pm/bad-runner": "grant-refused",
  "abu-pm/wrong-strategy": "contract-revert",
  "abu-pm/empty-payout": "contract-revert",
  "abu-pm/duplicate-fee": "contract-revert",
  "abu-pm/foreign-fee": "contract-revert",
  "abu-pm/not-operator": "grant-refused",
  "abu-pm/not-owner-or-operator": "grant-refused",
  "abu-pm/desk-paused": "daily-stop",
  "abu-pm/shadow-mode": "daily-stop",
  "abu-pm/not-allowed": "grant-refused",
  "abu-pm/premium-too-high": "outside-band",
  "abu-pm/below-floor": "outside-band",
  "abu-pm/not-held": "contract-revert",
  "abu-pm/head-mismatch": "contract-revert",
  "abu-pm/zero-hash": "contract-revert",
  "abu-pm/reference-quorum": "indexer-down",
  "abu-pm/reference-stale": "indexer-down",
  "abu-pm/wrong-reference": "contract-revert",
  "abu-pm/unknown-attestor": "contract-revert",
  "abu-pm/duplicate-mark": "contract-revert",
  "abu-pm/bad-config": "invalid-price",
  "abu-pm/bad-operator": "grant-refused",
  "abu-pm/grant-expiry": "grant-refused",
};

const NOT_DEPLOYED_CODES = new Set(["PACKAGE_NAMES_NOT_FOUND", "PACKAGE_NOT_FOUND", "TEMPLATES_OR_INTERFACES_NOT_FOUND", "NO_TEMPLATES_OR_INTERFACES_FOR_PACKAGE_NAME"]);
const CONTENTION_CODES = new Set(["LOCAL_VERDICT_LOCKED_CONTRACTS", "LOCAL_VERDICT_LOCKED_KEYS", "NOT_SEQUENCED_TIMEOUT", "PARTICIPANT_BACKPRESSURE"]);

/** The contract id a `CONTRACT_NOT_FOUND` / inactive-contracts rejection names, when it names one. */
export function missingContractId(error: LedgerError): string | null {
  const fromCause = /Contract could not be found with id ([0-9a-f]+)/.exec(error.canton?.cause ?? error.message)?.[1];
  if (fromCause) return fromCause;
  const inactive = /([0-9a-f]{64,})/.exec(error.context.contract_id ?? error.context.inactive_contracts ?? "")?.[1];
  return inactive ?? null;
}

const isSubmit = (step: SeatStep) => step === "accept" || step === "sell" || step === "claim" || step === "refund";

function technical(error: LedgerError): string {
  const trace = error.traceId ? ` [tid ${error.traceId}]` : "";
  return `${error.message}${trace}`;
}

function contractGone(error: LedgerError, ctx: RejectionContext): DiagnosisKind {
  const cid = missingContractId(error);
  if (ctx.step === "accept") {
    if (cid !== null && cid === ctx.quoteCid) return "order-expired";
    if (cid !== null && ctx.cashCids?.includes(cid)) return "insufficient-collateral";
    return cid === null ? "order-expired" : "contract-revert";
  }
  if (ctx.step === "sell") {
    // The buy-back is gone (swept, superseded) or no id was named: the held price lapsed. A leg gone first was settled or claimed.
    if (cid === null || ctx.buyQuoteCids?.includes(cid)) return "order-expired";
    return ctx.legCids?.includes(cid) ? "already-claimed" : "contract-revert";
  }
  if (ctx.step === "claim" || ctx.step === "refund") {
    if (cid !== null && ctx.resolutionCids?.includes(cid)) return "not-settled";
    return "already-claimed";
  }
  return "contract-revert";
}

function fromLedger(error: LedgerError, ctx: RejectionContext): Diagnosis {
  const extra = { errorName: error.context.error_id ?? error.code ?? error.kind };
  const d = (kind: DiagnosisKind) => diagnosis(kind, technical(error), extra);
  if (error.code && NOT_DEPLOYED_CODES.has(error.code)) return d("not-deployed");
  if (error.code && CONTENTION_CODES.has(error.code)) return d(isSubmit(ctx.step) ? "send-unknown" : "rpc-down");
  const errorId = error.context.error_id;
  if (errorId) {
    if (errorId === "stdlib.daml.com/deadline-exceeded") return d(ctx.step === "accept" || ctx.step === "sell" ? "order-expired" : "not-settled");
    if (errorId === "stdlib.daml.com/deadline-not-exceeded") return d("not-settled");
    const kind = BY_ERROR_ID[errorId];
    if (kind) return d(kind);
  }
  switch (error.kind) {
    case "not-found":
      return d(contractGone(error, ctx));
    case "rejected":
      return /INACTIVE|CONTRACT_NOT_FOUND/.test(error.code ?? "") ? d(contractGone(error, ctx)) : d("contract-revert");
    case "network":
    case "unavailable":
    case "timeout":
    case "contention":
    case "duplicate":
      // A submit whose answer never came may still land: never `rpc-down`, which would invite a resend under a new id.
      return d(isSubmit(ctx.step) ? "send-unknown" : "rpc-down");
    case "auth":
    case "permission":
    case "too-large":
      return d("rpc-down");
    default:
      return d("unknown");
  }
}

/** Anything a seat route can throw, as the diagnosis the client renders. */
export function classifyRejection(error: unknown, ctx: RejectionContext): Diagnosis {
  if (error instanceof ReadingError) return error.diagnosis;
  if (error instanceof LedgerError) return fromLedger(error, ctx);
  if (error instanceof SeatRefusal) return error.diagnosis;
  return diagnosis("unknown", error instanceof Error ? error.message : String(error));
}

/** A refusal decided before anything is submitted (no cash, nothing to claim): nothing was sent. */
export class SeatRefusal extends Error {
  constructor(readonly diagnosis: Diagnosis) {
    super(diagnosis.technical);
    this.name = "SeatRefusal";
  }
}

export const refuse = (kind: DiagnosisKind, technical: string): SeatRefusal => new SeatRefusal(diagnosis(kind, technical));
