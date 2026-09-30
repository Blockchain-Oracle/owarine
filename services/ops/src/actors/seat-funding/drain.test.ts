/**
 * C9d: a draining seat with nothing left to close out is recycled by ops' drain pass itself (it used to wait for the
 * web's lease route, which only looked when the pool was already full, so empty seats sat `draining`).
 */
import { describe, expect, it } from "vitest";
import { GAMES_TEMPLATE_IDS, TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import type { RecycleCheck, RecycleOutcome } from "@agari/db";
import type { ActiveContract, LedgerClient } from "@agari/ledger";
import type { RoleSession } from "@agari/markets/ops/canton";
import { createSeatDrainPass, sweepCommandId } from "./drain";

const VENUE = "venue::1220ff";
const SEAT = "agari-user-seat-1::1220aa";
const suffix = (t: string) => t.slice(t.indexOf(":"));

interface Fake {
  contracts: Array<{ templateId: string; cid: string; arg: Record<string, unknown>; stakeholders: string[] }>;
  submitted: Array<{ actAs: string[]; commandId: string; commands: unknown[]; disclosedContracts?: unknown[] }>;
}

function fakeVenue(fake: Fake): RoleSession {
  const client = {
    async activeContracts(o: { parties: string[]; templateIds: string[] }) {
      const want = new Set(o.templateIds.map(suffix));
      const contracts: ActiveContract[] = fake.contracts
        .filter((c) => want.has(suffix(c.templateId)) && c.stakeholders.some((p) => o.parties.includes(p)))
        .map((c) => ({ createdEvent: { templateId: c.templateId, contractId: c.cid, createArgument: c.arg, createdEventBlob: `blob-${c.cid}` }, synchronizerId: "sync" }) as unknown as ActiveContract);
      return { contracts, activeAtOffset: 1 };
    },
    async submitAndWaitForTransaction(o: { actAs: string[]; commandId: string; commands: Array<{ ExerciseCommand?: { contractId: string } }>; disclosedContracts?: unknown[] }) {
      fake.submitted.push(o);
      const archived = new Set(o.commands.map((c) => c.ExerciseCommand?.contractId));
      fake.contracts = fake.contracts.filter((c) => !archived.has(c.cid));
      return { transaction: { updateId: "u1", events: [] } };
    },
  } as unknown as LedgerClient;
  return { role: "venue", party: VENUE, client, dryRun: false };
}

/** The seat_pool row lock stand-in: one row per seat, freed when the check says so. */
function fakePool(states: Map<string, string>) {
  return async (party: string, _now: number, work: () => Promise<RecycleCheck>): Promise<RecycleOutcome> => {
    if (states.get(party) !== "draining") return { kind: "busy" };
    const check = await work();
    if (!check.free) return { kind: "held", why: check.why };
    states.set(party, "free");
    return { kind: "freed" };
  };
}

function setup(extra: Fake["contracts"] = []) {
  const fake: Fake = { contracts: [{ templateId: TEMPLATE_IDS.VenueCash, cid: "cash-1", arg: { venue: VENUE, owner: SEAT, amount: "998000000" }, stakeholders: [VENUE, SEAT] }, ...extra], submitted: [] };
  const states = new Map([[SEAT, "draining"]]);
  const logs: string[] = [];
  const draining = new Set<string>();
  const pass = createSeatDrainPass({ venue: fakeVenue(fake), pool: null, log: (l) => logs.push(l), seats: async () => (states.get(SEAT) === "draining" ? [SEAT] : []), draining, db: null, recycle: fakePool(states) });
  return { fake, states, logs, draining, pass };
}

describe("seat drain recycles (C9d)", () => {
  it("a draining seat that holds nothing has its cash withdrawn as the seat and is freed in the same pass", async () => {
    const s = setup();
    const r = await s.pass();
    expect(s.states.get(SEAT)).toBe("free");
    const sweep = s.fake.submitted.find((x) => x.commandId.startsWith("drain-sweep:"));
    expect(sweep).toMatchObject({ actAs: [SEAT], commandId: sweepCommandId(SEAT, ["cash-1"]) });
    expect(JSON.stringify(sweep!.commands)).toContain("VenueCash_Withdraw");
    expect(s.fake.contracts.some((c) => c.cid === "cash-1")).toBe(false);
    expect(r.why).toMatch(/freed 1/);
    expect(s.draining.has(SEAT)).toBe(false);
    // The next pass sees no seat draining.
    expect((await s.pass()).why).toMatch(/^no seat draining/);
  });

  it("a seat with an open leg stays draining (and keeps its cash) until the leg settles, then frees", async () => {
    const leg = { templateId: TEMPLATE_IDS.Leg, cid: "leg-1", arg: { venue: VENUE, owner: SEAT }, stakeholders: [VENUE, SEAT] };
    const s = setup([leg]);
    const r = await s.pass();
    expect(s.states.get(SEAT)).toBe("draining");
    expect(s.fake.submitted.filter((x) => x.commandId.startsWith("drain-sweep:"))).toHaveLength(0);
    expect(r.why).toContain("holds 1 leg");
    // The settler settles the leg (archives it): the next pass frees the seat.
    s.fake.contracts = s.fake.contracts.filter((c) => c.cid !== "leg-1");
    await s.pass();
    expect(s.states.get(SEAT)).toBe("free");
  });

  it("an open duel, ticket or Earn share each hold the seat", async () => {
    for (const [templateId, arg, word] of [
      [GAMES_TEMPLATE_IDS.DuelMatch, { creator: "other::1220bb", challenger: SEAT }, "1 duel"],
      [TICKET_TEMPLATE_IDS.RangeRound, { owner: SEAT }, "1 ticket"],
      [TEMPLATE_IDS.LpShare, { provider: SEAT, reserveId: "range", shares: "10" }, "1 Earn share"],
    ] as const) {
      const s = setup([{ templateId, cid: "h-1", arg: { venue: VENUE, ...arg }, stakeholders: [VENUE, SEAT] }]);
      const r = await s.pass();
      expect(s.states.get(SEAT)).toBe("draining");
      expect(r.why).toContain(word);
    }
  });

  it("a seat the web or another pass is already recycling is left alone", async () => {
    const s = setup();
    s.states.set(SEAT, "free");
    const pass = createSeatDrainPass({ venue: fakeVenue(s.fake), pool: null, log: () => undefined, seats: async () => [SEAT], db: null, recycle: fakePool(s.states) });
    await pass();
    expect(s.fake.submitted).toHaveLength(0);
  });

  it("a failed cash sweep leaves the seat draining (it is tried again next pass), and a dry run never frees", async () => {
    const s = setup();
    const venue = fakeVenue(s.fake);
    (venue.client as unknown as { submitAndWaitForTransaction: () => Promise<never> }).submitAndWaitForTransaction = async () => {
      throw new Error("sequencer busy");
    };
    const recycle = fakePool(s.states);
    const guarded = async (party: string, now: number, work: () => Promise<RecycleCheck>) => {
      try {
        return await recycle(party, now, work);
      } catch (error) {
        return { kind: "held" as const, why: String(error) };
      }
    };
    await createSeatDrainPass({ venue, pool: null, log: () => undefined, seats: async () => [SEAT], db: null, recycle: guarded })();
    expect(s.states.get(SEAT)).toBe("draining");

    const d = setup();
    const dry = { ...fakeVenue(d.fake), dryRun: true };
    const r = await createSeatDrainPass({ venue: dry, pool: null, log: () => undefined, seats: async () => [SEAT], db: null, recycle: fakePool(d.states) })();
    expect(d.states.get(SEAT)).toBe("draining");
    expect(r.why).toContain("DRY RUN");
  });

  it("offers the seat's Earn shares to the redeemer, and frees it once they are redeemed", async () => {
    const share = { templateId: TEMPLATE_IDS.LpShare, cid: "lp-1", arg: { venue: VENUE, provider: SEAT, reserveId: "range", shares: "42" }, stakeholders: [VENUE, SEAT] };
    const s = setup([share]);
    const asked: unknown[] = [];
    const pass = createSeatDrainPass({
      venue: fakeVenue(s.fake), pool: null, log: () => undefined, seats: async () => (s.states.get(SEAT) === "draining" ? [SEAT] : []), db: null, recycle: fakePool(s.states),
      redeemShares: () => async (seat, shares) => {
        asked.push({ seat, shares });
        s.fake.contracts = s.fake.contracts.filter((c) => c.cid !== "lp-1");
        return ["redeemed"];
      },
    });
    await pass();
    expect(asked).toEqual([{ seat: SEAT, shares: [{ cid: "lp-1", reserveId: "range", shares: 42n }] }]);
    // The read that found the share holds this pass; the next pass sees it gone and frees.
    expect(s.states.get(SEAT)).toBe("draining");
    await pass();
    expect(s.states.get(SEAT)).toBe("free");
  });

  it("exits a leg past its refundAfter as the seat: a claim against the resolution, else a stale refund, then frees", async () => {
    const legArg = (cid: string, terms: string) => ({
      venue: VENUE, owner: SEAT, termsCid: terms, marketId: `BTC-60m:${cid}`, pairId: "p", outcome: "SideUp", lots: "10", cashUnit: "1000",
      backingShare: "5000", feePaid: "100", refundAfter: "2026-09-29T20:06:00Z", beneficiaryRef: null,
    });
    const s = setup([
      { templateId: TEMPLATE_IDS.Leg, cid: "leg-resolved", arg: legArg("1", "terms-1"), stakeholders: [VENUE, SEAT] },
      { templateId: TEMPLATE_IDS.Leg, cid: "leg-void", arg: legArg("2", "terms-2"), stakeholders: [VENUE, SEAT] },
      { templateId: TEMPLATE_IDS.Resolution, cid: "res-1", arg: { venue: VENUE, termsCid: "terms-1" }, stakeholders: [VENUE] },
    ]);
    await s.pass();
    const exits = s.fake.submitted.filter((x) => x.commandId.startsWith("drain-exit:"));
    expect(exits.map((x) => [x.actAs[0], JSON.stringify(x.commands).match(/Leg_(Claim|RefundStale)/)?.[0]])).toEqual([
      [SEAT, "Leg_Claim"],
      [SEAT, "Leg_RefundStale"],
    ]);
    expect(exits[0]!.disclosedContracts).toEqual([{ createdEventBlob: "blob-res-1", templateId: TEMPLATE_IDS.Resolution, contractId: "res-1", synchronizerId: "sync" }]);
    // Both legs are gone, so the same pass frees the seat.
    expect(s.states.get(SEAT)).toBe("free");
  });
});

