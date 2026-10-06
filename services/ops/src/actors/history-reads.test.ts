/**
 * C4g: the venue actors that read every `Resolution` (and `MarketTerms`, `PriceQuote`) each pass now read them only when a
 * live contract can use one. A Resolution and a MarketTerms exist for every Window the venue ever ran and none is
 * archived, so on Noders DevNet those reads grew with the venue's age (650 KB of Resolutions and 415 KB of terms per pass
 * after 4 h) and saturated the link. These tests pin both halves: nothing live → the growing set is never requested; a
 * live contract on a Window → it is requested and the settlement inputs still carry that Window's Resolution.
 */
import { readFileSync } from "node:fs";
import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import { LedgerError, type CreatedEvent, type JsTransaction, type LedgerClient } from "@agari/ledger";
import { decodeTerms, learnTerms, type RoleSession, type TermsC } from "@agari/markets/ops/canton";
import { describe, expect, it } from "vitest";
import { createArenaDesk } from "./arena-desk/desk";
import { createSeatDirectory } from "./arena-desk/seats";
import { readMakerSnapshot } from "./maker-vault/state";
import { laneFeederPass } from "./price-relay/lane-feeder";
import { readDesk } from "./ticket-desk/state";

const fixtures = JSON.parse(readFileSync(new URL("./projector/fixtures/lifecycle.json", import.meta.url), "utf8")) as Record<string, JsTransaction>;
const created = (step: string, template: string): CreatedEvent => {
  const e = fixtures[step]!.events.find((x) => "CreatedEvent" in x && x.CreatedEvent.templateId.endsWith(template));
  if (!e || !("CreatedEvent" in e)) throw new Error(`fixture ${step} has no ${template}`);
  return e.CreatedEvent;
};
const VENUE = "venue::1220";
const terms = created("open-window", ":PM.Market:MarketTerms");
const state = created("open-window", ":PM.Market:WindowState");
const resolution = created("resolve-up", ":PM.Market:Resolution");
const suffix = (t: string) => t.split(":").slice(1).join(":");

/** A ledger holding `contracts`, recording the template ids of every ACS read. */
function ledger(contracts: CreatedEvent[]) {
  const reads: string[][] = [];
  const client = {
    activeContracts: async (q: { templateIds?: string[] }) => {
      const want = (q.templateIds ?? []).map(suffix);
      reads.push(want);
      return { contracts: contracts.filter((c) => want.includes(suffix(c.templateId))).map((createdEvent) => ({ createdEvent, synchronizerId: "sync" })) };
    },
  } as unknown as LedgerClient;
  const session: RoleSession = { role: "venue", party: VENUE, client, dryRun: false };
  const read = (template: string) => reads.some((r) => r.includes(suffix(template)));
  return { session, reads, read };
}

describe("the ticket desk reads Resolutions only for a live round, ticket or position", () => {
  it("with none live, never asks for a Resolution", async () => {
    const l = ledger([resolution]);
    const snap = await readDesk(l.session);
    expect(l.read(TEMPLATE_IDS.Resolution)).toBe(false);
    expect(snap.resolutions.size).toBe(0);
  });

  it("with a live range round, reads them and keys the round's Window", async () => {
    const termsCid = (resolution.createArgument as { termsCid: string }).termsCid;
    const round: CreatedEvent = {
      ...resolution, contractId: "00round", templateId: TICKET_TEMPLATE_IDS.RangeRound,
      createArgument: { venue: VENUE, owner: "alice::1220", reserveId: "range", termsCid, marketId: "BTC-c3a-mum43ymj:0", kind: "RangeTicket", side: "Inside", lowE8: "1", highE8: "2", stake: "10", maxPayout: "20", "expiry": "2026-09-29T03:25:00Z", refundAfter: "2026-09-29T03:35:00Z" },
    };
    const l = ledger([round, resolution]);
    const snap = await readDesk(l.session);
    expect(snap.rounds.map((r) => r.cid)).toEqual(["00round"]);
    expect(l.read(TEMPLATE_IDS.Resolution)).toBe(true);
    expect(snap.resolutions.get(termsCid)?.cid).toBe(resolution.contractId);
  });
});

