import type { Db, IndexReader } from "@agari/db";
import { describe, expect, it } from "vitest";
import { resolveIndexQuery, type SeatLeaseScope } from "./queries";

/**
 * C13a: the projection keys a seat's rows by party, and a party is recycled to later visitors, so every `wallet/*`
 * read runs under the caller's lease (the SQL side is `packages/db/src/idx/read-lease.test.ts`).
 */
const ADDRESS = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const LEASE: SeatLeaseScope = { party: "agari-user-seat-1::1220aa", fromOffset: 100 };

/** A reader that records the options each seat read was called with. */
function recordingReader() {
  const calls: Record<string, unknown> = {};
  const record = (name: string) => async (...args: unknown[]) => {
    calls[name] = args.at(-1);
    return [];
  };
  const reader = {
    walletFills: record("fills"),
    positions: record("positions"),
    walletActions: record("actions"),
    walletReceipts: record("receipts"),
    orders: record("orders"),
  } as unknown as IndexReader;
  return { reader, calls };
}

describe("wallet reads run under the seat's lease", () => {
  it.each(["fills", "positions", "actions", "receipts", "orders"])("%s asks for the lease and passes it to the reader", async (resource) => {
    const resolved = resolveIndexQuery(["wallet", ADDRESS, resource], {}, "abu-pm-main");
    expect(resolved).toMatchObject({ scope: "wallet", owner: ADDRESS, seatLease: true });
    const { reader, calls } = recordingReader();
    await resolved!.run(reader, {} as Db, LEASE);
    expect(calls[resource]).toMatchObject({ lease: LEASE });
  });

  it("a seat with no lease passes none, so only its own address can match", async () => {
    const { reader, calls } = recordingReader();
    await resolveIndexQuery(["wallet", ADDRESS, "fills"], {}, "abu-pm-main")!.run(reader, {} as Db, null);
    expect(calls.fills).toMatchObject({ lease: null });
  });
});
