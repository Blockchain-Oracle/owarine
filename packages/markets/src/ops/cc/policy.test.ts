import { describe, expect, it } from "vitest";
import type { AllowanceC, HoldingViewC, ListingC, ProposalC, WithdrawalC } from "./decode";
import { allowanceFor, planMerges, type Row } from "./allowances";
import { coverCash, coverHoldings, planDeposits, planInFlight, planWithdrawals, type CashRow, type InstructionRow } from "./policy";
import { planAttest, unlockedHoldings, type HoldingRow } from "./reserve";

const VENUE = "venue::1";
const ADMIN = "dso::1";
const ALICE = "alice::1";
const BOB = "bob::1";
const RATE = 100_000n; // one cash unit = 10^5 atomic

const listing: ListingC = {
  venue: VENUE, auditor: "auditor::1", listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE,
  minDepositUnits: 100n, maxDepositUnits: 100_000_000_000n, depositsOpen: true,
};

const instruction = (cid: string, o: Partial<InstructionRow["view"]> & { signatories?: string[]; offset?: number; templateId?: string } = {}): InstructionRow => {
  const { signatories, offset, templateId, ...view } = o;
  return {
    cid,
    templateId: templateId ?? "pkgA:Splice.Amulet:AmuletTransferInstruction",
    signatories: signatories ?? [ALICE, ADMIN],
    createdOffset: offset ?? 100,
    view: {
      status: "PendingReceiverAcceptance", sender: ALICE, receiver: VENUE, instrumentAdmin: ADMIN, instrumentId: "Amulet",
      amountAtomic: 125_000_000_000n, requestedAtSec: 1_000, executeBeforeSec: 5_000, meta: {}, ...view,
    },
  };
};

const base = {
  venue: VENUE, listing, accounts: new Map([[ALICE, "acct-a"], [BOB, "acct-b"]]), allowances: [] as Row<AllowanceC>[], nowSec: 2_000,
};

