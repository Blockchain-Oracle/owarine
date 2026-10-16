import { describe, expect, it } from "vitest";
import { needsTicketResolutions } from "./state";

describe("needsTicketResolutions", () => {
  it("does not scan historical resolutions for expired active contracts", () => {
    expect(needsTicketResolutions(100, [{ data: { refundAfterSec: 99 } }], [{ data: { voidAfterSec: 100 } }], [{ data: { refundAfterSec: 50 } }])).toBe(false);
  });

  it("keeps resolutions available while a round, ticket or position can still settle", () => {
    expect(needsTicketResolutions(100, [{ data: { refundAfterSec: 101 } }], [], [])).toBe(true);
    expect(needsTicketResolutions(100, [], [{ data: { voidAfterSec: 101 } }], [])).toBe(true);
    expect(needsTicketResolutions(100, [], [], [{ data: { refundAfterSec: 101 } }])).toBe(true);
  });
});
