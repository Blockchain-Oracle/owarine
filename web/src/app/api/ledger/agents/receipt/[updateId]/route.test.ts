import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

/**
 * C4d L3: `/api/ledger/agents/receipt/<updateId>` read any update as the seat's party, so a recycled seat's visitor
 * could read an earlier visitor's transactions. Only updates from the lease's start offset on are the seat's.
 */
const P = "seat-7::1220bb";
const LEASE_START = 500;
const offsets: Record<string, number> = { ["1220" + "aa".repeat(32)]: 120, ["1220" + "bb".repeat(32)]: 640 };
vi.mock("@/lib/seat.server", async (orig) => {
  const real = await orig<typeof import("@/lib/seat.server")>();
  return {
    ...real,
    seatFromRequest: async () => ({
      ok: true,
      seat: {
        lease: { party: P, startOffset: LEASE_START },
        server: { client: { updateById: async (id: string) => ({ updateId: id, offset: offsets[id], events: [{ CreatedEvent: { templateId: "pkg:PM.Cash:VenueCash", createArgument: { owner: P, amount: "700", bucket: "credit", venue: "v::1" } } }] }) } },
      },
    }),
  };
});
const { GET } = await import("./route");
const read = async (id: string) => (await GET(new NextRequest(`https://site.test/api/ledger/agents/receipt/${id}`), { params: Promise.resolve({ updateId: id }) })).json();

describe("an agent receipt is read only under the lease (C4d L3)", () => {
  it("an update from before the lease reads as not the seat's", async () => {
    expect(await read("1220" + "aa".repeat(32))).toEqual({ receipt: null });
  });
  it("the lease's own update reads as before", async () => {
    expect((await read("1220" + "bb".repeat(32))).receipt).toMatchObject({ status: "success" });
  });
});
