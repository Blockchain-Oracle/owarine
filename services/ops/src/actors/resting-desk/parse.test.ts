import { describe, expect, it } from "vitest";
import { marketIdFromDaml } from "@owarine/core/market";
import { parseRestingRequest } from "./parse";

const MARKET = marketIdFromDaml("TSLA-5m:7");
const body = (over: Record<string, unknown> = {}) => ({ party: "seat-1::1220cdef01", leaseId: "lease-1", marketId: MARKET, side: "up", stakeBase: "5500000", priceCents: 55, restUntil: "bell", displayedEscrowBase: "5500000", ...over });

describe("the resting offer's request", () => {
  it("reads a well-formed request, bigints from decimal strings", () => {
    expect(parseRestingRequest(body())).toEqual({ party: "seat-1::1220cdef01", leaseId: "lease-1", marketId: MARKET, side: "up", stakeBase: 5_500_000n, priceCents: 55, restUntil: "bell", displayedEscrowBase: 5_500_000n });
    expect(parseRestingRequest({ ...body(), restUntil: undefined })).toMatchObject({ restUntil: "bell" });
  });

  it("refuses each malformed part with a sentence, before anything else", () => {
    expect(parseRestingRequest(null)).toBe("body must be an object");
    expect(parseRestingRequest(body({ party: "alice" }))).toBe("party must be a party id");
    expect(parseRestingRequest(body({ leaseId: "a b" }))).toMatch(/leaseId/);
    expect(parseRestingRequest(body({ marketId: "TSLA-5m:7" }))).toMatch(/base58/);
    expect(parseRestingRequest(body({ side: "sideways" }))).toBe("side must be up or down");
    expect(parseRestingRequest(body({ stakeBase: 5 }))).toMatch(/stakeBase/);
    expect(parseRestingRequest(body({ displayedEscrowBase: "-1" }))).toMatch(/displayedEscrowBase/);
    for (const priceCents of [0, 100, 55.5, "55"]) expect(parseRestingRequest(body({ priceCents }))).toMatch(/priceCents/);
    expect(parseRestingRequest(body({ restUntil: "never" }))).toMatch(/restUntil/);
  });
});
