/**
 * The three parts of `first-call.ts`: the main market (real lane, real ops), the void market and the stale market
 * (the drive's own Series). Each check is one `step`, and so one acceptance row.
 */
import { randomUUID } from "node:crypto";
import { TEMPLATE_IDS } from "@agari/daml";
import type { LedgerClient } from "@agari/ledger";
import { appMarketId } from "@agari/markets/server";
import { decodeLeg, decodeOpenPrint, decodeQuote, decodeResolution, decodeTerms, decodeVenueCash, type LegC, type TermsC } from "@agari/markets/ops/canton";
import { shortParty } from "../../bootstrap/devnet-parties";
import type { CheckRow } from "../../bootstrap/rows";
import { staleBlocker, type FirstCallConfig } from "./config";
import { startDropProxy } from "./drop-proxy";
import { waitFor, type LedgerKit, type Roles, type Row } from "./ledger";
import type { Seat, WebClient } from "./seat";

export interface Ctx {
  config: FirstCallConfig;
  client: LedgerClient;
  roles: Roles;
  personas: { alice: string; bob: string; outsider: string };
  kit: LedgerKit;
  web: WebClient;
  step: (check: string, body: () => Promise<Omit<CheckRow, "check"> | null>) => Promise<boolean>;
  run: string;
  seats: { A: Seat; B: Seat };
  log: (s: string) => void;
}

type Receipt = { pairId: string; resolved: string | null; cost: bigint; payout: bigint };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const credits = (base: bigint) => (Number(base) / 1_000_000).toFixed(2);
const cid = (c: string) => `${c.slice(0, 12)}…`;
const decodeReceipt = (v: unknown): Receipt => {
  const r = v as Record<string, string | null>;
  return { pairId: r.pairId!, resolved: r.resolved ?? null, cost: BigInt(r.cost!), payout: BigInt(r.payout!) };
};
/** The owner's leg on a Window, as the owner reads it. */
const legOf = async (ctx: Ctx, seat: Seat, marketId: string) =>
  (await ctx.kit.acs(seat.party!, TEMPLATE_IDS.Leg, decodeLeg)).find((l) => l.data.owner === seat.party && l.data.marketId === marketId);
const receiptOf = (ctx: Ctx, seat: Seat, pairId: string) => async () =>
  (await ctx.kit.acs(seat.party!, TEMPLATE_IDS.SettlementReceipt, decodeReceipt)).find((r) => r.data.pairId === pairId);
const mask = (text: string) => text.replace(/([A-Za-z0-9_\-:.]+)::1220[0-9a-f]{64}/g, "$1::1220…");

/** The lane's Window that ops is quoting now: open print recorded, at least 25 s before lock. */
async function quotingWindow(ctx: Ctx): Promise<Row<TermsC> | undefined> {
  const now = Date.now() / 1000;
  const terms = (await ctx.kit.acs(ctx.roles.venue, TEMPLATE_IDS.MarketTerms, decodeTerms)).filter((t) => t.data.seriesKey === ctx.config.lane && t.data.tradingStartSec <= now && t.data.lockAtSec - now >= 25);
  if (!terms.length) return undefined;
  const opened = new Set((await ctx.kit.acs(ctx.roles.venue, TEMPLATE_IDS.OpenPrint, decodeOpenPrint)).map((o) => o.data.termsCid));
  return terms.find((t) => opened.has(t.cid));
}

/** A firm quote from ops through the web, on `terms` (else the lane's quoting Window), requoting once if the cap is low. */
async function firmQuote(ctx: Ctx, seat: Seat, side: "up" | "down", stakeBase: bigint, terms?: Row<TermsC>) {
  const until = Date.now() + 150_000;
  let last = "no Window with an open print yet";
  for (;;) {
    const win = terms ?? (await quotingWindow(ctx));
    if (win) {
      const body = { marketId: appMarketId(win.data.marketId), side, stakeBase, displayedMaxCostBase: (stakeBase * 11n) / 10n };
      let r = await ctx.web.call(seat, "POST", "/api/ledger/quotes", body);
      if (r.json.kind === "requote") r = await ctx.web.call(seat, "POST", "/api/ledger/quotes", { ...body, displayedMaxCostBase: BigInt(r.json.quote.maxCostBase) });
      if (r.json.kind === "quote") {
        const q = (await ctx.kit.acs(seat.party!, TEMPLATE_IDS.Quote, decodeQuote)).find((x) => x.cid === r.json.quoteCid);
        if (q) return { win, q };
      }
      last = `${r.status} ${r.json.kind ?? ""} ${r.json.diagnosis?.kind ?? ""}: ${String(r.json.diagnosis?.technical ?? "").slice(0, 120)}`;
      if (terms) throw new Error(`no firm quote: ${last}`);
    }
    if (Date.now() > until) throw new Error(`no firm quote on ${ctx.config.lane} in 150 s (last: ${last})`);
    await sleep(3_000);
  }
}

