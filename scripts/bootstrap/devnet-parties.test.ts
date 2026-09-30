import { describe, expect, it } from "vitest";
import { CANTON_ROLES } from "../../services/ops/src/runtime/keys";
import { hintFor, parseDevnetParties, partySlots, shortParty } from "./devnet-parties";

const fp = (n: number) => `1220${n.toString(16).padStart(64, "0")}`;
const id = (hint: string, n: number) => `${hint}::${fp(n)}`;

function fullJson(seats = 8) {
  const parties = Object.fromEntries(CANTON_ROLES.map((r, i) => [r, id(hintFor(r), i + 1)]));
  const users: Record<string, string> = { alice: id("pm-alice", 100), bob: id("pm-bob", 101), outsider: id("pm-outsider", 102) };
  for (let i = 1; i <= seats; i++) users[`seat-${i}`] = id(`pm-seat-${i}`, 200 + i);
  return { network: "devnet", parties, users };
}

describe("parseDevnetParties", () => {
  it("accepts the filled template and keeps the K-026 shape", () => {
    const r = parseDevnetParties(JSON.stringify(fullJson()), { nowMs: 1 });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.file.network).toBe("devnet");
    expect(Object.keys(r.file.parties)).toEqual([...CANTON_ROLES]);
    expect(Object.keys(r.file.users!)).toHaveLength(11);
    expect(partySlots(r.file)).toHaveLength(19);
  });

  it("treats empty slots as unfilled: a missing role is fatal, fewer seats is a note", () => {
    const j = fullJson(3);
    j.parties.resolver = "";
    const r = parseDevnetParties(JSON.stringify(j));
    expect(r.errors).toEqual(["parties.resolver: missing (Console hint pm-resolver)"]);
    expect(r.warnings).toContain("3 of 8 seats filled: the seat pool runs with 3");
  });

  it("refuses a malformed id, an unknown role and one party in two slots, naming slots but never ids", () => {
    const j = fullJson() as { parties: Record<string, string>; users: Record<string, string> };
    j.parties.venue = "pm-venue::1220abc";
    j.parties.bogus = id("pm-bogus", 9);
    j.users["seat-2"] = j.users["seat-1"]!;
    const r = parseDevnetParties(JSON.stringify(j));
    expect(r.errors).toContain("parties.venue: not a Canton party id (<hint>::1220<64 hex>)");
    expect(r.errors).toContain("parties.bogus: not a role (venue, resolver, oracle-coinbase, oracle-kraken, oracle-bitstamp, auditor, lp, agent-runner)");
    expect(r.errors).toContain("users.seat-2: the same party as users.seat-1");
    expect(r.errors.join(" ")).not.toContain("12200000");
  });

  it("caps the seat pool at --seats", () => {
    const r = parseDevnetParties(JSON.stringify(fullJson(8)), { seats: 5 });
    expect(r.errors).toEqual([]);
    expect(Object.keys(r.file.users!).filter((n) => n.startsWith("seat-"))).toEqual(["seat-1", "seat-2", "seat-3", "seat-4", "seat-5"]);
    expect(r.warnings).toContain("users.seat-6: beyond the seat pool of 5 (--seats), left out");
  });

  it("maps a pasted Console list by hint, behind a namespace prefix, without confusing seat-1 and seat-11", () => {
    const j = fullJson(8);
    const lines = [
      "Party hint  Party id",
      ...Object.entries(j.parties).map(([, p]) => `x  abu-${p}  Local  Act-as on`),
      ...Object.entries(j.users).map(([, p]) => `abu-${p}`),
      `abu-${id("pm-seat-11", 999)}`,
      id("somebody-else", 998),
    ].join("\n");
    const r = parseDevnetParties(lines, { seats: 8 });
    expect(r.errors).toEqual([]);
    expect(r.file.parties.venue).toBe(`abu-${j.parties.venue}`);
    expect(r.file.users!["seat-1"]).toBe(`abu-${j.users["seat-1"]}`);
    expect(r.warnings).toContain("2 listed parties carry no pm-* hint this run uses (ignored)");
  });

  it("says what is wrong with broken JSON instead of reading it as a list", () => {
    const r = parseDevnetParties("{ \"parties\": ");
    expect(r.errors[0]).toMatch(/looks like JSON but does not parse/);
  });

  it("shortParty keeps the hint only", () => {
    expect(shortParty(id("pm-venue", 1))).toBe("pm-venue::…");
  });
});
