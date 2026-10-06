import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

/**
 * C11b, found linking the phone's seat to the web: a joined device asks `/api/ledger/me/*` about its own key, and the
 * client refuses an answer that names any other address (`provider/wallet.ts`). The route named the holder's key, so a
 * joined device read no balance or positions. The answer names the key that proved itself.
 */
const HOLDER = "EGkRsDkiEaQ6TUBP7RgSP16MWrwkMww2qAYmNkCZgG5E";
const JOINED = "75XBoJoinedKeyAddress1111111111111111111111";
let caller = HOLDER;
vi.mock("@/lib/seat.server", async (original) => ({
  ...(await original<typeof import("@/lib/seat.server")>()),
  seatFromRequest: async () => ({
    ok: true,
    seat: {
      via: "header",
      caller,
      lease: { leaseId: "0b6f3a7e-58a1-4d4e-9b1a-2f1f6c1f0a11", address: HOLDER, party: "seat-1::1220aa", busyUntilMs: 0, openLegs: 0 },
      server: { ledger: { balance: async () => ({ value: { spendableBase: "998295536" }, party: "seat-1::1220aa", offset: 3093, busyUntilMs: 0, openLegs: 0 }) }, store: { touch: async () => undefined } },
    },
  }),
}));
const { GET } = await import("./route");

const read = async () => {
  const res = await GET(new NextRequest("http://localhost/api/ledger/me/balance"), { params: Promise.resolve({ view: "balance" }) });
  return (await res.json()) as { address: string; party: string; value: { spendableBase: string } };
};

describe("/api/ledger/me/*: the answer names the key that asked (C11b)", () => {
  it("the holder reads its seat under its own key", async () => {
    caller = HOLDER;
    expect((await read()).address).toBe(HOLDER);
  });

  it("a joined key reads the same seat under its own key, so its client accepts the answer", async () => {
    caller = JOINED;
    const body = await read();
    expect([body.address, body.party, body.value.spendableBase]).toEqual([JOINED, "seat-1::1220aa", "998295536"]);
  });
});
