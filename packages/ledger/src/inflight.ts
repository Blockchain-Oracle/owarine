/**
 * The wait behind `submitAndWaitForTransaction` when Canton answers SUBMISSION_ALREADY_IN_FLIGHT: an earlier
 * submission of the same change id (user, commandId, actAs) has not completed. Resending cannot help (it meets the
 * same pending change id), so the client reads that submission's completion instead: accepted → its transaction;
 * rejected → its own rejection; neither by the deadline → a `timeout` LedgerError that leads with
 * "commandId <id>: outcome unknown". Nothing is submitted from here, under this commandId or any other.
 */
import { LedgerError, errorFromCompletion, isSubmissionAlreadyInFlight } from "./errors";
import type { RequestOptions } from "./http";
import type { Completion, JsTransaction, Offset, Party, TransactionFormat } from "./types";

/** First and largest pause between completion reads (equal jitter, never below Canton's own retry hint). */
const FIRST_PAUSE_MS = 500;
const MAX_PAUSE_MS = 5_000;
const PATH = "/v2/commands/submit-and-wait-for-transaction";

export type PollOptions = Pick<RequestOptions, "timeoutMs" | "retry">;

export interface InFlightWait {
  commandId: string;
  /** The pending submission's id, from the in-flight answer's `existingSubmissionId`. */
  pendingSubmissionId: string | undefined;
  poll: number;
  waitedMs: number;
  delayMs: number;
  deadlineMs: number;
}

/** The client's reads the wait uses, each bounded by the `PollOptions` it is given. */
export interface InFlightReads {
  ledgerEnd(req: PollOptions): Promise<Offset>;
  completions(o: { parties: Party[]; beginExclusive: Offset; limit?: number }, req: PollOptions): Promise<{ completions: Completion[] }>;
  updateById(updateId: string, format: TransactionFormat, req: PollOptions): Promise<JsTransaction | undefined>;
}

export interface InFlightTiming {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  /** The client's per-request timeout: a poll read never waits longer. */
  requestTimeoutMs: number;
  /** The wait when the caller gave no deadline, from the in-flight answer. */
  inFlightWaitMs: number;
}

export interface PendingSubmission {
  commandId: string;
  actAs: Party[];
  /** The in-flight answer. */
  inFlight: LedgerError;
  /** Completions of this change id lie after it; unknown → the ledger end at the first poll. */
  floor: Offset | undefined;
  transactionFormat: TransactionFormat;
  /** The caller's overall deadline, epoch ms. */
  deadlineMs?: number | undefined;
  onInFlightWait?: ((w: InFlightWait) => void) | undefined;
}

/**
 * The outcome completion of one pending submission, scanning after `from`. Accepted: any completion of the change id
 * (commandId + actAs) with status 0 and an update id; deduplication admits only one. Rejected: the pending
 * submission's own completion (by `pendingSubmissionId` when Canton named it), never a resend's in-flight or
 * duplicate answer. `cursor` is the last completion offset read, so the next poll resumes there.
 */
export async function scanForOutcome(
  reads: InFlightReads,
  p: { commandId: string; actAs: Party[]; from: Offset; pendingSubmissionId: string | undefined },
  req: PollOptions,
): Promise<{ completion: Completion | undefined; cursor: Offset }> {
  const end = await reads.ledgerEnd(req);
  const wanted = new Set(p.actAs);
  const isOutcome = (c: Completion): boolean => {
    if (c.commandId !== p.commandId) return false;
    if (c.actAs?.length && (c.actAs.length !== wanted.size || !c.actAs.every((x) => wanted.has(x)))) return false;
    if ((c.status?.code ?? 0) === 0) return Boolean(c.updateId);
    if (p.pendingSubmissionId !== undefined) return c.submissionId === p.pendingSubmissionId;
    const msg = c.status?.message ?? "";
    return !isSubmissionAlreadyInFlight(msg) && !msg.startsWith("DUPLICATE_COMMAND");
  };
  let cursor = p.from;
  while (cursor < end) {
    const { completions: batch } = await reads.completions({ parties: p.actAs, beginExclusive: cursor, limit: 200 }, req);
    // Nothing yet is not "nothing there": a slow stream can idle out. Keep the cursor and read again next poll.
    if (batch.length === 0) break;
    const hit = batch.find(isOutcome);
    if (hit) return { completion: hit, cursor: hit.offset };
    cursor = Math.max(cursor + 1, ...batch.map((c) => c.offset));
  }
  return { completion: undefined, cursor };
}

