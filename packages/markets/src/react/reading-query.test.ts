import { diagnosis } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { ReadingError } from "../errors/reading-error";
import { isInfrastructureFailure } from "./useReadingQuery";

/**
 * C4f: a reading's error arm is classified by its own kind. It went through `diagnose`, which reads any object that is
 * not a thrown `ReadingError` as "unknown" (an outage), so `/me/balance` answering 401 `signer-required` was thrown and
 * TanStack kept the seat's last balance on screen: a joined browser showed 1,000.00 after the holder reset the seat.
 */
describe("isInfrastructureFailure", () => {
  it("reads a domain answer in a reading's error arm as an answer, not an outage", () => {
    expect(isInfrastructureFailure(diagnosis("signer-required", "this seat's lease has ended; take a seat again"))).toBe(false);
    expect(isInfrastructureFailure(diagnosis("not-deployed", "no reserve on this network"))).toBe(false);
  });

  it("still retries an outage, in the error arm or thrown", () => {
    expect(isInfrastructureFailure(diagnosis("rpc-down", "ledger routes unreachable"))).toBe(true);
    expect(isInfrastructureFailure(diagnosis("indexer-down", "indexer 503"))).toBe(true);
    expect(isInfrastructureFailure(new ReadingError(diagnosis("indexer-down", "indexer 503")))).toBe(true);
    expect(isInfrastructureFailure(new Error("fetch failed"))).toBe(true);
  });

  it("does not retry a thrown domain refusal", () => {
    expect(isInfrastructureFailure(new ReadingError(diagnosis("signer-required", "take a seat first")))).toBe(false);
  });
});
