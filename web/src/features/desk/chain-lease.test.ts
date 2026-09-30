import { describe, expect, it, vi } from "vitest";

/**
 * C4d H2 (K-210): the desk page reads a row's ledger state only under the row owner's CURRENT lease. Visitor A's row
 * (owner A, the address A saw) must not show the live desk of B, the next visitor on the same recycled party: before
 * C4d `readChain` looked the mandate up by address alone.
 */
const A = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const leases = new Map<string, { party: string }>();
const leasedState = vi.fn(async (_o: { party: string | null; address: string }, _mode: unknown) => null);
vi.mock("@/lib/ledger.server", () => ({
  seatServer: () => ({ ok: true, server: { store: { byAddress: async (a: string) => leases.get(a) ?? null }, desk: { leasedState, state: vi.fn(async () => null) }, parties: { agentRunner: null } } }),
}));
vi.mock("./desk.server", () => ({ deskStore: () => null }));

const { readChain } = await import("./chain.server");

describe("readChain binds a desk row to its owner's current lease (C4d H2)", () => {
  it("A's row reads nothing once A holds no lease, and the lookup names no party", async () => {
    leases.clear();
    const r = await readChain(A as never, 0, "legacy-address-of-P");
    expect(r.state).toBeNull();
    expect(leasedState).toHaveBeenLastCalledWith({ party: null, address: "legacy-address-of-P" }, null);
  });

  it("while A leases a party, the lookup is bound to that party", async () => {
    leases.set(A, { party: "seat-8::1220bc" });
    await readChain(A as never, 0, "addr");
    expect(leasedState).toHaveBeenLastCalledWith({ party: "seat-8::1220bc", address: "addr" }, null);
  });
});
