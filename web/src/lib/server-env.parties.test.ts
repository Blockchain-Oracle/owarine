import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkWebServerEnv, seatParties } from "./server-env";

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

describe("checkWebServerEnv refuses a seat party the venue's own actors act as (C4d L5)", () => {
  const base = { DATABASE_URL: "postgres://x", AGARI_SEAT_COOKIE_SECRET: "c".repeat(40), OPS_INTERNAL_URL: "http://ops:8080", OPS_INTERNAL_SECRET: "o".repeat(40), LEDGER_JSON_API_URL: "http://ledger:7575" };
  const problemsWith = (parties: Record<string, string>, seats: string[]) =>
    checkWebServerEnv({ ...base, AGARI_PARTIES_FILE: file({ network: "local", parties: { venue: p("venue"), ...parties }, users: Object.fromEntries(seats.map((s, i) => [`seat-${i + 1}`, s])) }) }).problems;

  it("an agent-runner or oracle party listed as a seat is a problem", () => {
    expect(problemsWith({ "agent-runner": p("runner") }, [p("s1"), p("runner")])).toContainEqual(expect.stringMatching(/^AGARI_SEAT_PARTIES: a seat party is also the venue, the agent runner, an oracle or a persona/));
    expect(problemsWith({ "oracle-coinbase": p("oc") }, [p("oc")])).toContainEqual(expect.stringMatching(/agent runner, an oracle/));
  });

  it("distinct seat parties pass", () => {
    expect(problemsWith({ "agent-runner": p("runner"), "oracle-coinbase": p("oc") }, [p("s1"), p("s2")]).filter((x) => x.startsWith("AGARI_SEAT_PARTIES"))).toEqual([]);
  });
});