describe("planDeposits (C7b)", () => {
  it("settles a genuine, exact, in-bounds transfer and names the owner's allowance", () => {
    const allowance: Row<AllowanceC> = { cid: "al-a", data: { venue: VENUE, auditor: "a", owner: ALICE, listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE, units: 5n } };
    const [p] = planDeposits({ ...base, instructions: [instruction("i1")], allowances: [allowance] });
    expect(p).toMatchObject({ kind: "settle", instructionCid: "i1", owner: ALICE, accountCid: "acct-a", allowanceCid: "al-a", units: 1_250_000n });
  });

  it("credits exactly what the transfer is worth, never a rounded figure", () => {
    const [p] = planDeposits({ ...base, instructions: [instruction("i1", { amountAtomic: 100_000n * 12_345n })] });
    expect(p).toMatchObject({ kind: "settle", units: 12_345n });
  });

  it("rejects dust back to the sender: 1.000001 coin is 10 units and a tenth", () => {
    const [p] = planDeposits({ ...base, instructions: [instruction("i1", { amountAtomic: 10_000_010_000n })] });
    expect(p).toMatchObject({ kind: "reject", reason: "dust", owner: ALICE });
  });

  it("rejects out-of-bounds amounts", () => {
    const [low] = planDeposits({ ...base, instructions: [instruction("lo", { amountAtomic: 99n * 100_000n })] });
    expect(low).toMatchObject({ kind: "reject", reason: "below-minimum" });
    const [high] = planDeposits({ ...base, instructions: [instruction("hi", { amountAtomic: 100_000_000_001n * 100_000n })] });
    expect(high).toMatchObject({ kind: "reject", reason: "above-maximum" });
  });

  it("never touches an instruction the registry did not sign (a look-alike template)", () => {
    const [p] = planDeposits({ ...base, instructions: [instruction("fake", { signatories: [ALICE, "attacker::1"] })] });
    expect(p).toMatchObject({ kind: "hold", reason: "forged" });
  });

  it("checks the template's package against the allow-list when there is one", () => {
    const ok = planDeposits({ ...base, instructions: [instruction("i1")], allowedPackageIds: ["pkgA"] });
    expect(ok[0]?.kind).toBe("settle");
    const no = planDeposits({ ...base, instructions: [instruction("i1", { templateId: "pkgZ:X:Y" })], allowedPackageIds: ["pkgA"] });
    expect(no[0]).toMatchObject({ kind: "hold", reason: "package-not-allowed" });
  });

  it("leaves other instruments, other receivers and non-pending transfers alone", () => {
    const plans = planDeposits({
      ...base,
      instructions: [
        instruction("other-token", { instrumentId: "Other" }),
        instruction("to-bob", { receiver: BOB }),
        instruction("wf", { status: "PendingInternalWorkflow" }),
      ],
    });
    expect(plans.map((p) => (p.kind === "hold" ? p.reason : p.kind))).toEqual(["not-a-listing-transfer", "not-to-venue", "not-pending"]);
  });

  it("holds a transfer whose sender has no venue account yet, and rejects an expired one", () => {
    const [noAcct] = planDeposits({ ...base, accounts: new Map(), instructions: [instruction("i1")] });
    expect(noAcct).toMatchObject({ kind: "hold", reason: "no-account" });
    const [late] = planDeposits({ ...base, instructions: [instruction("i1", { executeBeforeSec: 1_999 })] });
    expect(late).toMatchObject({ kind: "reject", reason: "expired" });
  });

  it("holds, never rejects, the coin of a seat that was leased again since the transfer (K-224): a reject would hand it to the new visitor", () => {
    const leaseOf = (p: string) => (p === ALICE ? { startOffset: 500 } : null);
    const [stale] = planDeposits({ ...base, leaseOf, instructions: [instruction("i1", { offset: 400 })] });
    expect(stale).toMatchObject({ kind: "hold", reason: "stale-lease" });
    const [fresh] = planDeposits({ ...base, leaseOf, instructions: [instruction("i2", { offset: 600 })] });
    expect(fresh?.kind).toBe("settle");
  });

  it("holds when leases cannot be read at all, instead of turning every deposit away", () => {
    const [gone] = planDeposits({ ...base, leaseOf: () => null, instructions: [instruction("i3")] });
    expect(gone).toMatchObject({ kind: "hold", reason: "no-lease" });
  });

  it("spends no reject on a sender with no venue account: a flood of dust from strangers costs the venue nothing", () => {
    const plans = planDeposits({
      ...base, accounts: new Map(),
      instructions: [instruction("d1", { sender: "stranger::1", amountAtomic: 1n }), instruction("d2", { sender: "stranger::1", executeBeforeSec: 1 }), instruction("d3", { sender: "stranger::2", amountAtomic: 99n * 100_000n })],
    });
    expect(plans.every((p) => p.kind === "hold" && p.reason === "no-account")).toBe(true);
  });

  it("rejects everything while the listing is closed", () => {
    const [p] = planDeposits({ ...base, listing: { ...listing, depositsOpen: false }, instructions: [instruction("i1")] });
    expect(p).toMatchObject({ kind: "reject", reason: "listing-closed" });
  });

  it("settles one instruction per owner per pass (the allowance moves with the first)", () => {
    const plans = planDeposits({ ...base, instructions: [instruction("a1"), instruction("a2"), instruction("b1", { sender: BOB })] });
    expect(plans.filter((p) => p.kind === "settle").map((p) => p.instructionCid)).toEqual(["a1", "b1"]);
  });
});

const proposal = (cid: string, units: bigint, o: Partial<ProposalC> & { offset?: number } = {}): Row<ProposalC> & { createdOffset: number } => {
  const { offset, ...rest } = o;
  return {
    cid, createdOffset: offset ?? 100,
    data: { owner: ALICE, venue: VENUE, listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE, units, validUntilSec: 9_999, ref: `r-${cid}`, ...rest },
  };
};
const allowanceOf = (owner: string, units: bigint, o: Partial<AllowanceC> = {}): Row<AllowanceC> => ({
  cid: `al-${owner}${o.listingId ? `-${o.listingId}` : ""}${o.units ? "x" : ""}`,
  data: { venue: VENUE, auditor: "a", owner, listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE, units, ...o },
});
const holding = (cid: string, atomic: bigint, o: Partial<HoldingViewC> = {}, signatories: string[] = [VENUE, ADMIN]): HoldingRow => ({
  cid, templateId: "pkgA:Splice.Amulet:Amulet", signatories, view: { owner: VENUE, instrumentAdmin: ADMIN, instrumentId: "Amulet", amountAtomic: atomic, lock: null, meta: {}, ...o },
});
const cash = (cid: string, owner: string, amount: bigint): CashRow => ({ cid, owner, amount });
const wbase = { venue: VENUE, listing, accounts: base.accounts, nowSec: 2_000 };

