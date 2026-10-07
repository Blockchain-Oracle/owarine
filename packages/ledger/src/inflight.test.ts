import { describe, expect, it } from "vitest";
import { noAuth } from "./auth";
import { createLedgerClient, type InFlightWait } from "./client";
import { LedgerError, errorFromResponse, isSubmissionAlreadyInFlight } from "./errors";
import type { Completion } from "./types";

/**
 * SUBMISSION_ALREADY_IN_FLIGHT as Canton 3.5.17 answers it on a submit: HTTP 409, id and category 2
 * (ContentionOnSharedResources) and the context keys read from the 3.5.17 jar
 * (`ConsistencyErrors.SubmissionAlreadyInFlight`, `TransactionProcessor.SubmissionErrors.SubmissionAlreadyInFlight`);
 * the cause and trace id are the C2z rehearsal's (docs/evidence/c2z-r1-rehearsal.md). Party ids shortened.
 */
const inFlightBody = (existing: string | undefined) => ({
  code: "SUBMISSION_ALREADY_IN_FLIGHT",
  cause: "The submission is already in-flight",
  correlationId: null,
  traceId: "31febb775b468fb6e47b7f5f5af0c0e5",
  context: {
    participant: "sandbox",
    changeId: "ChangeId(owarine-ops,bootstrap:desk:devnet-1,Set(venue::1220))",
    ...(existing === undefined ? {} : { existingSubmissionId: `Some(${existing})` }),
    existingSubmissionSynchronizerId: "sandbox::1220aa",
    category: "2",
    tid: "31febb775b468fb6e47b7f5f5af0c0e5",
    definite_answer: "false",
  },
  resources: [],
  errorCategory: 2,
  grpcCodeValue: 10,
  retryInfo: "1 second",
  definiteAnswer: null,
});

const CID = "bootstrap:desk:devnet-1";
const VENUE = "venue::1220";
const TX = (updateId: string) => ({ updateId, commandId: CID, effectiveAt: "", events: [], offset: 30, synchronizerId: "s", recordTime: "" });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const completion = (c: Partial<Completion> & { offset: number }): Completion => ({ commandId: CID, userId: "owarine-ops", actAs: [VENUE], ...c });

/**
 * A fake JSON Ledger API with a fake clock. `submit` scripts the n-th submit (1-based) from its body; completions are
 * visible once the ledger end has reached their offset; `at(ms, fn)` changes the ledger when the clock passes `ms`.
 */
function fakeLedger(o: { submit: (n: number, body: { commands: { commandId: string; submissionId: string } }) => Response | Promise<Response> }) {
  let clock = 1_000_000;
  let end = 20;
  const published: Completion[] = [];
  const updates = new Map<string, unknown>();
  const events: { atMs: number; fn: () => void }[] = [];
  const submits: { commandId: string; submissionId: string; atMs: number }[] = [];
  const completionReads: number[] = [];
  const fire = () => {
    for (const e of events.splice(0).sort((a, b) => a.atMs - b.atMs)) {
      if (e.atMs <= clock) e.fn();
      else events.push(e);
    }
  };
  const fetch = async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    fire();
    if (path.endsWith("/submit-and-wait-for-transaction")) {
      const body = JSON.parse(String(init.body)) as { commands: { commandId: string; submissionId: string } };
      submits.push({ commandId: body.commands.commandId, submissionId: body.commands.submissionId, atMs: clock });
      return o.submit(submits.length, body);
    }
    if (path.endsWith("/state/ledger-end")) return json(200, { offset: end });
    if (path.endsWith("/commands/completions")) {
      const b = JSON.parse(String(init.body)) as { beginExclusive: number };
      completionReads.push(b.beginExclusive);
      const rows = published.filter((c) => c.offset > b.beginExclusive && c.offset <= end).sort((a, b2) => a.offset - b2.offset);
      return json(200, rows.map((value) => ({ completionResponse: { Completion: { value } } })));
    }
    if (path.endsWith("/updates/update-by-id")) {
      const b = JSON.parse(String(init.body)) as { updateId: string };
      const tx = updates.get(b.updateId);
      return tx ? json(200, { update: { Transaction: { value: tx } } }) : json(404, { code: "UPDATE_NOT_FOUND", cause: "no", errorCategory: 11, context: {} });
    }
    return json(404, {});
  };
  const waits: InFlightWait[] = [];
  const client = (cfg: { inFlightWaitMs?: number } = {}) =>
    createLedgerClient(
      { baseUrl: "http://ledger.test/", auth: noAuth(), userId: "owarine-ops", maxAttempts: 4, ...cfg },
      {
        fetch: fetch as unknown as typeof globalThis.fetch,
        sleep: async (ms) => {
          clock += ms;
          fire();
        },
        random: () => 0.5,
        now: () => clock,
      },
    );
  return {
    client,
    submits,
    completionReads,
    waits,
    now: () => clock,
    /** Publish `c` (and its transaction, when accepted) once the clock passes `atMs`. */
    at(atMs: number, c: Completion) {
      events.push({
        atMs,
        fn: () => {
          end = Math.max(end, c.offset);
          published.push(c);
          if (c.updateId) updates.set(c.updateId, TX(c.updateId));
        },
      });
    },
  };
}

