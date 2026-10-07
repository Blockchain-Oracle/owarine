import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a kit size beside a kit colour", () => {
    expect(cn("text-ow-label", "text-ow-muted")).toBe("text-ow-label text-ow-muted");
  });
  it("still lets a later kit size win over an earlier one", () => {
    expect(cn("text-ow-label", "text-ow-hero")).toBe("text-ow-hero");
  });
});