export async function runMain(ctx: Ctx): Promise<void> {
  const { kit, web, roles, step, seats: { A, B } } = ctx;
  const stakeBase = BigInt(Math.round(ctx.config.stakeCredits * 1_000_000));
  let win: Row<TermsC> | undefined;
  let quoteA: Awaited<ReturnType<typeof firmQuote>>["q"] | undefined;
  let legA: Row<LegC> | undefined;
  let legB: Row<LegC> | undefined;

  if (!(await step("quote (seat A, Up, a firm quote from ops)", async () => {
    const got = await firmQuote(ctx, A, "up", stakeBase);
    win = got.win;
    quoteA = got.q;
    const q = got.q.data;
    return { outcome: "pass", detail: `${ctx.config.lane} Window ${q.marketId}: ${q.lots} lots Up at ${q.priceTicks} (cost ${credits(q.lots * BigInt(q.priceTicks) * q.cashUnit)} + fee ${credits(q.fee)} credits), valid until ${new Date(q.validUntilSec * 1000).toISOString().slice(11, 19)}Z`, evidence: `update ${await kit.updateIdAt(A.party!, got.q.offset)} (Desk_IssueQuote by ops)` };
  }))) return;

  await step("prepare (dry run of seat A's accept shows the cost)", async () => {
    const q = quoteA!.data;
    const cost = q.lots * BigInt(q.priceTicks) * q.cashUnit + q.fee;
    const cash = (await kit.acs(A.party!, TEMPLATE_IDS.VenueCash, decodeVenueCash)).filter((c) => c.data.owner === A.party);
    const picked: string[] = [];
    let sum = 0n;
    for (const c of cash) if (sum < cost) (picked.push(c.cid), (sum += c.data.amount));
    const synchronizerId = (await ctx.client.connectedSynchronizers())[0]!.synchronizerId;
    const prep = await ctx.client.prepare({
      commandId: `first-call:${ctx.run}:prepare`, actAs: [A.party!], synchronizerId, packageIdSelectionPreference: [],
      commands: [{ ExerciseCommand: { templateId: TEMPLATE_IDS.Quote, contractId: quoteA!.cid, choice: "Quote_Accept", choiceArgument: { cash: picked, beneficiaryRef: null } } }],
    });
    const traffic = prep.costEstimation ? `${prep.costEstimation.totalTrafficCostEstimation} bytes of traffic` : "no traffic estimate from this node";
    return { outcome: sum >= cost ? "pass" : "fail", detail: `prepared, not executed (hash ${prep.preparedTransactionHash.slice(0, 16)}…): the call costs ${credits(cost)} credits = stake ${credits(cost - q.fee)} + fee ${credits(q.fee)}; ${traffic}; the seat holds ${credits(sum)} in ${picked.length} cash contract(s)`, evidence: "POST /v2/interactive-submission/prepare" };
  });

  if (!(await step("accept (seat A, through the web)", async () => {
    const r = await web.call(A, "POST", `/api/ledger/quotes/${quoteA!.cid}/accept`, { commandId: randomUUID() });
    legA = await legOf(ctx, A, quoteA!.data.marketId);
    const ok = r.json.kind === "confirmed" && !!legA;
    return { outcome: ok ? "pass" : "fail", detail: ok ? `${shortParty(A.party!)} holds leg ${cid(legA!.cid)}: ${legA!.data.lots} lots ${legA!.data.outcome}, cost ${credits(legA!.data.backingShare)} + fee ${credits(legA!.data.feePaid)}` : JSON.stringify(r.json).slice(0, 200), evidence: `update ${r.json.updateId ?? "—"}` };
  }))) return;

  await step("killed submit reconciled (seat B's accept, response dropped, same commandId re-sent)", async () => {
    const { q } = await firmQuote(ctx, B, "down", stakeBase, win);
    const proxy = await startDropProxy(ctx.config.web);
    const commandId = randomUUID();
    let killed = false;
    try {
      await web.call(B, "POST", `/api/ledger/quotes/${q.cid}/accept`, { commandId }, { via: proxy.url });
    } catch {
      killed = true;
    }
    await proxy.close();
    const again = await web.call(B, "POST", `/api/ledger/quotes/${q.cid}/accept`, { commandId });
    const legs = (await kit.acs(B.party!, TEMPLATE_IDS.Leg, decodeLeg)).filter((l) => l.data.owner === B.party && l.data.pairId === q.data.pairId);
    legB = legs[0];
    const ok = killed && proxy.dropped[0]?.status === 200 && again.json.kind === "confirmed" && again.json.recovered === true && legs.length === 1;
    return { outcome: ok ? "pass" : "fail", detail: `the web answered ${proxy.dropped[0]?.status ?? "nothing"} and the client got ${killed ? "a dropped socket" : "a reply"}; the re-send answered ${again.json.kind}, recovered ${again.json.recovered}; ${shortParty(B.party!)} holds ${legs.length} Leg for pair ${q.data.pairId}`, evidence: `update ${again.json.updateId ?? "—"}` };
  });

  const aCids = new Set<string>();
  await step("owner view (seat A: /api/view?as=me)", async () => {
    const v = await web.call(A, "GET", "/api/view?as=me");
    for (const r of v.json.rows ?? []) aCids.add(r.contractId);
    const kinds = (v.json.rows ?? []).map((r: { template: string }) => r.template).join(", ");
    const ok = v.json.party === A.party && aCids.has(legA!.cid);
    return { outcome: ok ? "pass" : "fail", detail: `queried as ${shortParty(v.json.party ?? "?::")}: ${v.json.rows?.length ?? 0} rows (${kinds}); A's leg ${cid(legA!.cid)} is there`, evidence: `GET /api/view?as=me at offset ${v.json.activeAtOffset}` };
  });

  await step("second seat empty (seat B and the alice/bob personas see none of A's contracts)", async () => {
    const seen: string[] = [];
    let leaked = 0;
    for (const [who, seat, as] of [["seat B", B, "me"], ["alice", null, "alice"], ["bob", null, "bob"]] as const) {
      const v = await web.call(seat, "GET", `/api/view?as=${as}`);
      const rows: Array<{ contractId: string }> = v.json.rows ?? [];
      const mine = rows.filter((r) => aCids.has(r.contractId)).length;
      leaked += mine + (v.status === 200 ? 0 : 1);
      seen.push(`${who} ${rows.length} rows, ${mine} of A's`);
    }
    const bHasOwn = legB ? (await web.call(B, "GET", "/api/view?as=me")).json.rows?.some((r: { contractId: string }) => r.contractId === legB!.cid) : false;
    return { outcome: leaked === 0 ? "pass" : "fail", detail: `${seen.join("; ")}${bHasOwn ? "; B sees its own leg only" : ""}`, evidence: "GET /api/view?as=me|alice|bob" };
  });

  await step("outsider empty (/api/view?as=outsider)", async () => {
    const v = await web.call(null, "GET", "/api/view?as=outsider");
    const body = JSON.stringify(v.json.request ?? null);
    ctx.log(`the outsider's query, as sent to the participant: ${body}`);
    const ok = v.status === 200 && (v.json.rows?.length ?? -1) === 0 && Object.keys(v.json.request?.eventFormat?.filtersByParty ?? {})[0] === ctx.personas.outsider;
    return { outcome: ok ? "pass" : "fail", detail: `${v.json.rows?.length ?? "no"} rows; body ${mask(body)}`, evidence: `GET /api/view?as=outsider at offset ${v.json.activeAtOffset}` };
  });

  await step("venue view (the fourth viewpoint: the counterparty sees both legs)", async () => {
    const legs = (await kit.acs(roles.venue, TEMPLATE_IDS.Leg, decodeLeg)).filter((l) => l.data.marketId === win!.data.marketId);
    const both = legs.some((l) => l.cid === legA!.cid) && (!legB || legs.some((l) => l.cid === legB!.cid));
    return { outcome: both ? "pass" : "fail", detail: `${legs.length} legs on the Window as ${shortParty(roles.venue)}: seat A's and seat B's, with the venue's opposite legs`, evidence: "POST /v2/state/active-contracts as the venue" };
  });

  const res = await waitFor("the Resolution", async () => (await kit.acs(roles.resolver, TEMPLATE_IDS.Resolution, decodeResolution)).find((r) => r.data.marketId === win!.data.marketId), Math.max(0, win!.data.expirySec * 1000 - Date.now()) + 180_000, 3_000).catch((e: Error) => e);
  await step("three attestations (the Window's close)", async () => {
    if (res instanceof Error) throw res;
    const ev = res.data.closeEvidence;
    const byOracle = ev.map((e) => `${shortParty(e.oracle)} ${(Number(e.priceE8) / 1e8).toFixed(2)}`);
    const ids = await Promise.all((await kit.acs(roles.venue, TEMPLATE_IDS.PriceQuote, (v) => v)).filter((p) => ev.some((e) => e.quoteCid === p.cid)).map((p) => kit.updateIdAt(roles.venue, p.offset)));
    const distinct = new Set(ev.map((e) => e.oracle)).size;
    return { outcome: distinct === 3 ? "pass" : "fail", detail: `${distinct} of 3 oracles counted at ${new Date(win!.data.expirySec * 1000).toISOString()}: ${byOracle.join(", ")}`, evidence: ids.length ? `updates ${ids.join(", ")}` : "prints retired; counted in the Resolution" };
  });
  await step("resolve (the resolver, from the prints)", async () => {
    if (res instanceof Error) throw res;
    const r = res.data;
    const what = r.outcome ? `${r.outcome} (open ${(Number(r.openPriceE8) / 1e8).toFixed(2)} → close ${(Number(r.closePriceE8) / 1e8).toFixed(2)})` : `void (${r.voidReason?.tag}, ${r.voidReason?.slot})`;
    return { outcome: r.outcome ? "pass" : "fail", detail: `${what}, signed by ${shortParty(r.resolver)}`, evidence: `update ${await kit.updateIdAt(roles.resolver, res.offset)}` };
  });
  await step("settle (the venue pays; neither seat signs)", async () => {
    if (res instanceof Error) throw res;
    const out: string[] = [];
    const ids: string[] = [];
    let ok = true;
    for (const [seat, leg] of [[A, legA], [B, legB]] as const) {
      if (!leg) continue;
      const got = await waitFor(`${seat.name}'s settlement receipt`, receiptOf(ctx, seat, leg.data.pairId), 180_000, 3_000);
      const won = got.data.resolved === leg.data.outcome;
      const expect = won ? leg.data.lots * 1000n * leg.data.cashUnit : 0n;
      ok &&= got.data.payout === expect && !(await legOf(ctx, seat, leg.data.marketId));
      out.push(`${seat.name} ${leg.data.outcome} ${won ? `won: paid ${credits(got.data.payout)}` : "lost: paid 0"} credits`);
      ids.push(await kit.updateIdAt(seat.party!, got.offset));
    }
    return { outcome: ok ? "pass" : "fail", detail: `${out.join("; ")}; no command from either seat after its accept`, evidence: `updates ${[...new Set(ids)].join(", ")}` };
  });
}