const onlyThisCommandId = (submits: { commandId: string }[]) => expect(new Set(submits.map((s) => s.commandId))).toEqual(new Set([CID]));

describe("SUBMISSION_ALREADY_IN_FLIGHT: error mapping", () => {
  it("is its own kind: not retried by the transport, send-unknown, with the pending submissionId", () => {
    const e = errorFromResponse("/v2/commands/submit-and-wait-for-transaction", 409, "application/json", JSON.stringify(inFlightBody("s-1")));
    expect([e.kind, e.code, e.errorCategory, e.status, e.retryable, e.diagnosis]).toEqual(["in-flight", "SUBMISSION_ALREADY_IN_FLIGHT", 2, 409, false, "send-unknown"]);
    expect(e.existingSubmissionId).toBe("s-1");
    expect(e.retryAfterMs).toBe(1000);
    // A proxy that passes the gRPC status through as text, and the completion-status form.
    const text = errorFromResponse("/p", 409, "text/plain", "ABORTED: SUBMISSION_ALREADY_IN_FLIGHT(2,31febb77): The submission is already in-flight");
    expect([text.kind, text.retryable]).toEqual(["in-flight", false]);
    expect(isSubmissionAlreadyInFlight("SUBMISSION_ALREADY_IN_FLIGHT(2,31febb77): The submission is already in-flight")).toBe(true);
    expect(isSubmissionAlreadyInFlight("REQUEST_ALREADY_IN_FLIGHT(2,1): another request")).toBe(false);
  });
});

