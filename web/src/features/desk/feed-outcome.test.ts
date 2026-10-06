import { describe, expect, it } from "vitest";
import { feedOutcome } from "./feed-outcome";

describe("C-S21d: the desk feed carries the outcome the watcher rings on", () => {
  it("maps the stored planned outcome to its wire column", () => {
    expect(feedOutcome("WOULD_HAVE_ACTED")).toBe("would_have_acted");
    expect(feedOutcome("FAILED_NO_DECISION")).toBe("failed");
    expect(feedOutcome("BLOCKED_BY_LIMIT")).toBe("blocked_by_limit");
  });
  it("passes a column through and refuses anything else", () => {
    expect(feedOutcome("acted")).toBe("acted");
    expect(feedOutcome("SOMETHING")).toBeNull();
    expect(feedOutcome(null)).toBeNull();
  });
});
