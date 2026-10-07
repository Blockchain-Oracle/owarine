/**
 * Captures the real rejection bodies the seat routes classify (C4a): run against a LOCAL sandbox, it provokes each
 * rejection once and prints the `JsCantonError` fields, which `packages/markets/src/server/rejection.test.ts` keeps as
 * fixtures. Party allocation is local-only, so this never runs against Noders.
 *
 *   LEDGER_JSON_API_URL=http://localhost:7595 pnpm --filter @owarine/scripts exec tsx drive/probe-rejections.ts
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import { createLedgerClient, LedgerError, noAuth } from "@owarine/ledger";
import { sandboxWorld, waitForLedger } from "./lib/sandbox-world";

const client = createLedgerClient({ baseUrl: process.env.LEDGER_JSON_API_URL ?? "http://localhost:7595", auth: noAuth(), userId: "c4a-probe", maxAttempts: 1 });
const run = `probe${Date.now().toString(36)}`;
const world = sandboxWorld(client, run);

async function capture(label: string, attempt: () => Promise<unknown>) {
  try {
    await attempt();
    console.log(`## ${label}: accepted (no rejection)`);
  } catch (error) {
    if (!(error instanceof LedgerError)) throw error;
    const c = error.canton;
    console.log(`## ${label}`);
    console.log(JSON.stringify({ kind: error.kind, status: error.status, code: c?.code, errorCategory: c?.errorCategory, cause: c?.cause, context: c?.context, definiteAnswer: c?.definiteAnswer }, null, 2));
  }
}

const accept = (user: string, quoteCid: string, cash: string[], tag: string) =>
  client.submitAndWaitForTransaction({
    actAs: [user],
    commandId: `c4a-probe:${run}:${tag}`,
    commands: [{ ExerciseCommand: { templateId: TEMPLATE_IDS.Quote, contractId: quoteCid, choice: "Quote_Accept", choiceArgument: { cash, beneficiaryRef: null } } }],
  });

await waitForLedger(client);
const w = await world.setup();
const now = Date.now();
const win = await world.openWindow(w, { seriesKey: `PRB${run}-60`, symbol: "PRB", cadenceSec: 120, lockLeadSec: 10, startsAtMs: now - 5_000 });
const cashA = await world.fund(w, w.seatA, 1_000_000n);
const cashB = await world.fund(w, w.seatB, 1_000_000n);

const expiring = await world.issueQuote(w, win, { user: w.seatA, side: "SideUp", priceTicks: 600n, lots: 10n, fee: 100n, validUntilMs: Date.now() + 2_000 });
await new Promise((r) => setTimeout(r, 3_500));
await capture("accept after validUntil", () => accept(w.seatA, expiring.contractId, [cashA], "expired"));

const big = await world.issueQuote(w, win, { user: w.seatA, side: "SideUp", priceTicks: 600n, lots: 1000n, fee: 100n, validUntilMs: Date.now() + 30_000 });
await capture("accept with insufficient cash", () => accept(w.seatA, big.contractId, [cashA], "short"));
await capture("accept with foreign cash", () => accept(w.seatA, big.contractId, [cashB], "foreign"));

const ok = await world.issueQuote(w, win, { user: w.seatA, side: "SideUp", priceTicks: 600n, lots: 10n, fee: 100n, validUntilMs: Date.now() + 30_000 });
const first = await accept(w.seatA, ok.contractId, [cashA], "ok");
const change = first.transaction.events.flatMap((e) => ("CreatedEvent" in e && e.CreatedEvent.templateId.endsWith(":PM.Money:VenueCash") ? [e.CreatedEvent.contractId] : []));
await capture("accept an already-accepted quote", () => accept(w.seatA, ok.contractId, change, "again"));
const ok2 = await world.issueQuote(w, win, { user: w.seatA, side: "SideUp", priceTicks: 600n, lots: 10n, fee: 100n, validUntilMs: Date.now() + 30_000 });
await capture("accept with archived cash", () => accept(w.seatA, ok2.contractId, [cashA], "stale-cash"));
await capture("accept someone else's quote", () => accept(w.seatB, ok2.contractId, [cashB], "not-mine"));

const legCid = first.transaction.events.flatMap((e) => ("CreatedEvent" in e && e.CreatedEvent.templateId.endsWith(":PM.Leg:Leg") && (e.CreatedEvent.createArgument as { owner: string }).owner === w.seatA ? [e.CreatedEvent.contractId] : []))[0]!;
await capture("refund-stale before refundAfter", () =>
  client.submitAndWaitForTransaction({ actAs: [w.seatA], commandId: `c4a-probe:${run}:refund`, commands: [{ ExerciseCommand: { templateId: TEMPLATE_IDS.Leg, contractId: legCid, choice: "Leg_RefundStale", choiceArgument: {} } }] }),
);
await capture("claim with a resolution the seat cannot see", () =>
  client.submitAndWaitForTransaction({ actAs: [w.seatA], commandId: `c4a-probe:${run}:claim`, commands: [{ ExerciseCommand: { templateId: TEMPLATE_IDS.Leg, contractId: legCid, choice: "Leg_Claim", choiceArgument: { resolutionCid: win.stateCid } } }] }),
);
await capture("unknown template", () =>
  client.submitAndWaitForTransaction({ actAs: [w.seatA], commandId: `c4a-probe:${run}:tpl`, commands: [{ ExerciseCommand: { templateId: "#abu-pm-nope:PM.Leg:Leg", contractId: legCid, choice: "Leg_Claim", choiceArgument: {} } }] }),
);
await capture("duplicate command id", () => accept(w.seatA, ok.contractId, change, "ok"));
