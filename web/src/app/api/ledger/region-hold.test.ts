import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * C5d (C-MKT-08, D-095): every Canton entry a seat makes answers 451 from a held region before it reads the seat, and
 * every exit stays open. The seat lookup is stubbed to "not seated" (401), so an exit that is not held reaches it.
 */
const seatLookups = vi.fn();
vi.mock("@/lib/seat.server", async (original) => ({
  ...(await original<typeof import("@/lib/seat.server")>()),
  seatFromRequest: async () => {
    seatLookups();
    return { ok: false, response: Response.json({ error: "no seat" }, { status: 401 }) };
  },
}));

const CID = `00${"ab".repeat(40)}`;
const req = (path: string, region: "restricted" | null) =>
  new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", ...(region ? { "x-owarine-region": region } : {}) }, body: "{}" });
type Route = { POST: (r: NextRequest, c: { params: Promise<Record<string, string>> }) => Promise<Response> };
const call = async (mod: Promise<unknown>, path: string, params: Record<string, string>, region: "restricted" | null) =>
  (await (mod as Promise<Route>)).POST(req(path, region), { params: Promise.resolve(params) });

const ENTRIES: Array<[string, () => Promise<unknown>, Record<string, string>]> = [
  ["/api/ledger/quotes", () => import("./quotes/route"), {}],
  ["/api/ledger/quotes/<cid>/accept", () => import("./quotes/[cid]/accept/route"), { cid: CID }],
  ["/api/ledger/resting", () => import("./resting/route"), {}],
  ["/api/ledger/resting/<cid>/place", () => import("./resting/[cid]/place/route"), { cid: CID }],
  ["/api/ledger/tickets/range/accept", () => import("./tickets/[product]/[action]/route"), { product: "range", action: "accept" }],
  ["/api/ledger/cc/deposit", () => import("./cc/deposit/route"), {}],
  ["/api/ledger/agents/vault/open", () => import("./agents/vault/[action]/route"), { action: "open" }],
  ["/api/ledger/agents/vault/fund", () => import("./agents/vault/[action]/route"), { action: "fund" }],
];

const EXITS: Array<[string, () => Promise<unknown>, Record<string, string>]> = [
  ["/api/ledger/exit-quotes", () => import("./exit-quotes/route"), {}],
  ["/api/ledger/exit-quotes/<cid>/accept", () => import("./exit-quotes/[cid]/accept/route"), { cid: CID }],
  ["/api/ledger/tickets/range/claim", () => import("./tickets/[product]/[action]/route"), { product: "range", action: "claim" }],
  ["/api/ledger/tickets/range/refund-stale", () => import("./tickets/[product]/[action]/route"), { product: "range", action: "refund-stale" }],
  ["/api/ledger/resting/cancel", () => import("./resting/cancel/route"), {}],
  ["/api/ledger/cc/withdraw", () => import("./cc/withdraw/route"), {}],
  ["/api/ledger/agents/vault/revoke", () => import("./agents/vault/[action]/route"), { action: "revoke" }],
];

afterEach(() => seatLookups.mockClear());

describe("region hold on the Canton write routes", () => {
  // A fresh checkout must transform the route dependency graph. Keep that setup out of the
  // request assertions' five-second budget; the handler checks retain their normal timeout.
  beforeAll(async () => {
    await Promise.all([...ENTRIES, ...EXITS].map(([, load]) => load()));
  }, 60_000);

  it.each(ENTRIES)("%s answers 451 from a held region, before it reads the seat", async (path, mod, params) => {
    const res = await call(mod(), path, params, "restricted");
    expect(res.status).toBe(451);
    expect(await res.json()).toEqual({ error: "region_restricted" });
    expect(seatLookups).not.toHaveBeenCalled();
  });

  it.each(ENTRIES)("%s is not held from an open region", async (path, mod, params) => {
    expect((await call(mod(), path, params, null)).status).not.toBe(451);
  });

  it.each(EXITS)("%s stays open from a held region (an exit)", async (path, mod, params) => {
    expect((await call(mod(), path, params, "restricted")).status).not.toBe(451);
    expect(seatLookups).toHaveBeenCalled();
  });
});
