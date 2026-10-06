/**
 * C4g, found on DevNet: (1) the venue's own desk leg past `refundAfter` on a Window the resolver never finished in time
 * stayed open for good, its backing locked; the settler now takes the venue's stale refund, and only the venue's (a
 * seat's stale leg is the seat's; a book leg is the maker vault's). (2) While any leg's Window was unresolved, every 3 s
 * pass re-read every Resolution the venue ever had; now only once a leg's Window has passed its expiry.
 */
import { readFileSync } from "node:fs";
import { TEMPLATE_IDS } from "@agari/daml";
import type { CreatedEvent, JsTransaction, LedgerClient } from "@agari/ledger";
import { decodeTerms, type RoleSession } from "@agari/markets/ops/canton";
import { afterEach, describe, expect, it, vi } from "vitest";
import { settlerPass } from "./index";

const fixtures = JSON.parse(readFileSync(new URL("../projector/fixtures/lifecycle.json", import.meta.url), "utf8")) as Record<string, JsTransaction>;
const created = (step: string, template: string): CreatedEvent => {
  const e = fixtures[step]!.events.find((x) => "CreatedEvent" in x && x.CreatedEvent.templateId.endsWith(template));
  if (!e || !("CreatedEvent" in e)) throw new Error(`fixture ${step} has no ${template}`);
  return e.CreatedEvent;
};
const VENUE = "venue::1220";
const termsEvent = created("open-window", ":PM.Market:MarketTerms");
const terms = decodeTerms(termsEvent.createArgument);
const legEvent = created("accept", ":PM.Leg:Leg");
const leg = (cid: string, o: Record<string, unknown>): CreatedEvent => ({ ...legEvent, contractId: cid, createArgument: { ...(legEvent.createArgument as object), termsCid: termsEvent.contractId, ...o } });
const suffix = (t: string) => t.split(":").slice(1).join(":");

function world(contracts: CreatedEvent[]) {
  const reads: string[][] = [];
  const submitted: Array<{ commandId: string; commands: unknown[] }> = [];
  const logs: string[] = [];
  const client = {
    activeContracts: async (q: { templateIds?: string[] }) => {
      const want = (q.templateIds ?? []).map(suffix);
      reads.push(want);
      return { contracts: contracts.filter((c) => want.includes(suffix(c.templateId))).map((createdEvent) => ({ createdEvent, synchronizerId: "sync" })) };
    },
    http: { request: async () => ({ created: { createdEvent: termsEvent, synchronizerId: "sync" } }) },
    submitAndWaitForTransaction: async (req: { commandId: string; commands: unknown[] }) => {
      submitted.push(req);
      return { transaction: { updateId: "1220refund", offset: 9, effectiveAt: "", recordTime: "", synchronizerId: "sync", events: [] }, submissionId: "s", attempts: 1, recovered: false };
    },
  } as unknown as LedgerClient;
  const venue: RoleSession = { role: "venue", party: VENUE, client, dryRun: false };
  const st = {
    venue, deskCid: async () => "00desk", batchSize: 25, resolutions: new Map(), terms: new Map(),
    counters: { legs: 0, batches: 0, residuals: 0, failed: 0, stale: 0, venueRefunds: 0 }, timings: [], alarmed: new Set<string>(), log: (l: string) => logs.push(l),
  };
  return { st: st as unknown as Parameters<typeof settlerPass>[0], reads, submitted, logs, readResolutions: () => reads.some((r) => r.includes(suffix(TEMPLATE_IDS.Resolution))) };
}

describe("the settler and the venue's stale legs", () => {
  afterEach(() => vi.useRealTimers());

  it("takes the stale refund of the venue's own desk leg, never a seat's or the book's", async () => {
    vi.useFakeTimers({ now: (terms.expirySec + 3_600) * 1000 });
    const w = world([
      leg("00venueleg", { owner: VENUE, beneficiaryRef: null }),
      leg("00seatleg", { owner: "alice::1220" }),
      leg("00bookleg", { owner: VENUE, beneficiaryRef: "reserve:maker" }),
    ]);
    await settlerPass(w.st);
    expect(w.submitted.map((s) => s.commandId)).toEqual(["vstale:00venueleg"]);
    const sent = JSON.stringify(w.submitted[0]!.commands);
    expect(sent).toContain("Leg_RefundStale");
    expect(sent).toContain("00venueleg");
    // The alarm, when the Window is resolved, counts only the legs still unsettled: not the one just refunded.
    expect(w.logs.some((l) => l.startsWith("refunded the venue's own stale leg"))).toBe(true);
  });

  it("leaves a venue leg before its refundAfter alone", async () => {
    vi.useFakeTimers({ now: (terms.expirySec - 5) * 1000 });
    const w = world([leg("00venueleg", { owner: VENUE, beneficiaryRef: null, refundAfter: new Date((terms.expirySec + 600) * 1000).toISOString() })]);
    await settlerPass(w.st);
    expect(w.submitted).toEqual([]);
  });
});

describe("the settler reads Resolutions only once a leg's Window can have one", () => {
  afterEach(() => vi.useRealTimers());

  it("not while the Window is live", async () => {
    vi.useFakeTimers({ now: (terms.expirySec - 20) * 1000 });
    const w = world([leg("00seatleg", { owner: "alice::1220", refundAfter: new Date((terms.expirySec + 600) * 1000).toISOString() })]);
    await settlerPass(w.st);
    await settlerPass(w.st);
    expect(w.readResolutions()).toBe(false);
  });

  it("once it has passed its expiry", async () => {
    vi.useFakeTimers({ now: (terms.expirySec + 5) * 1000 });
    const w = world([leg("00seatleg", { owner: "alice::1220", refundAfter: new Date((terms.expirySec + 600) * 1000).toISOString() })]);
    await settlerPass(w.st);
    expect(w.readResolutions()).toBe(true);
  });
});
