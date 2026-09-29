import { describe, expect, it } from "vitest";
import { errorFromResponse, LedgerError } from "@agari/ledger";
import { classifyRejection, refuse } from "./rejection";
import { ReadingError } from "../errors/reading-error";
import { diagnosis } from "@agari/core/types";

/**
 * Fixtures: the real `JsCantonError` bodies a local Canton 3.5.17 sandbox returned to `scripts/drive/probe-rejections.ts`
 * (29 Sep 2026), trimmed of the `commands` echo. Contract ids shortened to keep the table readable.
 */
const QUOTE = "0081f298f8aa";
const CASH = "009ac8b29bcf";
const LEG = "00963984f1bb";
const RESOLUTION = "00b4118a1960";

const body = (status: number, code: string, category: number, cause: string, context: Record<string, string> = {}) =>
  errorFromResponse("/v2/commands/submit-and-wait-for-transaction", status, "application/json", JSON.stringify({ code, cause, errorCategory: category, context: { category: String(category), tid: "83916f9f4aca2aeaeccc848d9d126dd7", definite_answer: "false", ...context } }));

const damlFailure = (errorId: string, message: string) =>
  body(400, "DAML_FAILURE", 9, `Interpretation error: Error: User failure: ${errorId} (error category 9): ${message}`, { error_id: errorId });
const notFound = (cid: string) => body(404, "CONTRACT_NOT_FOUND", 11, `Contract could not be found with id ${cid}`);

describe("classifyRejection (research 05 §E, measured bodies)", () => {
  const accept = { step: "accept" as const, quoteCid: QUOTE, cashCids: [CASH] };

  it.each([
    ["accept after validUntil", damlFailure("stdlib.daml.com/deadline-exceeded", "Ledger time is at or past deadline 'quote-valid-until'"), accept, "order-expired"],
    ["insufficient cash", damlFailure("abu-pm/insufficient-cash", "cash does not cover stake plus fee"), accept, "insufficient-collateral"],
    ["the quote is gone (accepted, expired, withdrawn)", notFound(QUOTE), accept, "order-expired"],
    ["the cash is gone (spent by another tab)", notFound(CASH), accept, "insufficient-collateral"],
    ["some other contract is gone", notFound("00ffff"), accept, "contract-revert"],
    ["foreign cash", damlFailure("abu-pm/foreign-cash", "cash belongs to another owner or venue"), accept, "contract-revert"],
    ["off-grid", damlFailure("abu-pm/bad-grid", "ticks must be 1..999"), accept, "invalid-price"],
    ["refund before refundAfter", damlFailure("stdlib.daml.com/deadline-not-exceeded", "Ledger time is strictly before deadline 'refund-after'"), { step: "refund" as const, legCids: [LEG] }, "not-settled"],
    ["claim on a leg already claimed or settled", notFound(LEG), { step: "claim" as const, legCids: [LEG], resolutionCids: [RESOLUTION] }, "already-claimed"],
    ["claim against a resolution that is gone", notFound(RESOLUTION), { step: "claim" as const, legCids: [LEG], resolutionCids: [RESOLUTION] }, "not-settled"],
    ["package not on the participant", body(404, "PACKAGE_NAMES_NOT_FOUND", 11, "The following package names do not match upgradable packages uploaded on this participant: [abu-pm-nope]."), accept, "not-deployed"],
    ["locked contracts (contention) on a submit", body(409, "LOCAL_VERDICT_LOCKED_CONTRACTS", 2, "Locked contracts"), accept, "send-unknown"],
  ])("%s → %s", (_label, error, ctx, kind) => {
    const d = classifyRejection(error, ctx);
    expect(d.kind).toBe(kind);
    expect(d.technical).toContain("[tid 83916f9f4aca2aeaeccc848d9d126dd7]");
  });

  it("keeps the Canton error id as the diagnosis' errorName", () => {
    expect(classifyRejection(damlFailure("abu-pm/insufficient-cash", "x"), accept).errorName).toBe("abu-pm/insufficient-cash");
    expect(classifyRejection(notFound(QUOTE), accept).errorName).toBe("CONTRACT_NOT_FOUND");
  });

  it("an outcome-unknown transport failure is send-unknown on a submit and rpc-down on a read", () => {
    const timeout = new LedgerError({ kind: "timeout", path: "/v2/commands/submit-and-wait-for-transaction", message: "deadline" });
    const down = errorFromResponse("/v2/state/active-contracts-page", 503, "text/plain", "upstream down");
    expect(classifyRejection(timeout, accept).kind).toBe("send-unknown");
    expect(classifyRejection(down, accept).kind).toBe("send-unknown");
    expect(classifyRejection(down, { step: "read" }).kind).toBe("rpc-down");
    expect(classifyRejection(new LedgerError({ kind: "auth", path: "oidc:token", message: "401" }), { step: "read" }).kind).toBe("rpc-down");
  });

  it("passes refusals and readings through, and names anything else unknown", () => {
    expect(classifyRejection(refuse("reserve-cap", "cap"), accept).kind).toBe("reserve-cap");
    expect(classifyRejection(new ReadingError(diagnosis("indexer-down", "x")), accept).kind).toBe("indexer-down");
    expect(classifyRejection(new Error("boom"), accept).kind).toBe("unknown");
  });
});