/** A Window of the drive's own Series with one leg of seat A on it: opened, venue-quoted, accepted through the web. */
async function driveLeg(ctx: Ctx, seriesKey: string, symbol: string, lockInSec: number, o: { side: "SideUp" | "SideDown"; priceTicks: number }) {
  const win = await ctx.kit.openSpan(seriesKey, symbol, { lockInSec });
  const q = await ctx.kit.issueQuote(win.terms, ctx.seats.A.party!, { ...o, lots: 10n });
  const acc = await ctx.web.call(ctx.seats.A, "POST", `/api/ledger/quotes/${q.quoteCid}/accept`, { commandId: randomUUID() });
  if (acc.json.kind !== "confirmed") throw new Error(`seat A's accept on ${seriesKey}: ${JSON.stringify(acc.json).slice(0, 200)}`);
  const leg = await legOf(ctx, ctx.seats.A, win.terms.data.marketId);
  if (!leg) throw new Error(`no leg of seat A on ${win.terms.data.marketId}`);
  return { win, q, leg, ids: `open ${win.updateId}, quote ${q.updateId}, accept ${acc.json.updateId}` };
}

export async function runVoid(ctx: Ctx): Promise<void> {
  let d: Awaited<ReturnType<typeof driveLeg>> | undefined;
  if (!(await ctx.step("void market: open, venue quote, accept (seat A)", async () => {
    d = await driveLeg(ctx, "first-call-void", "FCVOID", 120, { side: "SideUp", priceTicks: 600 });
    return { outcome: "pass", detail: `Window ${d.win.terms.data.marketId}: seat A holds 10 lots Up at 600 (cost ${credits(d.q.cost)} + fee ${credits(d.q.fee)} credits)`, evidence: d.ids };
  }))) return;
  await ctx.step("void on disagreement (the three opens disagree)", async () => {
    const pr = await ctx.kit.prints(d!.win.terms, d!.win.terms.data.tradingStartSec, [100_000_000n, 100_000_000n, 110_000_000n]);
    const out = await ctx.kit.recordOpen(d!.win.terms, d!.win.stateCid, pr.quoteCids);
    const r = out.resolution ? decodeResolution(out.resolution.createArgument) : null;
    const ok = !!r && r.outcome === null && r.voidReason?.tag === "SourceDisagreement";
    return { outcome: ok ? "pass" : "fail", detail: `prints 1.00, 1.00 and 1.10 are 10% apart and the Series allows 1%: Terms_RecordOpen ${r ? `voided the Window (${r.voidReason?.tag}, ${r.voidReason?.slot})` : "recorded an open instead"}`, evidence: `prints ${pr.updateIds.join(", ")}; void ${out.updateId}` };
  });
  await ctx.step("void refund (cost + fee back to seat A)", async () => {
    const want = d!.q.cost + d!.q.fee;
    const settled = await waitFor("ops' settler", receiptOf(ctx, ctx.seats.A, d!.leg.data.pairId), 45_000, 3_000).catch(() => null);
    if (settled) {
      const ok = settled.data.resolved === null && settled.data.payout === want;
      return { outcome: ok ? "pass" : "fail", detail: `settled by the venue: ${credits(settled.data.payout)} credits back = cost ${credits(d!.q.cost)} + fee ${credits(d!.q.fee)}`, evidence: `update ${await ctx.kit.updateIdAt(ctx.seats.A.party!, settled.offset)}` };
    }
    const c = await ctx.web.call(ctx.seats.A, "POST", "/api/ledger/legs/claim", { commandId: randomUUID(), marketId: appMarketId(d!.win.terms.data.marketId) });
    const ok = c.json.kind === "confirmed" && BigInt(c.json.payoutBase ?? -1) === want;
    return { outcome: ok ? "pass" : "fail", detail: `ops did not settle within 45 s, so seat A claimed: ${c.json.kind}, ${credits(BigInt(c.json.payoutBase ?? 0))} credits back (cost + fee = ${credits(want)})`, evidence: `update ${c.json.updateId ?? "—"}` };
  });
}

