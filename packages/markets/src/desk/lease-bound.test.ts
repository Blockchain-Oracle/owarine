import { createHash } from "node:crypto";
import { AGENT_TEMPLATE_IDS } from "@agari/daml";
import type { LedgerClient } from "@agari/ledger";
import { describe, expect, it } from "vitest";
import { decodeDeskDecision, decodeDeskMandate } from "../ops/agents/decode";
import { deskAddressOf, legacyDeskAddressOf } from "../ops/agents/ids";
import { GENESIS_HEAD_HEX } from "./canton";
import { chainOfMandate, findLeasedMandate, readDeskHistory } from "./ops";

/**
 * C4d H2 (K-210): a seat party is recycled to later visitors. Visitor A leased party P and opened a desk; the drain
 * closed it; visitor B now leases P and has opened a desk of its own. A's index row (owner A, the desk address A saw)
 * must never reach B's live desk, for a read or for a trade.
 */
const VENUE = "venue::1220aa";
const P = "seat-7::1220bb";
const Q = "seat-8::1220bc";
const OPERATOR = "agent-runner::1220cc";
const iso = (sec: number) => new Date(sec * 1000).toISOString();
const A_OPENED = 1_790_000_000;
const B_OPENED = 1_790_900_000;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const nextHead = (prev: string, seq: number, hash: string) => sha(`${prev}:${seq}:${hash}`);

function mandateArg(owner: string, openedSec: number, head: string, seq: number) {
  return {
    venue: VENUE, owner, operator: OPERATOR,
    grant: {
      venue: VENUE, owner, agent: OPERATOR, caps: { maxStakePerTrade: "700000", maxDailySpend: "1000000", maxPriceTicks: "0", maxOpenPositions: "24" },
      budget: "2000000", expiresAt: iso(openedSec + 365 * 86_400), dayZero: iso(Math.floor(openedSec / 86_400) * 86_400), day: "0", spentToday: "0", positions: [],
    },
    allowList: ["SPACEX-60m"], maxPremiumBps: "500", attestors: ["o1::1", "o2::2"], refQuorum: "2", mode: "DeskLive", paused: false, head, seq: String(seq), holdings: [],
  };
}
const decisionArg = (owner: string, seq: number, prevHead: string, decisionHash: string) => ({
  venue: VENUE, owner, operator: OPERATOR, seq: String(seq), prevHead, decisionHash, head: nextHead(prevHead, seq, decisionHash), action: { tag: "DeskHold", value: {} }, note: "",
});

// A's desk sealed two decisions on P before the drain closed it; its DeskDecisions stay on the ledger. B's has one.
const a1 = decisionArg(P, 1, GENESIS_HEAD_HEX, sha("a-1"));
const a2 = decisionArg(P, 2, a1.head, sha("a-2"));
const b1 = decisionArg(P, 1, GENESIS_HEAD_HEX, sha("b-1"));
const bMandate = mandateArg(P, B_OPENED, b1.head, 1);
const aOldAddress = deskAddressOf(decodeDeskMandate(mandateArg(P, A_OPENED, a2.head, 2)));
const bAddress = deskAddressOf(decodeDeskMandate(bMandate));

let n = 0;
const created = (templateId: string, arg: unknown) => ({ createdEvent: { contractId: `00${(n++).toString(16).padStart(4, "0")}`, templateId, createArgument: arg, offset: 10 + n, "createdAt": iso(B_OPENED) } });
const client = {
  activeContracts: async ({ templateIds }: { templateIds: string[] }) => ({
    activeAtOffset: 99,
    contracts: [
      ...(templateIds.includes(AGENT_TEMPLATE_IDS.DeskMandate) ? [created(AGENT_TEMPLATE_IDS.DeskMandate, bMandate)] : []),
      ...(templateIds.includes(AGENT_TEMPLATE_IDS.DeskDecision) ? [a1, a2, b1].map((d) => created(AGENT_TEMPLATE_IDS.DeskDecision, d)) : []),
    ],
  }),
  findAcceptedCompletion: async () => ({ updateId: "1220upd", offset: 50 }),
} as unknown as LedgerClient;
const ledger = { client, venue: VENUE, readAs: [VENUE], operator: OPERATOR };

describe("a desk row reaches a mandate only through its owner's current lease (C4d H2)", () => {
  it("a desk's address names its opening, so a later lessee's desk on the same party has a new one", () => {
    expect(bAddress).not.toBe(aOldAddress);
    expect(bAddress).not.toBe(legacyDeskAddressOf(P, VENUE));
  });

  it("A's row finds nothing once A no longer leases P, whichever address it kept", async () => {
    for (const address of [aOldAddress, legacyDeskAddressOf(P, VENUE)]) {
      expect(await findLeasedMandate(ledger, { party: null, address })).toBeNull();
      // A came back and leases another party: still not B's desk.
      expect(await findLeasedMandate(ledger, { party: Q, address })).toBeNull();
    }
  });

  it("an earlier opening's address never resolves to the live desk, even under the party's current lease", async () => {
    expect(await findLeasedMandate(ledger, { party: P, address: aOldAddress })).toBeNull();
  });

  it("B's own row finds B's desk; a pre-C4d row resolves only for the party's current lessee", async () => {
    expect((await findLeasedMandate(ledger, { party: P, address: bAddress }))?.data.owner).toBe(P);
    expect((await findLeasedMandate(ledger, { party: P, address: legacyDeskAddressOf(P, VENUE) }))?.data.owner).toBe(P);
  });

  it("a desk's history is its own hash chain: an earlier lessee's decisions on the same party are not in it", async () => {
    const rows = [a1, a2, b1].map((d) => ({ d: decodeDeskDecision(d) }));
    expect(chainOfMandate(decodeDeskMandate(bMandate), rows).map((r) => r.d.head)).toEqual([b1.head]);
    expect(chainOfMandate(decodeDeskMandate(mandateArg(P, A_OPENED, a2.head, 2)), rows).map((r) => r.d.seq)).toEqual([2, 1]);
    const history = await readDeskHistory({ endpoint: "ledger", ledger }, bAddress);
    expect(history.map((h) => h.events.length)).toEqual([1]);
    expect(await readDeskHistory({ endpoint: "ledger", ledger }, aOldAddress)).toEqual([]);
    expect(await readDeskHistory({ endpoint: "ledger", ledger }, legacyDeskAddressOf(P, VENUE) as never)).toEqual([]);
  });
});
