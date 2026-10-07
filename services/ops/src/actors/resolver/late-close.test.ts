/**
 * C4g: a resolver that reaches a Window after its close deadline. On Noders DevNet, from this Mac's slow link, the close
 * quorum was on the ledger in time but the resolver's pass came after `closeDeadline`: `Terms_Resolve` is then refused
 * by the ledger, and the resolver sent nothing else, so the Window stayed open for good (BTC-1m:338 held a seat's leg
 * past its close with no Resolution). It must void it (AfterOpen), naming the quotes, and never try to resolve it.
 */
import { readFileSync } from "node:fs";
import { TEMPLATE_IDS } from "@owarine/daml";
import type { CreatedEvent, JsTransaction, LedgerClient } from "@owarine/ledger";
import { decodeTerms, type RoleSession, type TermsC } from "@owarine/markets/ops/canton";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolverPass } from "./index";

const fixtures = JSON.parse(readFileSync(new URL("../projector/fixtures/lifecycle.json", import.meta.url), "utf8")) as Record<string, JsTransaction>;
const created = (step: string, template: string): CreatedEvent => {
  const e = fixtures[step]!.events.find((x) => "CreatedEvent" in x && x.CreatedEvent.templateId.endsWith(template));
  if (!e || !("CreatedEvent" in e)) throw new Error(`fixture ${step} has no ${template}`);
  return e.CreatedEvent;
};
const termsEvent = created("open-window", ":PM.Market:MarketTerms");
const terms: TermsC = decodeTerms(termsEvent.createArgument);
const openPrint = created("record-open", ":PM.Market:OpenPrint");
const voidResolution = created("resolve-void", ":PM.Market:Resolution");
const iso = (sec: number) => new Date(sec * 1000).toISOString().replace(".000Z", "Z");

/** Three oracles' close prints, fetched inside the close admission: a quorum the ledger counts. */
const closePrints: CreatedEvent[] = terms.oracles.map((oracle, i) => ({
  ...openPrint, contractId: `00close${i}`, templateId: TEMPLATE_IDS.PriceQuote,
  createArgument: {
    oracle, venue: terms.venue, resolver: terms.resolver, symbol: terms.symbol, boundaryT: iso(terms.expirySec), priceE8: String(6_010_000_000_000 + i),
    barStart: iso(terms.expirySec - terms.barLenSec), barLenSec: String(terms.barLenSec), fetchedAt: iso(terms.expirySec + terms.minDelaySec + 1),
    payloadHash: `sha256:close-${i}`, policyVersion: String(terms.policyVersion),
  },
}));

function world() {
  const submitted: Array<{ commandId: string; commands: unknown[] }> = [];
  const client = {
    activeContracts: async (q: { templateIds?: string[] }) => {
      const want = new Set((q.templateIds ?? []).map((t) => t.split(":").slice(1).join(":")));
      const all = [{ ...openPrint, createArgument: { ...(openPrint.createArgument as object), termsCid: termsEvent.contractId } }, ...closePrints];
      return { contracts: all.filter((c) => want.has(c.templateId.split(":").slice(1).join(":"))).map((createdEvent) => ({ createdEvent, synchronizerId: "sync" })) };
    },
    submitAndWaitForTransaction: async (req: { commandId: string; commands: unknown[] }) => {
      submitted.push(req);
      const resolution = { ...voidResolution, createArgument: { ...(voidResolution.createArgument as object), termsCid: termsEvent.contractId, voidReason: { tag: "ResolverAbsent", value: { slot: "CloseSlot" } } } };
      const transaction = { updateId: "1220void", offset: 9, effectiveAt: "", recordTime: "", synchronizerId: "sync", events: [{ CreatedEvent: resolution }] };
      return { transaction, submissionId: "s", attempts: 1, recovered: false };
    },
  } as unknown as LedgerClient;
  const session: RoleSession = { role: "resolver", party: terms.resolver, client, dryRun: false };
  const logs: string[] = [];
  const state = {
    session, terms: new Map([[termsEvent.contractId, terms]]), finished: new Set<string>(), awaiting: new Map(), quotes: new Map(), inFlight: new Set<string>(),
    counters: { recordedOpen: 0, resolved: 0, voided: 0, failed: 0, eventsResolved: 0, eventsVoided: 0 }, log: (l: string) => logs.push(l),
  };
  return { state: state as unknown as Parameters<typeof resolverPass>[0], submitted, logs };
}

describe("the resolver past a Window's close deadline", () => {
  afterEach(() => vi.useRealTimers());

  it("resolves while the close deadline holds", async () => {
    vi.useFakeTimers({ now: (terms.closeDeadlineSec - 5) * 1000 });
    const w = world();
    await resolverPass(w.state);
    expect(w.submitted.map((s) => JSON.stringify(s.commands))).toEqual([expect.stringContaining("Terms_Resolve")]);
  });

  it("waits out the void margin just after the deadline, sending nothing", async () => {
    vi.useFakeTimers({ now: (terms.closeDeadlineSec + 1) * 1000 });
    const w = world();
    await resolverPass(w.state);
    expect(w.submitted).toEqual([]);
  });

  it("voids it (AfterOpen, offering the quorum it found) once past the margin, and never tries Terms_Resolve", async () => {
    vi.useFakeTimers({ now: (terms.closeDeadlineSec + 30) * 1000 });
    const w = world();
    await resolverPass(w.state);
    expect(w.submitted).toHaveLength(1);
    const sent = JSON.stringify(w.submitted[0]!.commands);
    expect(sent).toContain("Terms_Void");
    expect(sent).toContain("AfterOpen");
    expect(sent).not.toContain("Terms_Resolve");
    for (const q of closePrints) expect(sent).toContain(q.contractId);
    expect(w.logs.some((l) => /voided .*ResolverAbsent\(CloseSlot\)/.test(l))).toBe(true);
    // The Window is finished: the next pass sends nothing more for it.
    await resolverPass(w.state);
    expect(w.submitted).toHaveLength(1);
  });
});
