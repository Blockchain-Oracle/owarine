import type { LedgerClient } from "@agari/ledger";
import { describe, expect, it, vi } from "vitest";
import { archivedByExercise } from "./history";

const ex = (offset: number, contractId: string, choice: string, consuming = true) => ({
  update: { Transaction: { value: { updateId: `u${offset}`, offset, effectiveAt: "", synchronizerId: "s", recordTime: "", events: [{ ExercisedEvent: { offset, nodeId: 0, contractId, templateId: "p:M:T", choice, choiceArgument: {}, actingParties: [], consuming, witnessParties: [], lastDescendantNodeId: 0, packageName: "x" } }] } } },
});

const clientOf = (pages: unknown[][]) => {
  const request = vi.fn(async () => pages.shift() ?? []);
  return { client: { http: { request } } as unknown as Pick<LedgerClient, "http">, request };
};

describe("who archived a transfer instruction (C7b; fake ledger)", () => {
  it("tells an accept from a reject and ignores what it cannot explain", async () => {
    const { client, request } = clientOf([[ex(11, "i1", "TransferInstruction_Accept"), ex(12, "i2", "TransferInstruction_Reject"), ex(13, "i3", "TransferInstruction_Withdraw"), ex(14, "i4", "TransferInstruction_Accept", false)]]);
    const found = await archivedByExercise({ client, venue: "venue::1" }, ["i1", "i2", "i3", "i4", "i5"], 10);
    expect([...found]).toEqual([["i1", "accepted"], ["i2", "rejected"]]);
    const [method, path, opts] = request.mock.calls[0] as unknown as [string, string, { json: { beginExclusive: number; updateFormat: unknown } }];
    expect([method, path, opts.json.beginExclusive]).toEqual(["POST", "/v2/updates", 10]);
    expect(JSON.stringify(opts.json.updateFormat)).toContain("TRANSACTION_SHAPE_LEDGER_EFFECTS");
  });

  it("continues past a full page and stops when everything is found or the ledger is read to its end", async () => {
    const { client, request } = clientOf([[ex(11, "a", "TransferInstruction_Accept"), ex(12, "x", "Other")], [ex(13, "b", "TransferInstruction_Reject")]]);
    const found = await archivedByExercise({ client, venue: "v", pageSize: 2 }, ["a", "b"], 0);
    expect(found.size).toBe(2);
    expect(request).toHaveBeenCalledTimes(2);
    const none = await archivedByExercise({ client: clientOf([[]]).client, venue: "v" }, [], 0);
    expect(none.size).toBe(0);
  });

  it("is bounded: a stale receipt cannot read the whole ledger", async () => {
    let offset = 0;
    const request = vi.fn(async () => [ex(++offset, "zz", "Other"), ex(++offset, "zz2", "Other")]);
    await archivedByExercise({ client: { http: { request } } as unknown as Pick<LedgerClient, "http">, venue: "v", pageSize: 2, maxPages: 3 }, ["never"], 0);
    expect(request).toHaveBeenCalledTimes(3);
  });
});
