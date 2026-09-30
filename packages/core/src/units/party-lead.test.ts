import { describe, expect, it } from "vitest";
import { partyLead, shortHex } from "./display";

const shortParty = (party: string) => shortHex(party, partyLead(party), 4);

describe("partyLead", () => {
  it("keeps the readable hint and the fingerprint's first four characters", () => {
    const party = "alice::1220a1b2c3d4e5f60718293a4b5c6d7e8f9091a2b3c4d5e6f708192a3b4c5d6e7f809";
    expect(partyLead(party)).toBe("alice::1220".length);
    expect(shortParty(party)).toBe(`alice::1220…${party.slice(-4)}`);
  });

  it("follows a longer hint", () => {
    const party = "seat-3::12204f9e8d7c6b5a49382716f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0";
    expect(party.slice(0, partyLead(party))).toBe("seat-3::1220");
    expect(shortParty(party)).toBe(`seat-3::1220…${party.slice(-4)}`);
  });

  it("keeps the first eight characters of an id with no fingerprint marker", () => {
    expect(partyLead("plain-id-without-marker-0123456789abcdef")).toBe(8);
  });

  it("leaves a short id whole", () => {
    expect(shortParty("bob::1220")).toBe("bob::1220");
  });
});