describe("the maker vault reads Resolutions and MarketTerms only for the book's own Windows", () => {
  it("with no book contract, asks for neither", async () => {
    const l = ledger([resolution, terms]);
    const snap = await readMakerSnapshot(l.session);
    expect(l.read(TEMPLATE_IDS.Resolution) || l.read(TEMPLATE_IDS.MarketTerms)).toBe(false);
    expect(snap.resolutions.size + snap.markets.size).toBe(0);
  });

  it("with a book leg, reads both and keeps only that Window's", async () => {
    const leg = created("accept", ":PM.Leg:Leg");
    const termsCid = (leg.createArgument as { termsCid: string }).termsCid;
    const bookLeg: CreatedEvent = { ...leg, contractId: "00bookleg", createArgument: { ...(leg.createArgument as object), owner: VENUE, beneficiaryRef: "reserve:maker" } };
    const otherResolution: CreatedEvent = { ...resolution, contractId: "00other", createArgument: { ...(resolution.createArgument as object), termsCid: "00another-window" } };
    const l = ledger([bookLeg, resolution, otherResolution, { ...terms, contractId: termsCid }]);
    const snap = await readMakerSnapshot(l.session);
    expect(snap.legs.map((x) => x.cid)).toEqual(["00bookleg"]);
    expect([...snap.resolutions.keys()]).toEqual([termsCid]);
    expect(snap.resolutions.get(termsCid)?.cid).toBe(resolution.contractId);
    expect(snap.markets.get(termsCid)?.marketId).toBe((terms.createArgument as { marketId: string }).marketId);
  });
});

describe("the arena desk reads Resolutions only while a duel is live", () => {
  it("with no match, never asks for one", async () => {
    const l = ledger([resolution]);
    const desk = createArenaDesk({ venue: l.session, seats: createSeatDirectory(null, () => {}), chainId: 1, log: () => {} });
    const snap = await desk.snapshot({ fresh: true });
    expect(l.read(TEMPLATE_IDS.Resolution)).toBe(false);
    expect(snap.resolutions.size).toBe(0);
  });
});

describe("the lane feeders read PriceQuotes only when a lane print is due", () => {
  const feederState = (l: ReturnType<typeof ledger>, t: Map<string, ReturnType<typeof decodeTerms>>, done = new Set<string>()) =>
    ({ venue: l.session, resolver: "resolver::1220", feeds: [], terms: t, done, counters: { posted: 0, recovered: 0, missed: 0, failed: 0 }, log: () => {} }) as unknown as Parameters<typeof laneFeederPass>[0];

  it("with no lane Window waiting, never asks for the quotes", async () => {
    const l = ledger([]);
    const r = await laneFeederPass(feederState(l, new Map()));
    expect(r.why).toMatch(/no lane Window waiting/);
    expect(l.read(TEMPLATE_IDS.PriceQuote)).toBe(false);
  });

  it("with an exchange-printed Window waiting (the crypto feeders' own), still never asks", async () => {
    const l = ledger([state]);
    const t = decodeTerms(terms.createArgument);
    const r = await laneFeederPass(feederState(l, new Map([[terms.contractId, { ...t, printSource: "attested:coinbase,kraken,bitstamp" }]])));
    expect(r.why).toMatch(/no lane Window waiting/);
    expect(l.read(TEMPLATE_IDS.PriceQuote)).toBe(false);
  });

  it("with a RedStone open print due now, reads them", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const l = ledger([{ ...state, createArgument: { ...(state.createArgument as object), termsCid: terms.contractId } }]);
    const t = decodeTerms(terms.createArgument);
    const due = { ...t, printSource: "attested:redstone:TSLA", tradingStartSec: nowSec - 5, minDelaySec: 0, openDeadlineSec: nowSec + 60 };
    await laneFeederPass(feederState(l, new Map([[terms.contractId, due]])));
    expect(l.read(TEMPLATE_IDS.PriceQuote)).toBe(true);
  });
});

describe("the resolver, pricer and lane feeders learn a new Window's terms by id, never by paging MarketTerms", () => {
  it("fetches only the unknown ids, keeps what it learns, and skips an id the party cannot see", async () => {
    const asked: string[] = [];
    let paged = 0;
    const client = {
      activeContracts: async () => ((paged += 1), { contracts: [] }),
      http: {
        request: async (_method: string, path: string, o: { json: { contractId: string; eventFormat: { filtersByParty: Record<string, unknown> } } }) => {
          expect(path).toBe("/v2/events/events-by-contract-id");
          expect(Object.keys(o.json.eventFormat.filtersByParty)).toEqual(["resolver::1220"]);
          asked.push(o.json.contractId);
          if (o.json.contractId !== terms.contractId) throw new LedgerError({ kind: "not-found", path, message: "CONTRACT_EVENTS_NOT_FOUND" });
          return { created: { createdEvent: terms, synchronizerId: "sync" } };
        },
      },
    } as unknown as LedgerClient;
    const session: RoleSession = { role: "resolver", party: "resolver::1220", client, dryRun: false };
    const known = new Map<string, TermsC>([["00already", decodeTerms(terms.createArgument)]]);
    expect(await learnTerms(session, known, [terms.contractId, "00already", "00unseen", terms.contractId])).toBe(1);
    expect(asked.sort()).toEqual(["00unseen", terms.contractId].sort());
    expect(known.get(terms.contractId)?.marketId).toBe((terms.createArgument as { marketId: string }).marketId);
    expect(paged).toBe(0);
    // A second pass with the same live Windows asks again only for the one it could not see.
    asked.length = 0;
    await learnTerms(session, known, [terms.contractId, "00already", "00unseen"]);
    expect(asked).toEqual(["00unseen"]);
  });
});