describe("submitAndWaitForTransaction: SUBMISSION_ALREADY_IN_FLIGHT", () => {
  it("waits for the pending submission's completion and returns its transaction", async () => {
    const f = fakeLedger({
      submit: (n, b) => {
        // The first attempt's answer never comes (a starved node); the resend meets it in flight.
        if (n === 1) {
          const t0 = f.now();
          f.at(t0 + 7_000, completion({ offset: 21, submissionId: "resend", status: { code: 10, message: "SUBMISSION_ALREADY_IN_FLIGHT(2,31febb77): The submission is already in-flight" } }));
          f.at(t0 + 7_000, completion({ offset: 24, submissionId: b.commands.submissionId, status: { code: 0, message: "" }, updateId: "u-first" }));
          return new Response("upstream timeout", { status: 504 });
        }
        return json(409, inFlightBody(f.submits[0]!.submissionId));
      },
    });
    const c = f.client();
    const r = await c.submitAndWaitForTransaction({ actAs: [VENUE], commandId: CID, commands: [], onInFlightWait: (w) => f.waits.push(w) });

    expect(r).toMatchObject({ recovered: true, recoveredFrom: "in-flight", attempts: 2, submissionId: f.submits[0]!.submissionId, transaction: { updateId: "u-first" } });
    expect(f.submits).toHaveLength(2); // nothing re-sent while waiting
    onlyThisCommandId(f.submits);
    expect(new Set(f.submits.map((s) => s.submissionId)).size).toBe(2);
    // Completions were searched from the ledger end pinned before the resend, never from before it.
    expect(Math.min(...f.completionReads)).toBe(20);
    expect(f.waits.length).toBeGreaterThan(0);
    expect(f.waits.every((w) => w.commandId === CID && w.pendingSubmissionId === f.submits[0]!.submissionId && w.delayMs >= 1000)).toBe(true);
  });

  it("surfaces the pending submission's own rejection, not the resend's, and never resubmits", async () => {
    const f = fakeLedger({
      submit: () => {
        const t0 = f.now();
        // The pending submission came from an earlier call (a re-run): the first attempt of THIS call meets it.
        f.at(t0 + 3_000, completion({ offset: 22, submissionId: "someone-else", status: { code: 9, message: "DAML_FAILURE(9,aa): unrelated earlier failure" } }));
        f.at(t0 + 9_000, completion({
          offset: 23,
          submissionId: "earlier-1",
          status: { code: 10, message: "MEDIATOR_SAYS_TX_TIMED_OUT(2,1a2b3c4d): Rejected transaction as the mediator did not receive sufficient confirmations within the expected timeframe." },
        }));
        return json(409, inFlightBody("earlier-1"));
      },
    });
    const err = await f.client().submitAndWaitForTransaction({ actAs: [VENUE], commandId: CID, commands: [] }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(LedgerError);
    const e = err as LedgerError;
    expect([e.kind, e.code, e.errorCategory, e.definiteAnswer, e.commandId]).toEqual(["contention", "MEDIATOR_SAYS_TX_TIMED_OUT", 2, true, CID]);
    expect(e.message).toContain("earlier-1");
    expect(f.submits).toHaveLength(1);
    onlyThisCommandId(f.submits);
  });

  it("without a pending submissionId, skips resends' in-flight answers and surfaces the real rejection", async () => {
    const f = fakeLedger({
      submit: () => {
        const t0 = f.now();
        f.at(t0 + 2_000, completion({ offset: 21, submissionId: "x", status: { code: 10, message: "SUBMISSION_ALREADY_IN_FLIGHT(2,31febb77): The submission is already in-flight" } }));
        f.at(t0 + 4_000, completion({ offset: 22, submissionId: "y", status: { code: 9, message: "DAML_FAILURE(9,bb): Interpretation error: abu-pm/quorum-not-met" } }));
        return json(409, inFlightBody(undefined));
      },
    });
    const e = (await f.client().submitAndWaitForTransaction({ actAs: [VENUE], commandId: CID, commands: [] }).catch((x: unknown) => x)) as LedgerError;
    expect([e.kind, e.code, e.commandId]).toEqual(["rejected", "DAML_FAILURE", CID]);
    expect(e.message).toContain("abu-pm/quorum-not-met");
    expect(f.submits).toHaveLength(1);
  });

  it("past the caller's deadline: a timeout that names the commandId and says the outcome is unknown", async () => {
    const f = fakeLedger({ submit: () => json(409, inFlightBody("stuck-1")) });
    const deadlineMs = f.now() + 20_000;
    const e = (await f.client().submitAndWaitForTransaction({ actAs: [VENUE], commandId: CID, commands: [], deadlineMs }).catch((x: unknown) => x)) as LedgerError;

    expect(e).toBeInstanceOf(LedgerError);
    expect([e.kind, e.diagnosis, e.commandId]).toEqual(["timeout", "send-unknown", CID]);
    expect(e.message).toContain(`commandId ${CID}`);
    expect(e.message).toMatch(new RegExp(`^commandId ${CID}: outcome unknown\\.`)); // first, so a cut log line keeps it
    expect(e.message).toContain("stuck-1");
    expect(f.now()).toBeGreaterThanOrEqual(deadlineMs);
    expect(f.now()).toBeLessThan(deadlineMs + 1_000); // the last pause is clamped to the deadline
    expect(f.submits).toHaveLength(1);
    onlyThisCommandId(f.submits);
  });

  it("without a caller deadline, waits the client's inFlightWaitMs from the in-flight answer", async () => {
    const f = fakeLedger({ submit: () => json(409, inFlightBody("stuck-2")) });
    const start = f.now();
    const e = (await f.client({ inFlightWaitMs: 45_000 }).submitAndWaitForTransaction({ actAs: [VENUE], commandId: CID, commands: [] }).catch((x: unknown) => x)) as LedgerError;
    expect(e.kind).toBe("timeout");
    expect(f.now() - start).toBeGreaterThanOrEqual(45_000);
    expect(f.now() - start).toBeLessThan(46_000);
    expect(f.submits).toHaveLength(1);
  });

  it("recoverInFlight: false throws the in-flight answer at once, without hammering the participant", async () => {
    const f = fakeLedger({ submit: () => json(409, inFlightBody("p")) });
    const e = (await f.client().submitAndWaitForTransaction({ actAs: [VENUE], commandId: CID, commands: [], recoverInFlight: false }).catch((x: unknown) => x)) as LedgerError;
    expect([e.kind, e.code]).toEqual(["in-flight", "SUBMISSION_ALREADY_IN_FLIGHT"]);
    expect(f.submits).toHaveLength(1);
    expect(f.completionReads).toHaveLength(0);
  });
});
