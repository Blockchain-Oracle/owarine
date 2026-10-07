import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GAMES_TEMPLATE_IDS } from "@owarine/daml";
import type { LedgerClient } from "@owarine/ledger";
import type { SeasonClosure } from "@owarine/db";
import type { Address } from "@owarine/core/types";
import { createArenaDesk, type SeasonClosureStore } from "./desk";
import { arenaRoutes, ARENA_ROUTES } from "./routes";
import { createSeatDirectory } from "./seats";

const VENUE = "venue::1220ab";
const ENDS = "2026-09-29T12:00:00Z";

/** A one-pool ledger: the venue's `SeasonPool`, archived by the withdrawal the route submits. */
function world(o: { distributed: boolean }) {
  let live = true;
  const pool = { venue: VENUE, seasonId: "s1", endsAt: ENDS, amount: "10000000", deposited: "100000000", distributed: o.distributed };
  const activeContracts = vi.fn(async (q: { templateIds?: string[] }) => ({
    contracts:
      live && (q.templateIds ?? []).some((t) => t.endsWith(":SeasonPool"))
        ? [{ createdEvent: { contractId: "00pool", templateId: GAMES_TEMPLATE_IDS.SeasonPool, createArgument: pool }, synchronizerId: "sync" }]
        : [],
  }));
  const submitAndWaitForTransaction = vi.fn(async (_req: { commandId: string; actAs: string[]; commands: unknown[] }) => {
    live = false;
    return { transaction: { events: [], updateId: "1220withdraw", offset: 9, effectiveAt: "", synchronizerId: "sync", recordTime: "" }, submissionId: "s", attempts: 1, recovered: false };
  });
  const client = { activeContracts, submitAndWaitForTransaction } as unknown as LedgerClient;
  const rows: SeasonClosure[] = [];
  const closures: SeasonClosureStore = { record: async (c) => (rows.push(c), true), read: async (id) => rows.find((r) => !id || r.seasonId === id) ?? null };
  const desk = createArenaDesk({ venue: { role: "venue", party: VENUE, client, dryRun: false }, seats: createSeatDirectory(null, () => {}), chainId: 1, log: () => {}, closures });
  return { desk, routes: arenaRoutes(desk), submitAndWaitForTransaction, rows };
}

describe("the season admin's withdrawal (K-105)", () => {
  it("returns what is left after the payout once, records the closure, and the season then reads as paid out", async () => {
    const w = world({ distributed: true });
    expect((await w.desk.season("s1"))?.balanceBase).toBe(10_000_000n);
    const r = await w.routes["/internal/games/season/withdraw"]!({ seasonId: "s1" });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ kind: "confirmed", updateId: "1220withdraw", withdrawnBase: 10_000_000n });
    expect(w.submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
    const call = w.submitAndWaitForTransaction.mock.calls[0]![0];
    expect(call.actAs).toEqual([VENUE]);
    expect(call.commandId).toMatch(/^season:withdraw:/);
    expect(JSON.stringify(call.commands)).toContain("Season_WithdrawRemainder");
    expect(w.rows).toEqual([{ seasonId: "s1", endsAtSec: Date.parse(ENDS) / 1000, depositedBase: 100_000_000n, withdrawnBase: 10_000_000n, updateId: "1220withdraw" }]);
    // The pool is archived on the ledger; the season still answers, as the reference's drained pool.
    expect(await w.desk.season("s1")).toMatchObject({ seasonId: "s1", distributed: true, balanceBase: 0n, depositedBase: 100_000_000n });
    // A second withdrawal finds no live pool and sends nothing.
    const again = await w.routes["/internal/games/season/withdraw"]!({ seasonId: "s1" });
    expect(again.status).toBe(409);
    expect(w.submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
  });

  it("refuses before the distribution and never submits", async () => {
    const w = world({ distributed: false });
    const r = await w.routes["/internal/games/season/withdraw"]!({ seasonId: "s1" });
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toContain("has not paid out");
    expect(w.submitAndWaitForTransaction).not.toHaveBeenCalled();
    expect(w.rows).toEqual([]);
  });

  it("is an ops route no web route forwards: no seat can reach the season admin's calls", () => {
    expect(ARENA_ROUTES).toContain("/internal/games/season/withdraw");
    const root = resolve(import.meta.dirname, "../../../../../web/src");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && /season\/(withdraw|distribute)|withdrawSeasonRemainder|distributeSeasonPrizes/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  }, 30_000);
});

describe("the creator's open, by party (C4c: a key joined by a seat link queues and opens as its seat)", () => {
  const SEAT_A = "owarine-user-seat-1::1220aaaa0001";
  const SEAT_B = "owarine-user-seat-2::1220bbbb0002";
  const MATCH = `0x${"ab".repeat(32)}`;
  const PHONE_A = "PhoneA11111111111111111111111111111111111111" as Address;
  const WEB_B = "WebB2222222222222222222222222222222222222222" as Address;

  function dealt() {
    const w = world({ distributed: false });
    // The pairings the lease table proves (here pinned: no database); the phone is the key that queued for seat A.
    w.desk.seats.pin(SEAT_A, PHONE_A);
    w.desk.seats.pin(SEAT_B, WEB_B);
    w.desk.hold({ matchId: MATCH, creator: PHONE_A, challenger: WEB_B, tierId: "t1", arenaId: "a1", deckHash: "00", deckSize: 2, clientSeeds: [] });
    return w;
  }

  it("opens for the lease whose joined key queued, though the web names the lease's own key", async () => {
    const w = dealt();
    const r = await w.routes["/internal/games/open"]!({ matchId: MATCH, party: SEAT_A, address: "WebA-holder-key" });
    // Past both seat checks: this one-pool ledger has no ArenaTerms, which is the next thing the open reads.
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.body)).toContain("not-deployed");
  });

  it("refuses another seat's lease, and a pairing whose creator key no longer maps", async () => {
    const w = dealt();
    const other = await w.routes["/internal/games/open"]!({ matchId: MATCH, party: SEAT_B, address: WEB_B });
    expect(other.status).toBe(409);
    expect(JSON.stringify(other.body)).toContain("only the pairing's creator opens the match");

    const gone = world({ distributed: false });
    gone.desk.hold({ matchId: MATCH, creator: PHONE_A, challenger: WEB_B, tierId: "t1", arenaId: "a1", deckHash: "00", deckSize: 2, clientSeeds: [] });
    const r = await gone.routes["/internal/games/open"]!({ matchId: MATCH, party: SEAT_A, address: "WebA-holder-key" });
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toContain("no longer holds a seat");
    expect(gone.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });
});
