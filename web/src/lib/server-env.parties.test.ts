import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { seatParties } from "./server-env";

const p = (n: string) => `${n}::1220${"a".repeat(64)}`;

function file(content: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "parties-")), "parties.json");
  writeFileSync(path, JSON.stringify(content));
  return path;
}

describe("seatParties reads the one parties file ops writes (K-026)", () => {
  it("takes the venue from parties, personas from users, and seat-* users as the pool in numeric order", () => {
    const path = file({
      network: "local",
      parties: { venue: p("venue"), resolver: p("resolver") },
      users: { alice: p("alice"), bob: p("bob"), outsider: p("outsider"), "seat-10": p("s10"), "seat-2": p("s2"), "seat-1": p("s1") },
    });
    const got = seatParties({ AGARI_PARTIES_FILE: path } as never);
    expect(got.venue).toBe(p("venue"));
    expect(got.seats).toEqual([p("s1"), p("s2"), p("s10")]);
    expect(got.personas).toEqual({ alice: p("alice"), bob: p("bob"), outsider: p("outsider") });
  });

  it("still accepts the older web-only shape", () => {
    const path = file({ venue: p("venue"), seats: [p("s1")], personas: { alice: p("alice") } });
    const got = seatParties({ AGARI_PARTIES_FILE: path } as never);
    expect(got.seats).toEqual([p("s1")]);
    expect(got.personas.alice).toBe(p("alice"));
  });
});
