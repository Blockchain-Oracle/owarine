import { describe, expect, it } from "vitest";
import { absoluteLedgerPath, opsIndexerUrl } from "./markets-env";

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

describe("the indexer URL ops uses (C10a)", () => {
  it("keeps an absolute URL", () => {
    expect(opsIndexerUrl("http://web:3000/api/index", { NEXT_PUBLIC_APP_ORIGIN: "https://pm.example" })).toBe("http://web:3000/api/index");
  });

  it("resolves a relative or absent one against the web's origin, internal first", () => {
    expect(opsIndexerUrl("/api/index", { OWARINE_WEB_ORIGIN: "http://web:3000", NEXT_PUBLIC_APP_ORIGIN: "https://pm.example" })).toBe(
      "http://web:3000/api/index",
    );
    expect(opsIndexerUrl(undefined, { NEXT_PUBLIC_APP_ORIGIN: "https://pm.example/" })).toBe("https://pm.example/api/index");
    expect(opsIndexerUrl("", { NEXT_PUBLIC_SITE_URL: "https://pm.example" })).toBe("https://pm.example/api/index");
  });

  it("falls back to the local web on :3000", () => {
    expect(opsIndexerUrl(undefined, {})).toBe("http://127.0.0.1:3000/api/index");
  });
});
