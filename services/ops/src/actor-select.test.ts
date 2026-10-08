import { describe, expect, it } from "vitest";
import { LEGACY_ACTORS, selectedActors, VENUE_ACTORS } from "./actor-select";

describe("selectedActors", () => {
  it("runs the venue set when OPS_ACTORS is empty", () => {
    expect([...selectedActors(undefined)]).toEqual([...VENUE_ACTORS]);
  });

  it("keeps a legacy actor named beside default (default,x-relay dropped the relay before)", () => {
    const set = selectedActors("default,cc-rail,x-relay");
    expect(set.has("x-relay")).toBe(true);
    expect(set.has("cc-rail")).toBe(true);
    expect(set.has("venue")).toBe(true);
    expect(set.has("strategy-runner")).toBe(false);
  });

  it("ignores an unknown name beside default", () => {
    expect(selectedActors("default,typo").has("typo")).toBe(false);
  });

  it("runs only the names given otherwise (a relay-only process)", () => {
    expect([...selectedActors("x-relay")]).toEqual(["x-relay"]);
  });

  it("all adds the legacy actors but never an opt-in one unless named", () => {
    const set = selectedActors("all");
    for (const a of LEGACY_ACTORS) expect(set.has(a)).toBe(true);
    expect(set.has("desk-runner")).toBe(false);
    expect(selectedActors("all,desk-runner").has("desk-runner")).toBe(true);
  });
});
