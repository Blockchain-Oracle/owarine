import { describe, expect, it } from "vitest";
import { absoluteLedgerPath } from "./markets-env";

describe("the web's public routes as ops reaches them", () => {
  it("takes the indexer's origin for a relative or absent ledger path (the room's post-reveal snapshot, C9c)", () => {
    expect(absoluteLedgerPath(undefined, "http://localhost:3170/api/index")).toBe("http://localhost:3170/api/ledger");
    expect(absoluteLedgerPath("/api/ledger", "https://app.example/api/index")).toBe("https://app.example/api/ledger");
  });

  it("keeps an absolute ledger path, and a relative one when the indexer is relative too", () => {
    expect(absoluteLedgerPath("http://web:3000/api/ledger", "http://other/api/index")).toBe("http://web:3000/api/ledger");
    expect(absoluteLedgerPath("/api/ledger", "/api/index")).toBe("/api/ledger");
    expect(absoluteLedgerPath(undefined, undefined)).toBeUndefined();
  });
});
