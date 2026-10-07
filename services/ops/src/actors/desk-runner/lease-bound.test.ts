import { AGENT_TEMPLATE_IDS } from "@owarine/daml";
import type { DeskRow } from "@owarine/db";
import type { LedgerClient } from "@owarine/ledger";
import { legacyDeskAddressOf } from "@owarine/markets/ops/agents";
import { describe, expect, it, vi } from "vitest";
import { LEASE_ENDED, reconcile } from "./reconcile";
import type { RunnerContext } from "./types";
import { wakeDesk } from "./wake";

/**
 * C4d H2 (K-210): visitor A's live desk row (owner A, the pre-C4d address of party P) must never be reconciled, valued
 * or traded against visitor B's desk on the same recycled party P. Before C4d the runner found the mandate by address
 * alone, so A's row read, and could trade, B's desk.
 */
const VENUE = "venue::1220aa";
const P = "seat-7::1220bb";
const OWNER_A = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const iso = (sec: number) => new Date(sec * 1000).toISOString();

const bMandate = {
  venue: VENUE, owner: P, operator: "agent-runner::1220cc",
  grant: {
    venue: VENUE, owner: P, agent: "agent-runner::1220cc", caps: { maxStakePerTrade: "700000", maxDailySpend: "1000000", maxPriceTicks: "0", maxOpenPositions: "24" },
    budget: "2000000", expiresAt: iso(1_822_000_000), dayZero: iso(1_790_812_800), day: "0", spentToday: "0", positions: [],
  },
  allowList: [], maxPremiumBps: "500", attestors: [], refQuorum: "2", mode: "DeskLive", paused: false, head: "0".repeat(64), seq: "0", holdings: [],
};
const client = {
  activeContracts: async () => ({ activeAtOffset: 9, contracts: [{ createdEvent: { contractId: "00b1", templateId: AGENT_TEMPLATE_IDS.DeskMandate, createArgument: bMandate, offset: 5, "createdAt": iso(1_790_900_000) } }] }),
} as unknown as LedgerClient;

const deskA: DeskRow = {
  id: "11111111-1111-4111-8111-111111111111", address: legacyDeskAddressOf(P, VENUE), owner: OWNER_A, operator: "agent-runner::1220cc", cluster: "devnet", mode: "on_its_own", state: "active",
  stateReason: null, chainSeq: 0, chainHead: "0x", mandateVersion: 1, drawdownBaselineE6: null, lossBreaches: 0, practiceChecks: 0, recordOpenedAtSec: null, sharePublic: false, createdAtSec: 0, updatedAtSec: 0,
};

function ctxWith(leasePartyOf: (a: string) => Promise<string | null>, q: Record<string, unknown> = {}): RunnerContext {
  return {
    env: { cluster: "devnet" }, q: q as never, feed: { history: () => [] } as never, rpc: { endpoint: "ledger", ledger: { client, venue: VENUE, readAs: [VENUE], operator: null } },
    operator: null, ladders: async () => [], brain: null, brainMissing: "", callsAtMs: [], mints: { readAtSec: Number.MAX_SAFE_INTEGER, byMint: {} }, holding: new Set(), log: () => undefined, leasePartyOf,
  } as unknown as RunnerContext;
}

describe("the runner reconciles a live desk only under its owner's current lease (C4d H2)", () => {
  it("A's row, once A holds no lease, is ended, and nothing of B's desk is read into it", async () => {
    const r = await reconcile(ctxWith(async () => null), deskA, 1_790_950_000, () => undefined);
    expect(r.ended).toBe(LEASE_ENDED);
    expect(r.standing.kind).toBe("practice");
    expect(r.standing.cashE6).toBe(0n);
  });

  it("A's row, while A leases another party, never finds B's mandate on P", async () => {
    await expect(reconcile(ctxWith(async () => "seat-8::1220bc"), deskA, 1_790_950_000, () => undefined)).rejects.toThrow(/mandate was not found/);
  });

  it("a wake of such a row closes it and does nothing else", async () => {
    const setDeskState = vi.fn(async () => undefined);
    const finishWake = vi.fn(async () => undefined);
    const q = {
      currentMandate: async () => ({ version: 1, body: { preset: null, targets: { cashBps: 10_000, tokens: [] }, driftToleranceBps: 500, maxPositionBps: 5000, lossStopBps: 2000, maxPremiumBps: 500, notes: "", perActionCapE6: "1000000", dailyCapE6: "2000000", largeActionE6: "1000000" }, fingerprint: "", signer: "", signature: "", appliedAtSec: 0 }),
      setDeskState, finishWake, saveSnapshot: vi.fn(), appendRecord: vi.fn(),
    };
    const report = await wakeDesk(ctxWith(async () => null, q), { desk: deskA, trigger: "hour", wakeId: "w1" } as never);
    expect(report.status).toBe("skipped");
    expect(setDeskState).toHaveBeenCalledWith(expect.objectContaining({ deskId: deskA.id, state: "closed", reason: LEASE_ENDED }));
    expect(q.saveSnapshot).not.toHaveBeenCalled();
    expect(q.appendRecord).not.toHaveBeenCalled();
  });
});
