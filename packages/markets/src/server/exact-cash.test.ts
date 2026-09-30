import { TEMPLATE_IDS } from "@agari/daml";
import type { Command } from "@agari/ledger";
import { describe, expect, it } from "vitest";
import { exactCash, type ExactCashDeps } from "./exact-cash";

const SEAT = "seat-1::1220cdef01";
const V = "venue::1220abcdef";

/** A seat's cash that the fake ledger splits and merges exactly as `VenueCash_Split` / `VenueCash_Merge` do. */
function ledger(initial: bigint[]) {
  let n = 0;
  let cash = initial.map((amount) => ({ cid: `c${n++}`, amount }));
  const sent: { commandId: string; choice: string }[] = [];
  const created = (cid: string, amount: bigint) => ({
    CreatedEvent: { contractId: cid, templateId: TEMPLATE_IDS.VenueCash, createArgument: { venue: V, owner: SEAT, amount: amount.toString(), bucket: "seat" } },
  });
  const deps: ExactCashDeps = {
    cashOf: async () => cash,
    client: {
      submitAndWaitForTransaction: async (req: { commandId: string; commands: Command[] }) => {
        const cmd = req.commands[0] as unknown as { ExerciseCommand: { contractId: string; choice: string; choiceArgument: Record<string, unknown> } };
        const { contractId, choice, choiceArgument } = cmd.ExerciseCommand;
        sent.push({ commandId: req.commandId, choice });
        const src = cash.find((c) => c.cid === contractId)!;
        const events: unknown[] = [];
        if (choice === "VenueCash_Split") {
          const take = BigInt(choiceArgument.take as string);
          const part = { cid: `c${n++}`, amount: take };
          const change = { cid: `c${n++}`, amount: src.amount - take };
          cash = [...cash.filter((c) => c !== src), part, ...(change.amount > 0n ? [change] : [])];
          events.push(created(part.cid, part.amount), ...(change.amount > 0n ? [created(change.cid, change.amount)] : []));
        } else {
          const others = choiceArgument.others as string[];
          const total = cash.filter((c) => c === src || others.includes(c.cid)).reduce((s, c) => s + c.amount, 0n);
          const merged = { cid: `c${n++}`, amount: total };
          cash = [...cash.filter((c) => c !== src && !others.includes(c.cid)), merged];
          events.push(created(merged.cid, merged.amount));
        }
        return { transaction: { events } } as never;
      },
    } as ExactCashDeps["client"],
  };
  return { deps, sent, total: () => cash.reduce((s, c) => s + c.amount, 0n), amountOf: (cid: string) => cash.find((c) => c.cid === cid)?.amount };
}

describe("exact cash before a whole-value choice (C8g: a 1-credit grant top-up moved 995.50)", () => {
  it("splits the seat's one big contract so the top-up hands over exactly the amount", async () => {
    const l = ledger([995_500_000n]);
    const cid = await exactCash(l.deps, SEAT, "j1", 1_000_000n, "grant", "the top-up");
    expect(l.amountOf(cid)).toBe(1_000_000n);
    expect(l.total()).toBe(995_500_000n);
    expect(l.sent).toEqual([{ commandId: "grantsplit:j1", choice: "VenueCash_Split" }]);
  });

  it("uses an exact contract as it is, with no command", async () => {
    const l = ledger([5_000_000n, 1_000_000n]);
    const cid = await exactCash(l.deps, SEAT, "j2", 1_000_000n, "grant");
    expect(l.amountOf(cid)).toBe(1_000_000n);
    expect(l.sent).toEqual([]);
  });

  it("splits the smallest contract above the amount, not the largest", async () => {
    const l = ledger([900_000_000n, 3_000_000n]);
    const cid = await exactCash(l.deps, SEAT, "j3", 2_000_000n, "grant");
    expect(l.amountOf(cid)).toBe(2_000_000n);
    expect(l.amountOf("c0")).toBe(900_000_000n);
  });

  it("merges first when no single contract covers the amount, then splits; the seat's total never changes", async () => {
    const l = ledger([3_000_000n, 2_000_000n, 1_500_000n]);
    const cid = await exactCash(l.deps, SEAT, "j4", 4_000_000n, "desk", "the deposit");
    expect(l.amountOf(cid)).toBe(4_000_000n);
    expect(l.total()).toBe(6_500_000n);
    expect(l.sent.map((s) => s.commandId)).toEqual(["deskmerge:j4", "desksplit:j4"]);
  });

  it("refuses what the seat cannot cover, and a non-positive amount, without a command", async () => {
    const l = ledger([1_000_000n]);
    await expect(exactCash(l.deps, SEAT, "j5", 2_000_000n, "grant")).rejects.toMatchObject({ diagnosis: { kind: "insufficient-collateral" } });
    await expect(exactCash(l.deps, SEAT, "j6", 0n, "grant")).rejects.toMatchObject({ diagnosis: { kind: "invalid-price" } });
    expect(l.sent).toEqual([]);
  });
});