describe("planWithdrawals (C7b)", () => {
  it("accepts a covered withdrawal and picks exact inputs", () => {
    const [p] = planWithdrawals({
      ...wbase, proposals: [proposal("p1", 400_000n)], allowances: [allowanceOf(ALICE, 1_000_000n)], cash: [cash("c1", ALICE, 1_000_000n)],
      holdings: [holding("h1", 100_000_000_000n)],
    });
    expect(p).toMatchObject({ kind: "accept", owner: ALICE, units: 400_000n, cashCids: ["c1"], allowanceCid: "al-alice::1", inputHoldingCids: ["h1"], amount: "4.0000000000" });
  });

  it("declines what the owner did not deposit, and what their cash does not cover", () => {
    const over = planWithdrawals({ ...wbase, proposals: [proposal("p1", 1_500_000n)], allowances: [allowanceOf(ALICE, 1_000_000n)], cash: [cash("c1", ALICE, 2_000_000n)], holdings: [holding("h1", 10n ** 12n)] });
    expect(over[0]).toMatchObject({ kind: "decline" });
    const none = planWithdrawals({ ...wbase, proposals: [proposal("p1", 1n)], allowances: [], cash: [cash("c1", ALICE, 5n)], holdings: [holding("h1", 10n ** 12n)] });
    expect(none[0]).toMatchObject({ kind: "decline" });
    const poor = planWithdrawals({ ...wbase, proposals: [proposal("p1", 500_000n)], allowances: [allowanceOf(ALICE, 1_000_000n)], cash: [cash("c1", ALICE, 100_000n)], holdings: [holding("h1", 10n ** 12n)] });
    expect(poor[0]).toMatchObject({ kind: "decline", reason: "the seat's cash does not cover this withdrawal" });
  });

  it("uses only the owner's own cash", () => {
    const [p] = planWithdrawals({
      ...wbase, proposals: [proposal("p1", 100_000n)], allowances: [allowanceOf(ALICE, 100_000n)], cash: [cash("bobs", BOB, 10n ** 9n)], holdings: [holding("h1", 10n ** 12n)],
    });
    expect(p?.kind).toBe("decline");
  });

  it("holds (never declines) when the venue lacks coin in hand or the owner has no account", () => {
    const short = planWithdrawals({ ...wbase, proposals: [proposal("p1", 1_000_000n)], allowances: [allowanceOf(ALICE, 1_000_000n)], cash: [cash("c1", ALICE, 1_000_000n)], holdings: [holding("h1", 10n ** 9n)] });
    expect(short[0]).toMatchObject({ kind: "hold" });
    const noAcct = planWithdrawals({ ...wbase, accounts: new Map(), proposals: [proposal("p1", 1n)], allowances: [allowanceOf(ALICE, 1n)], cash: [cash("c1", ALICE, 1n)], holdings: [holding("h1", 10n ** 12n)] });
    expect(noAcct[0]).toMatchObject({ kind: "hold" });
  });

  it("never reserves the same coin or the same allowance twice in one pass", () => {
    const plans = planWithdrawals({
      ...wbase, proposals: [proposal("p1", 100_000n), proposal("p2", 100_000n, { owner: BOB }), proposal("p3", 50_000n)],
      allowances: [allowanceOf(ALICE, 300_000n), allowanceOf(BOB, 300_000n)],
      cash: [cash("ca", ALICE, 300_000n), cash("cb", BOB, 300_000n)],
      holdings: [holding("h1", 100_000n * 100_000n), holding("h2", 100_000n * 100_000n)],
    });
    expect(plans.map((p) => p.kind)).toEqual(["accept", "accept", "hold"]);
    const [a, b] = plans;
    expect(a && b && a.kind === "accept" && b.kind === "accept" && a.inputHoldingCids[0] !== b.inputHoldingCids[0]).toBe(true);
  });

  it("does not honour a proposal from before the seat's current lease (K-224), and holds when leases cannot be read", () => {
    const [p] = planWithdrawals({ ...wbase, leaseOf: () => ({ startOffset: 500 }), proposals: [proposal("p1", 1n, { offset: 400 })], allowances: [allowanceOf(ALICE, 1n)], cash: [cash("c1", ALICE, 1n)], holdings: [holding("h1", 10n ** 12n)] });
    expect(p).toMatchObject({ kind: "decline" });
    const [none] = planWithdrawals({ ...wbase, leaseOf: () => null, proposals: [proposal("p1", 1n)], allowances: [allowanceOf(ALICE, 1n)], cash: [cash("c1", ALICE, 1n)], holdings: [holding("h1", 10n ** 12n)] });
    expect(none).toMatchObject({ kind: "hold" });
  });

  it("declines an ask that has lapsed, and one signed against terms the listing no longer states", () => {
    const base = { ...wbase, allowances: [allowanceOf(ALICE, 100n)], cash: [cash("c1", ALICE, 100n)], holdings: [holding("h1", 10n ** 12n)] };
    const [late] = planWithdrawals({ ...base, proposals: [proposal("p1", 1n, { validUntilSec: 2_000 })] });
    expect(late).toMatchObject({ kind: "decline", reason: "the ask has lapsed" });
    const [rate] = planWithdrawals({ ...base, proposals: [proposal("p2", 1n, { unitsPerCoin: 1_000_000n })] });
    expect(rate).toMatchObject({ kind: "decline" });
    const [inst] = planWithdrawals({ ...base, proposals: [proposal("p3", 1n, { instrumentId: "Other" })] });
    expect(inst).toMatchObject({ kind: "decline" });
  });

  it("spends only an allowance made under the listing's terms, and holds while an owner's allowance is in pieces", () => {
    const other = allowanceOf(ALICE, 9_999n, { unitsPerCoin: 1_000_000n, listingId: "cc-1" });
    const [wrong] = planWithdrawals({ ...wbase, proposals: [proposal("p1", 10n)], allowances: [other], cash: [cash("c1", ALICE, 100n)], holdings: [holding("h1", 10n ** 12n)] });
    expect(wrong).toMatchObject({ kind: "decline" });
    const pieces = [allowanceOf(ALICE, 60n, { listingId: "cc-1" }), { ...allowanceOf(ALICE, 50n), cid: "al-second" }];
    const [split] = planWithdrawals({ ...wbase, proposals: [proposal("p2", 100n)], allowances: pieces, cash: [cash("c1", ALICE, 500n)], holdings: [holding("h1", 10n ** 12n)] });
    expect(split).toMatchObject({ kind: "hold" });
    expect(allowanceFor(pieces, ALICE, listing)?.data.units).toBe(60n);
    expect(planMerges(pieces, listing)).toEqual([{ keep: pieces[0]!.cid, others: ["al-second"] }]);
    expect(planMerges([pieces[0]!], listing)).toEqual([]);
  });

  it("declines a withdrawal outside the rail's bounds", () => {
    const [p] = planWithdrawals({ ...wbase, proposals: [proposal("p1", 10n ** 15n)], allowances: [allowanceOf(ALICE, 10n ** 15n)], cash: [cash("c1", ALICE, 10n ** 15n)], holdings: [holding("h1", 10n ** 17n)] });
    expect(p).toMatchObject({ kind: "decline", reason: "the amount is outside the rail's bounds" });
  });
});

