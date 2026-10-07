import type { Signature } from "@owarine/core/types";

/** A refused or failed desk command; `deskCode` is the desk's own refusal id when it has one (`abu-pm/<id>`). */
export class DeskSendError extends Error {
  constructor(readonly stage: "simulation" | "landed", readonly failure: unknown, readonly signature: Signature | null, readonly deskCode: number | string | null = null) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = "DeskSendError";
  }
}

/** A command whose outcome the ledger did not answer: reconcile by its command id before sending again. */
export class DeskSendUnknownError extends Error {
  constructor(readonly signature: Signature, readonly reason: "expired" | "cap") {
    super(`send ${signature} unconfirmed (${reason}); reconcile by id before sending again`);
    this.name = "DeskSendUnknownError";
  }
}
