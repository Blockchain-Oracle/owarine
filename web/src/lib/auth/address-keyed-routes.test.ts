import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * C4d M3: routes keyed by a seat address answered anyone who typed the address. Each now needs the caller to prove
 * that address (the seat cookie or the phone's signed read header; a POST the cookie or a one-request write proof).
 */
const ME = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const OTHER = "US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx";
let caller: string | null = null;
let writer: string | null = null;
vi.mock("./seat-caller.server", () => ({ seatCaller: async () => caller }));
vi.mock("./seat-write.server", () => ({ seatWriter: async () => writer }));
vi.mock("../env", () => ({ webEnv: { markets: { cluster: "devnet", chainId: 1 }, appOrigin: "https://site.test" } }));
vi.mock("@/lib/env", () => ({ webEnv: { markets: { cluster: "devnet", chainId: 1 }, appOrigin: "https://site.test" } }));
const reads = { matches: vi.fn(async () => [{ matchId: "m1" }]), receipts: vi.fn(async () => [{ tweetId: "t1" }]), lucky: vi.fn(async () => ({ configured: true, rows: [] })), bet: vi.fn(async () => true), commit: vi.fn(async () => ({ ok: true, wire: { drawId: "d" } })) };
vi.mock("@owarine/db", () => ({
  gamesStoreConfigured: () => true, listMatchesFor: reads.matches, isDbConfigured: () => true, xReceiptsByWallet: reads.receipts,
  hasBet: reads.bet, hasBetOnSymbol: reads.bet, hasIndexedBet: reads.bet, hasIndexedBetOnSymbol: reads.bet, hasIndexedFill: vi.fn(), recordBettor: vi.fn(),
}));
vi.mock("@/features/games/lucky/lucky-settle.server", () => ({ luckyHistory: reads.lucky }));
vi.mock("@/features/games/lucky/lucky.server", () => ({ commitDraw: reads.commit }));

const games = await import("@/app/api/games/history/route");
const lucky = await import("@/app/api/games/lucky/history/route");
const receipts = await import("@/app/api/x/receipts/route");
const bet = await import("@/app/api/room/bet/route");
const commit = await import("@/app/api/games/lucky/commit/route");

const get = (path: string) => new NextRequest(`https://site.test${path}`);
beforeEach(() => {
  caller = null;
  writer = null;
  for (const f of Object.values(reads)) f.mockClear();
});

describe("address-keyed reads answer only the proven seat (C4d M3)", () => {
  it("a typed address alone reads nothing, and nothing is looked up", async () => {
    for (const who of [null, OTHER]) {
      caller = who;
      expect((await games.GET(get(`/api/games/history?address=${ME}`))).status).toBe(403);
      expect((await lucky.GET(get(`/api/games/lucky/history?address=${ME}`))).status).toBe(403);
      expect((await receipts.GET(get(`/api/x/receipts?wallet=${ME}`))).status).toBe(403);
      expect(await (await bet.GET(get(`/api/room/bet?marketId=$TSLA&address=${ME}`))).json()).toEqual({ configured: true, hasBet: null });
    }
    expect(reads.matches).not.toHaveBeenCalled();
    expect(reads.lucky).not.toHaveBeenCalled();
    expect(reads.receipts).not.toHaveBeenCalled();
    expect(reads.bet).not.toHaveBeenCalled();
  });

  it("the seat that proves the address reads its own", async () => {
    caller = ME;
    expect((await games.GET(get(`/api/games/history?address=${ME}`))).status).toBe(200);
    expect((await lucky.GET(get(`/api/games/lucky/history?address=${ME}`))).status).toBe(200);
    expect((await receipts.GET(get(`/api/x/receipts?wallet=${ME}`))).status).toBe(200);
    expect(await (await bet.GET(get(`/api/room/bet?marketId=$TSLA&address=${ME}`))).json()).toEqual({ configured: true, hasBet: true });
  });
});

describe("a Lucky commit spins only for the caller's own seat (C4d M3)", () => {
  const spin = (wallet: string) => new NextRequest("https://site.test/api/games/lucky/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet, stakeBase: "100" }) });

  it("refuses a body naming a wallet the caller did not prove", async () => {
    writer = OTHER;
    expect((await commit.POST(spin(ME))).status).toBe(403);
    writer = null;
    expect((await commit.POST(spin(ME))).status).toBe(403);
    expect(reads.commit).not.toHaveBeenCalled();
  });

  it("commits for the proven seat", async () => {
    writer = ME;
    expect((await commit.POST(spin(ME))).status).toBe(200);
    expect(reads.commit).toHaveBeenCalledWith(expect.objectContaining({ wallet: ME }));
  });
});
