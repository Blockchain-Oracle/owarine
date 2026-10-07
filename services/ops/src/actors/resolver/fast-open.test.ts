/**
 * The fast path: fresh quotes from the feeders complete a Window's open slot, and the resolver records the open print at
 * once — from the WindowState it saw on its last full pass and the quotes in hand, with no ledger read.
 */
import { readFileSync } from "node:fs";
import { TEMPLATE_IDS } from "@owarine/daml";
import type { CreatedEvent, JsTransaction, LedgerClient } from "@owarine/ledger";
import { decodePriceQuote, decodeTerms, type RoleSession, type TermsC } from "@owarine/markets/ops/canton";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fastOpens } from "./index";

const fixtures = JSON.parse(readFileSync(new URL("../projector/fixtures/lifecycle.json", import.meta.url), "utf8")) as Record<string, JsTransaction>;
const created = (step: string, template: string): CreatedEvent => {
  const e = fixtures[step]!.events.find((x) => "CreatedEvent" in x && x.CreatedEvent.templateId.endsWith(template));
  if (!e || !("CreatedEvent" in e)) throw new Error(`fixture ${step} has no ${template}`);
  return e.CreatedEvent;
};
const termsEvent = created("open-window", ":PM.Market:MarketTerms");
const terms: TermsC = decodeTerms(termsEvent.createArgument);
const openPrint = created("record-open", ":PM.Market:OpenPrint");
const iso = (sec: number) => new Date(sec * 1000).toISOString().replace(".000Z", "Z");

const openQuotes = (n: number) =>
  terms.oracles.slice(0, n).map((oracle, i) => ({
    cid: `00open${i}`,
    data: decodePriceQuote({
      oracle, venue: terms.venue, resolver: terms.resolver, symbol: terms.symbol, boundaryT: iso(terms.tradingStartSec), priceE8: String(6_000_000_000_000 + i),
      barStart: iso(terms.tradingStartSec - terms.barLenSec), barLenSec: String(terms.barLenSec), fetchedAt: iso(terms.tradingStartSec + terms.minDelaySec),
      payloadHash: `sha256:open-${i}`, policyVersion: String(terms.policyVersion),
    }),
  }));

function world(quotes: ReturnType<typeof openQuotes>) {
  const submitted: Array<{ commandId: string; commands: unknown[] }> = [];
  const client = {
    activeContracts: async () => {
      throw new Error("the fast path must not read the ledger");
    },
    submitAndWaitForTransaction: async (req: { commandId: string; commands: unknown[] }) => {
      submitted.push(req);
      const transaction = { updateId: "1220open", offset: 9, effectiveAt: "", recordTime: "", synchronizerId: "sync", events: [{ CreatedEvent: { ...openPrint, templateId: TEMPLATE_IDS.OpenPrint } }] };
      return { transaction, submissionId: "s", attempts: 1, recovered: false };
    },
  } as unknown as LedgerClient;
  const session: RoleSession = { role: "resolver", party: terms.resolver, client, dryRun: false };
  const state = {
    session, terms: new Map([[termsEvent.contractId, terms]]), finished: new Set<string>(), inFlight: new Set<string>(),
    awaiting: new Map([[termsEvent.contractId, { stateCid: "00state", t: terms }]]), quotes: new Map(quotes.map((q) => [q.cid, q])),
    counters: { recordedOpen: 0, resolved: 0, voided: 0, failed: 0, eventsResolved: 0, eventsVoided: 0 }, log: () => undefined,
  };
  return { state: state as unknown as Parameters<typeof fastOpens>[0], submitted };
}

describe("the resolver's fast path", () => {
  afterEach(() => vi.useRealTimers());

  it("records the open print once every oracle's quote is in hand, without a ledger read", async () => {
    vi.useFakeTimers({ now: (terms.tradingStartSec + 9) * 1000 });
    const w = world(openQuotes(3));
    const notes = await fastOpens(w.state);
    expect(w.submitted).toHaveLength(1);
    expect(JSON.stringify(w.submitted[0]!.commands)).toContain("RecordOpen");
    expect(notes[0]).toContain("fast path");
    // Recorded: a second call sends nothing more.
    expect(await fastOpens(w.state)).toEqual([]);
    expect(w.submitted).toHaveLength(1);
  });

  it("waits for the third oracle until the all-oracles cap, then records on the quorum", async () => {
    vi.useFakeTimers({ now: (terms.tradingStartSec + 9) * 1000 });
    const early = world(openQuotes(2));
    expect(await fastOpens(early.state)).toEqual([]);
    vi.setSystemTime((terms.tradingStartSec + 19) * 1000);
    const late = world(openQuotes(2));
    await fastOpens(late.state);
    expect(late.submitted).toHaveLength(1);
  });
});