describe("coverHoldings and coverCash", () => {
  it("cover fewest-and-largest first and refuse what they cannot cover", () => {
    const hs = [holding("s", 10n), holding("l", 100n), holding("m", 50n)];
    expect(coverHoldings(hs, 120n)?.map((h) => h.cid)).toEqual(["l", "m"]);
    expect(coverHoldings(hs, 161n)).toBeNull();
    expect(coverHoldings(hs, 120n, 1)).toBeNull();
    expect(coverCash([cash("a", ALICE, 3n), cash("b", ALICE, 9n)], 9n)?.map((c) => c.cid)).toEqual(["b"]);
    expect(coverCash([cash("a", ALICE, 3n)], 4n)).toBeNull();
  });
});

const withdrawal = (cid: string, o: Partial<WithdrawalC> = {}): Row<WithdrawalC> => ({
  cid, data: {
    venue: VENUE, owner: ALICE, listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE, units: 100n, sentAtomic: 10_000_000n,
    state: "WdSent", instructionCid: `i-${cid}`, openedAtSec: 1_000, ref: "r", ...o,
  },
});

describe("planInFlight (C7b)", () => {
  const common = { accounts: base.accounts, allowances: [] as Row<AllowanceC>[], refundAfterSec: 3_600, nowSec: 2_000, listing };

  it("waits on a live transfer inside its window and takes it back after", () => {
    const w = withdrawal("w1");
    const early = planInFlight({ ...common, withdrawals: [w], liveInstructions: new Map([["i-w1", { executeBeforeSec: 9_000 }]]), archivedBy: () => "unknown" });
    expect(early[0]).toMatchObject({ kind: "wait" });
    const late = planInFlight({ ...common, nowSec: 9_001, withdrawals: [w], liveInstructions: new Map([["i-w1", { executeBeforeSec: 9_000 }]]), archivedBy: () => "unknown" });
    expect(late[0]).toMatchObject({ kind: "refund", accountCid: "acct-a" });
    const old = planInFlight({ ...common, nowSec: 5_000, withdrawals: [w], liveInstructions: new Map([["i-w1", { executeBeforeSec: 99_000 }]]), archivedBy: () => "unknown" });
    expect(old[0]).toMatchObject({ kind: "refund" });
  });

  it("records a transfer the owner accepted, alerts on one they rejected elsewhere, and never guesses", () => {
    const w = withdrawal("w1");
    const args = { ...common, withdrawals: [w], liveInstructions: new Map() };
    expect(planInFlight({ ...args, archivedBy: () => "accepted" })[0]).toMatchObject({ kind: "complete" });
    // rejected outside the receipt: an alert only, nothing is refunded on the venue's word
    const orphan = planInFlight({ ...args, archivedBy: () => "rejected" })[0];
    expect(orphan).toMatchObject({ kind: "orphan" });
    expect(orphan).not.toHaveProperty("accountCid");
    expect(planInFlight({ ...args, archivedBy: () => "unknown" })[0]).toMatchObject({ kind: "wait" });
  });

  it("ignores settled withdrawals", () => {
    const done = withdrawal("w1", { state: "WdCompleted", instructionCid: null });
    expect(planInFlight({ ...common, withdrawals: [done], liveInstructions: new Map(), archivedBy: () => "accepted" })).toEqual([]);
  });
});