/** Does `url` answer within `ms`? */
async function answers(url: string, ms: number): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(ms) });
    return true;
  } catch {
    return false;
  }
}

export async function runStale(ctx: Ctx): Promise<void> {
  const { config, seats: { A } } = ctx;
  const blocker = staleBlocker(config);
  if (blocker) {
    await ctx.step("stale refund with ops stopped", async () => ({ outcome: "skip", detail: blocker }));
    return;
  }
  const pid = config.opsPid;
  if (pid !== null) process.kill(pid, "SIGSTOP");
  try {
    await ctx.step("stale refund with ops stopped", async () => {
      const silent = config.ops ? !(await answers(`${config.ops}/health`, 3_000)) : null;
      if (silent === false) return { outcome: "fail", detail: `ops still answers ${config.ops}/health: stop it first` };
      const topUp = (await ctx.web.balance(A)) < 10_000_000n;
      // With ops stopped a fresh lease is not funded (DevNet `--only stale`): the venue and the seat sign demo cash directly.
      if (topUp) await ctx.kit.write("venue", ctx.roles.venue, "stale-topup", [{ CreateCommand: { templateId: TEMPLATE_IDS.VenueCash, createArguments: { venue: ctx.roles.venue, owner: A.party, amount: "10000000", bucket: "demo" } } }], [A.party!]);
      const d = await driveLeg(ctx, "first-call-stale", "FCSTALE", 45, { side: "SideDown", priceTicks: 400 });
      const marketId = appMarketId(d.win.terms.data.marketId);
      const early = await ctx.web.call(A, "POST", "/api/ledger/legs/refund-stale", { commandId: randomUUID(), marketId });
      await sleep(Math.max(0, (d.win.terms.data.refundAfterSec + 2) * 1000 - Date.now()));
      const r = await ctx.web.call(A, "POST", "/api/ledger/legs/refund-stale", { commandId: randomUUID(), marketId });
      const want = d.leg.data.backingShare + d.leg.data.feePaid;
      const ok = r.json.kind === "confirmed" && BigInt(r.json.payoutBase ?? -1) === want && early.json.diagnosis?.kind === "not-settled";
      const how = pid !== null ? `ops frozen (SIGSTOP pid ${pid})` : "pm-ops stopped by the operator";
      return { outcome: ok ? "pass" : "fail", detail: `${how}${silent ? ", /health silent" : ""}${topUp ? ", seat funded by the venue" : ""}; before refundAfter: ${early.json.diagnosis?.kind ?? early.json.kind}; after: ${r.json.kind}, ${credits(BigInt(r.json.payoutBase ?? 0))} credits back = backing ${credits(d.leg.data.backingShare)} + fee ${credits(d.leg.data.feePaid)}`, evidence: `${d.ids}; refund ${r.json.updateId ?? "—"}` };
    });
  } finally {
    if (pid !== null) process.kill(pid, "SIGCONT");
  }
}

