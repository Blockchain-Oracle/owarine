/**
 * C4c (security review M1): a room token names a wallet only when the seat that asks vouches for it. The vouch is the
 * seat's own resolution (`byAddress`): the key that proved the seat, the key that took its lease, or a key joined to
 * that same live lease. Another seat's address, or a key whose lease ended, never gets a token or posts a score.
 */
import { describe, expect, it } from "vitest";
import type { Address } from "@agari/core/types";
import { seatVouch, type ProvenSeat } from "./room-token.server";

const LEASE_A = "00000000-0000-4000-8000-00000000000a";
const LEASE_B = "00000000-0000-4000-8000-00000000000b";
/** The seat pool as `byAddress` answers it: seat A's holder and its joined phone, and seat B's holder. */
const LIVE: Record<string, string> = { "web-a": LEASE_A, "phone-a": LEASE_A, "web-b": LEASE_B };

function seat(caller: string): ProvenSeat {
  return {
    caller,
    lease: { leaseId: LIVE[caller] ?? LEASE_A, address: "web-a" },
    server: { store: { byAddress: async (address: string) => (LIVE[address] ? { leaseId: LIVE[address]! } : null) } },
  };
}

const w = (s: string) => s as Address;

describe("seatVouch: who may name a wallet in a room token", () => {
  it("vouches for its own key, its lease's holder, and a key joined to the same live lease", async () => {
    const fromPhone = seatVouch(seat("phone-a"));
    expect(await fromPhone(w("phone-a"))).toBe(true);
    expect(await fromPhone(w("web-a"))).toBe(true);
    const fromWeb = seatVouch(seat("web-a"));
    expect(await fromWeb(w("web-a"))).toBe(true);
    expect(await fromWeb(w("phone-a"))).toBe(true);
  });

  it("never vouches for another seat's wallet, an unknown key, or a key whose lease ended", async () => {
    const vouch = seatVouch(seat("web-a"));
    expect(await vouch(w("web-b"))).toBe(false);
    expect(await vouch(w("stranger"))).toBe(false);
    // A store read that fails vouches for nothing.
    const broken: ProvenSeat = { ...seat("web-a"), server: { store: { byAddress: async () => Promise.reject(new Error("down")) } } };
    expect(await seatVouch(broken)(w("phone-a"))).toBe(false);
  });
});