describe("planAttest and unlockedHoldings (C7b)", () => {
  it("counts only the venue's unlocked, registry-signed holdings of the instrument, against every allowance of the instrument, and floors the assets", () => {
    const plan = planAttest({
      venue: VENUE, listing,
      holdings: [
        holding("h1", 100_000_000_000n), holding("locked", 5n, { lock: { holders: [VENUE], expiresAtSec: null, context: null } }),
        holding("other", 7n, { instrumentId: "Other" }), holding("alices", 9n, { owner: ALICE }), holding("dust", 99_999n),
        holding("fake", 10n ** 18n, {}, [VENUE, "attacker::1"]),
      ],
      allowances: [allowanceOf(ALICE, 600_000n), allowanceOf(BOB, 400_000n), allowanceOf(BOB, 9n, { instrumentId: "Other" })],
    });
    expect(plan.holdingCids).toEqual(["h1", "dust"]);
    expect(plan.allowanceCids).toEqual(["al-alice::1", "al-bob::1"]);
    expect(plan.heldAtomic).toBe(100_000_099_999n);
    expect(plan.heldUnits).toBe(1_000_000n);
    expect(plan.liabilityAtomic).toBe(1_000_000n * 100_000n);
    expect(plan.liabilityUnits).toBe(1_000_000n);
    expect(plan.covered).toBe(true);
  });

  it("counts the allowances of every listing of the instrument, each at its own rate: two listings share one pool", () => {
    const second = allowanceOf(BOB, 10_000_000n, { listingId: "cc-2", unitsPerCoin: 1_000_000n });
    const plan = planAttest({ venue: VENUE, listing, holdings: [holding("h1", 100n * 10n ** 10n)], allowances: [allowanceOf(ALICE, 100n * 100_000n), second] });
    // alice: 10,000,000 units at 10^5 atomic each = 100 coin; bob: 10,000,000 units at 10^4 atomic each = 10 coin; the pool holds 100
    expect(plan.liabilityAtomic).toBe(110n * 10n ** 10n);
    expect(plan.covered).toBe(false);
    expect(plan.allowanceCids).toHaveLength(2);
  });

  it("rounds owed units UP and held units DOWN, so a statement never flatters the venue", () => {
    const plan = planAttest({ venue: VENUE, listing: { ...listing }, holdings: [holding("h1", 199_999n)], allowances: [allowanceOf(ALICE, 1n, { unitsPerCoin: 1_000_000n })] });
    expect(plan.heldUnits).toBe(1n);
    expect(plan.liabilityAtomic).toBe(10_000n);
    expect(plan.liabilityUnits).toBe(1n);
  });

  it("reports a shortfall rather than hiding it", () => {
    const plan = planAttest({ venue: VENUE, listing, holdings: [holding("h1", 100n * 100_000n)], allowances: [allowanceOf(ALICE, 101n)] });
    expect(plan.covered).toBe(false);
  });

  it("honours a package allow-list for holdings too", () => {
    const hs = [holding("ok", 5n), { ...holding("bad", 5n), templateId: "pkgZ:X:Y" }];
    expect(unlockedHoldings(VENUE, listing, hs, ["pkgA"]).map((h) => h.cid)).toEqual(["ok"]);
    expect(unlockedHoldings(VENUE, listing, hs).map((h) => h.cid)).toEqual(["ok", "bad"]);
  });
});