/** Wait for a pending submission's outcome; see the module comment. */
export async function awaitPendingSubmission(
  reads: InFlightReads,
  t: InFlightTiming,
  p: PendingSubmission,
): Promise<{ transaction: JsTransaction; submissionId: string | undefined }> {
  const startedMs = t.now();
  const deadlineMs = p.deadlineMs ?? startedMs + t.inFlightWaitMs;
  const pending = p.inFlight.existingSubmissionId;
  const earlier = pending ? `the earlier submission ${pending}` : "the earlier submission (its id not given)";
  // Outcome first: logs and acceptance rows cut long messages.
  const unknown = (outcome: string, why: string, cause: unknown) =>
    new LedgerError({
      kind: "timeout",
      path: PATH,
      commandId: p.commandId,
      message: `commandId ${p.commandId}: ${outcome}. ${why}. Resolve it under the same commandId (its completion, or a resend under it), never under a new one.`,
      cause,
    });
  let cursor = p.floor;
  let landed: Completion | undefined;
  let lastError: unknown = p.inFlight;
  let pause = FIRST_PAUSE_MS;
  for (let poll = 1; ; poll++) {
    // Each read is one attempt, bounded by the time left: the loop is the retry, and the deadline is the caller's.
    const req: PollOptions = { retry: false, timeoutMs: Math.max(2_000, Math.min(t.requestTimeoutMs, deadlineMs - t.now())) };
    let rejected: Completion | undefined;
    try {
      if (!landed) {
        cursor ??= await reads.ledgerEnd(req);
        const r = await scanForOutcome(reads, { commandId: p.commandId, actAs: p.actAs, from: cursor, pendingSubmissionId: pending }, req);
        cursor = r.cursor;
        if (r.completion && (r.completion.status?.code ?? 0) !== 0) rejected = r.completion;
        else landed = r.completion;
      }
      if (landed?.updateId) {
        const tx = await reads.updateById(landed.updateId, p.transactionFormat, req);
        if (tx) return { transaction: tx, submissionId: landed.submissionId };
      }
    } catch (e) {
      if (!(e instanceof LedgerError) || !e.retryable) throw unknown("outcome unknown", `${earlier} was in flight and its completion could not be read (${e instanceof Error ? e.message : String(e)})`, e);
      lastError = e;
    }
    // The pending submission failed: surface ITS rejection. Never a resend, never a new commandId.
    if (rejected) throw errorFromCompletion(PATH, rejected);
    const remaining = deadlineMs - t.now();
    if (remaining <= 0) {
      const waited = t.now() - startedMs;
      if (landed?.updateId) {
        throw unknown("landed, transaction unread", `${earlier} completed as update ${landed.updateId}, but update-by-id returned no transaction within ${waited} ms`, lastError);
      }
      throw unknown("outcome unknown", `${earlier} was still in flight at the deadline, ${waited} ms after the in-flight answer`, lastError);
    }
    const delayMs = Math.min(remaining, Math.max(p.inFlight.retryAfterMs ?? 0, Math.floor(pause / 2 + t.random() * (pause / 2))));
    p.onInFlightWait?.({ commandId: p.commandId, pendingSubmissionId: pending, poll, waitedMs: t.now() - startedMs, delayMs, deadlineMs });
    await t.sleep(delayMs);
    pause = Math.min(MAX_PAUSE_MS, pause * 2);
  }
}
