/**
 * C8f integration: an agent trading through a grant on a REAL local stack (sandbox + `drive/ops-local.ts`), without
 * the web. Calls ops' HMAC routes as the web would and acts as the seats directly on the ledger, the way the web's
 * server half does; the runner acts as the agent-runner party through the grant executor, the way ops does:
 *
 *   fund seat-1 → enrol → GrantDesk_Open (grant to the agent-runner) → seat-2 publishes a strategy (runner = the
 *   agent-runner) → seat-1 opens its book and subscribes (fade) → the runner sees the consent (K-089) → the runner
 *   places a call for seat-1 through the grant (owner's firm quote, Grant_AcceptQuote) → recovery by command id →
 *   the Window resolves and the venue settles the leg → GrantDesk_Fund top-up keeps the counters → Grant_Revoke
 *   returns the whole remaining budget, and seat-1's cash reconciles to the cent.
 *
 *   LEDGER_JSON_API_URL=http://localhost:7565 AGARI_PARTIES_FILE=… OPS=http://localhost:8767 OPS_INTERNAL_SECRET=… \
 *     pnpm --filter @agari/scripts exec tsx drive/agents-grant-it.ts
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { createLedgerClient, noAuth, parseLedgerEnv, type Command, type CreatedEvent } from "@agari/ledger";
import { AGENT_TEMPLATE_IDS, TEMPLATE_IDS } from "@agari/daml";
import { decodeLeg, decodeVenueCash, pick } from "@agari/markets/ops/canton";
import { acmd, createGrantExecutor, decodeAgentGrant, decodeGrantDesk, decodeCreatorLicense, decodeStrategyListing, decodeSubscriberBook, decodeSubscriberInvite, decodeSubscription, grantIdOf, opsQuoteSource, sha256Hex, utcDayStartSec } from "@agari/markets/ops/agents";
import { createOpsClient } from "@agari/markets/server";
import type { EventMarket, MarketId } from "@agari/core/types";
import { readPartiesFile } from "../../services/ops/src/runtime/keys";

const OPS = process.env.OPS ?? "http://localhost:8767";
const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("agents-grant-it runs against an unauthenticated local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });
const ops = createOpsClient({ baseUrl: OPS, secret: process.env.OPS_INTERNAL_SECRET! });
const file = readPartiesFile()!;
const seat = file.users!["seat-1"]!;
const creator = file.users!["seat-2"]!;
const venue = file.parties.venue!;
const runner = file.parties["agent-runner"]!;
const run = process.env.DRIVE_RUN ?? Date.now().toString(36);
let failures = 0;
const show = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${typeof detail === "string" ? detail : show(detail)}`}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const created = (events: readonly unknown[]): CreatedEvent[] => (events as Array<Record<string, CreatedEvent>>).flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));

async function as(party: string, label: string, commands: Command[], disclosed?: unknown[]) {
  const r = await client.submitAndWaitForTransaction({ actAs: [party], commandId: `drive:${label}:${run}`, commands, ...(disclosed ? { disclosedContracts: disclosed as never } : {}) });
  return created(r.transaction.events);
}
async function cashOf(p: string) {
  const r = await client.activeContracts({ parties: [p], templateIds: [TEMPLATE_IDS.VenueCash] });
  return pick(r.contracts, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === p);
}
const total = async (p: string) => (await cashOf(p)).reduce((s, c) => s + c.data.amount, 0n);
async function one<T>(p: string, templateId: string, decode: (v: unknown) => T, where: (x: T) => boolean = () => true) {
  const r = await client.activeContracts({ parties: [p], templateIds: [templateId], includeCreatedEventBlob: true });
  return pick(r.contracts, templateId, decode).find((c) => where(c.data)) ?? null;
}
async function grantOf() {
  return one(seat, TEMPLATE_IDS.AgentGrant, decodeAgentGrant, (g) => g.owner === seat && g.agent === runner);
}

// ---- 1. fund and enrol ----------------------------------------------------------------------------------------------
for (const p of [seat, creator]) {
  const f = await ops.fundSeat({ party: p, leaseId: `drive-${run}`, address: "11111111111111111111111111111111" });
  check(`fund ${p.split("::")[0]}`, f.kind === "funded" || f.kind === "already", f.kind);
  const e = await ops.enrolAgents({ party: p, leaseId: `drive-${run}` });
  check(`enrol ${p.split("::")[0]}`, e.kind === "enrolled", e);
}
for (let i = 0; i < 20 && (await total(seat)) === 0n; i++) await sleep(1_000);
// A re-run starts clean: any earlier grant to the runner is revoked (its budget comes home) and consents end.
{
  const r = await client.activeContracts({ parties: [seat], templateIds: [TEMPLATE_IDS.AgentGrant, AGENT_TEMPLATE_IDS.Subscription, AGENT_TEMPLATE_IDS.SubscriberBook] });
  for (const g of pick(r.contracts, TEMPLATE_IDS.AgentGrant, decodeAgentGrant).filter((g) => g.data.owner === seat)) await as(seat, `clean-${g.cid.slice(2, 12)}`, [acmd.revokeGrant(g.cid)]);
  const book0 = pick(r.contracts, AGENT_TEMPLATE_IDS.SubscriberBook, decodeSubscriberBook)[0];
  let bookCid = book0?.cid;
  for (const s of pick(r.contracts, AGENT_TEMPLATE_IDS.Subscription, decodeSubscription)) {
    const out = await as(seat, `unsub-${s.cid.slice(2, 12)}`, [acmd.unsubscribe(bookCid!, s.cid)]);
    bookCid = out.find((e) => e.templateId.endsWith(":PM.Agents.Strategy:SubscriberBook"))?.contractId ?? bookCid;
  }
}
const cash0 = await total(seat);
console.log(`seat-1 holds ${cash0}`);

// ---- 2. the grant -----------------------------------------------------------------------------------------------------
const BUDGET = 20_000_000n;
const caps = { maxStakePerTrade: 5_000_000n, maxDailySpend: 12_000_000n, maxPriceTicks: 0, maxOpenPositions: 5 };
const desk = await one(seat, AGENT_TEMPLATE_IDS.GrantDesk, decodeGrantDesk, (d) => d.owner === seat);
check("seat-1 has its GrantDesk", desk !== null);
const nowSec = Math.floor(Date.now() / 1000);
const expiresAtSec = nowSec + 7 * 86_400;
const dayZeroSec = utcDayStartSec(nowSec);
const coins = (await cashOf(seat)).sort((a, b) => (a.data.amount > b.data.amount ? -1 : 1));
await as(seat, "grant-open", [acmd.openGrant(desk!.cid, { agent: runner, caps, expiresAtSec, dayZeroSec, budget: BUDGET, cash: [coins[0]!.cid] })]);
let grant = await grantOf();
check("grant open: budget 20 credits, day 0, nothing spent", grant?.data.budget === BUDGET && grant.data.spentToday === 0n, grant?.data);
check("seat-1 cash down by exactly the budget", (await total(seat)) === cash0 - BUDGET, { before: cash0, after: await total(seat) });
const grantId = grantIdOf({ owner: seat, agent: runner, expiresAtSec, dayZeroSec });
check("the runner sees the grant (observer)", (await one(runner, TEMPLATE_IDS.AgentGrant, decodeAgentGrant, (g) => g.owner === seat)) !== null);

// ---- 3. a strategy, a fade consent, the runner sees it --------------------------------------------------------------
const lic = await one(creator, AGENT_TEMPLATE_IDS.CreatorLicense, decodeCreatorLicense, (l) => l.creator === creator);
const spec = JSON.stringify({ name: "Drive fade", description: "C8f drive", spec: { preset: "momentum", lookback: 3, thresholdBps: 10 } });
await as(creator, "publish", [acmd.publishStrategy(lic!.cid, { runner, envelope: { maxStakePerTrade: 5_000_000n, maxDailySpend: 20_000_000n, maxOpenPositions: 9, maxPriceTicks: 0 }, fee: 0n, spec, specHash: sha256Hex(spec) })]);
const listing = await one(venue, AGENT_TEMPLATE_IDS.StrategyListing, decodeStrategyListing, (l) => l.creator === creator);
check("the listing is live with the sealed hash", listing?.data.active === true && listing.data.specHash === sha256Hex(spec), listing?.data.strategyId);
const invite = await one(seat, AGENT_TEMPLATE_IDS.SubscriberInvite, decodeSubscriberInvite, (x) => x.subscriber === seat);
if (invite) await as(seat, "book", [acmd.openBook(invite.cid)]);
const book = await one(seat, AGENT_TEMPLATE_IDS.SubscriberBook, decodeSubscriberBook, (b) => b.subscriber === seat);
const listingRaw = (await client.activeContracts({ parties: [venue], templateIds: [AGENT_TEMPLATE_IDS.StrategyListing], includeCreatedEventBlob: true })).contracts.find((c) => c.createdEvent.contractId === listing!.cid)!;
const listingDisclosed = { createdEventBlob: listingRaw.createdEvent.createdEventBlob!, templateId: listingRaw.createdEvent.templateId, contractId: listing!.cid, synchronizerId: listingRaw.synchronizerId };
grant = await grantOf();
await as(seat, "subscribe", [acmd.subscribe(book!.cid, { listingCid: listing!.cid, grantCid: grant!.cid, kind: "SubFade", maxFee: 0n, expectVersion: 0, cash: [] })], [listingDisclosed]);
const seen = await one(runner, AGENT_TEMPLATE_IDS.Subscription, decodeSubscription, (s) => s.subscriber === seat);
check("the runner observes the consent, fade (K-089)", seen?.data.kind === "SubFade", seen?.data.kind);
check("the creator does not see who subscribes", (await one(creator, AGENT_TEMPLATE_IDS.Subscription, decodeSubscription)) === null);

// ---- 4. the runner places through the grant -------------------------------------------------------------------------
async function quotingWindow() {
  for (let i = 0; i < 90; i++) {
    const body = (await (await fetch(`${OPS}/ladders/latest`)).json()) as { ladders: any[] };
    const now = Date.now() / 1000;
    const l = body.ladders.find((x) => x.state === "quoting" && x.lockAtSec - now >= 25 && x.up.length > 0 && String(x.seriesKey).endsWith("-1m"));
    if (l) return l;
    await sleep(2_000);
  }
  throw new Error("no quoting 1-minute Window within 3 minutes");
}
const ladder = await quotingWindow();
const marketId = ladder.marketId as MarketId;
const STAKE = 2_000_000n;
const preview = await ops.quote({ marketId, side: "up", stakeBase: STAKE, displayedMaxCostBase: STAKE * 2n, party: seat, leaseId: `drive-${run}` });
check("a displayed quote for seat-1", preview.kind === "quote", preview.kind);
const displayed = preview.kind === "quote" ? preview.quote : null;
const executor = createGrantExecutor({ client, agent: runner, readAs: () => [venue], quotes: opsQuoteSource(ops), role: "strategy" });
const fromOffset = await client.ledgerEnd();
grant = await grantOf();
const placed = await executor.place({ owner: seat, grant: grant!, market: { marketId } as EventMarket, side: "up", stakeBase: STAKE, displayedQuote: displayed!, fromOffset });
check("the runner placed a call for seat-1 through its grant", placed.status === "confirmed", placed.status === "confirmed" ? placed.booked : placed);
const charge = placed.status === "confirmed" ? placed.booked.costBase : 0n;
grant = await grantOf();
check("the grant was charged exactly the booked cost, and counted it today", grant?.data.budget === BUDGET - charge && grant.data.spentToday === charge, { budget: grant?.data.budget, spent: grant?.data.spentToday, charge });
const legsOf = async () => {
  const r = await client.activeContracts({ parties: [seat], templateIds: [TEMPLATE_IDS.Leg] });
  return pick(r.contracts, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.owner === seat);
};
const legs = await legsOf();
check("seat-1 owns the leg, marked as a grant's", legs.some((l) => l.data.beneficiaryRef === "grant"), legs.map((l) => l.data.beneficiaryRef));
check("the runner can never see seat-1's cash", (await cashOf(runner)).length === 0 && (await client.activeContracts({ parties: [runner], templateIds: [TEMPLATE_IDS.VenueCash] })).contracts.length === 0);
const recovered = await executor.recover({ owner: seat as never, actor: runner as never, marketId, grantId, side: "up", fromSlot: BigInt(fromOffset), txHash: null });
check("recovery by command id finds the same fill", recovered.status === "confirmed" && recovered.cashDelta === charge, recovered);
const again = await executor.place({ owner: seat, grant: grant!, market: { marketId } as EventMarket, side: "up", stakeBase: STAKE, displayedQuote: displayed!, fromOffset });
check("the same attempt is never re-sent as a second fill", (await grantOf())?.data.budget === BUDGET - charge, again.status);

// ---- 5. settle -------------------------------------------------------------------------------------------------------
const cashBeforeSettle = await total(seat);
let settled = false;
for (let i = 0; i < 90 && !settled; i++) {
  settled = !(await legsOf()).some((l) => l.data.marketId.startsWith(String(ladder.damlMarketId)));
  if (!settled) await sleep(4_000);
}
const payout = (await total(seat)) - cashBeforeSettle;
check("the venue settled seat-1's leg (resolution, then Desk_SettleBatch)", settled, { payout });

// ---- 6. top-up, then revoke returns the whole budget ------------------------------------------------------------------
grant = await grantOf();
const spentBefore = grant!.data.spentToday;
const topCoin = (await cashOf(seat)).sort((a, b) => (a.data.amount > b.data.amount ? -1 : 1))[0]!;
const split = await as(seat, "split", [{ ExerciseCommand: { templateId: TEMPLATE_IDS.VenueCash, contractId: topCoin.cid, choice: "VenueCash_Split", choiceArgument: { take: "1000000" } } }]);
const part = pick(split.map((e) => ({ createdEvent: e, synchronizerId: "" })), TEMPLATE_IDS.VenueCash, decodeVenueCash).find((c) => c.data.amount === 1_000_000n)!;
await as(seat, "grant-fund", [acmd.fundGrant(desk!.cid, grant!.cid, [part.cid])]);
grant = await grantOf();
check("a top-up adds to the budget and keeps today's spend", grant?.data.budget === BUDGET - charge + 1_000_000n && grant.data.spentToday === spentBefore, { budget: grant?.data.budget, spent: grant?.data.spentToday });
const cashBeforeRevoke = await total(seat);
await as(seat, "grant-revoke", [acmd.revokeGrant(grant!.cid)]);
const returned = (await total(seat)) - cashBeforeRevoke;
check("revoke returns the whole remaining budget", returned === BUDGET - charge + 1_000_000n, { returned });
check("no grant is left naming the runner", (await grantOf()) === null);
const cashEnd = await total(seat);
check("seat-1's cash reconciles: start − cost + payout", cashEnd === cash0 - charge + payout, { cash0, charge, payout, cashEnd });

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
