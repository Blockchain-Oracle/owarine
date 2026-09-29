// The projector scenario's ledger steps (see projector-scenario.ts): three Windows on a local sandbox driven through
// open, quotes, accepts, a publication and a retraction, a buy-back, a venue merge, an expired and a withdrawn quote,
// oracle prints, a resolution, a void (source disagreement), batch settlement and a stale refund.
import { T, allocate, create, createdOf, exercise, oneCreated, priceQuote, seriesArgs, untilSec, nowSec, type Session, type Side, type Window } from "./pm-ledger";

export const CASH_UNIT = 1000;
const CADENCE = 40;
const LOCK_LEAD = 10;
const CLOSE_ADMISSION = 20;
const SETTLE_GRACE = 5;

export interface Cast {
  venue: string;
  resolver: string;
  auditor: string;
  oracles: string[];
  alice: string;
  bob: string;
}

export interface World {
  s: Session;
  p: Cast;
  anchor: number;
  win: Record<"A" | "B" | "C", Window & { symbol: string }>;
  shards: string[];
  cash: Record<string, string[]>;
  legs: Record<string, string>;
  maxOffset: number;
  log: (line: string) => void;
}

export async function cast(s: Session): Promise<Cast> {
  const [venue, resolver, auditor, o1, o2, o3, alice, bob] = await Promise.all(
    ["venue", "resolver", "auditor", "oracle1", "oracle2", "oracle3", "alice", "bob"].map((h) => allocate(s, `c3a-${h}`)),
  );
  return { venue: venue!, resolver: resolver!, auditor: auditor!, oracles: [o1!, o2!, o3!], alice: alice!, bob: bob! };
}

async function sub(w: World, actAs: string, id: string, commands: Parameters<Session["submit"]>[2]) {
  const tx = await w.s.submit(actAs, id, commands, actAs === w.p.venue ? [] : [w.p.venue]);
  w.maxOffset = Math.max(w.maxOffset, tx.offset);
  return tx;
}

export async function setup(s: Session, p: Cast, log: (l: string) => void): Promise<World> {
  const anchor = nowSec() + 30;
  const w: World = { s, p, anchor, win: {} as World["win"], shards: [], cash: { [p.alice]: [], [p.bob]: [] }, legs: {}, maxOffset: 0, log };
  log(`setup: anchor ${new Date(anchor * 1000).toISOString()} (lockAt +${CADENCE - LOCK_LEAD}s, expiry +${CADENCE}s, refundAfter +${CADENCE + CLOSE_ADMISSION + SETTLE_GRACE}s)`);
  await sub(w, p.venue, "desk", [create(T.VenueDesk, { venue: p.venue })]);
  const shardTx = await sub(w, p.venue, "shards", Array.from({ length: 14 }, () => create(T.VenueCash, { venue: p.venue, owner: p.venue, amount: "100000000", bucket: "shard" })));
  w.shards = createdOf(shardTx, T.VenueCash).map((c) => c.contractId);
  const symbols = { A: "BTC", B: "ETH", C: "SOL" } as const;
  for (const k of ["A", "B", "C"] as const) {
    const seriesKey = `${symbols[k]}-c3a-${s.run}`;
    const spec = {
      venue: p.venue, resolver: p.resolver, auditor: p.auditor, oracles: p.oracles, seriesKey, symbol: symbols[k], anchorSec: anchor, cadenceSec: CADENCE,
      lockLeadSec: LOCK_LEAD, settleGraceSec: SETTLE_GRACE, cashUnit: CASH_UNIT, closeAdmissionSec: CLOSE_ADMISSION, maxDeviationBps: 50,
    };
    const seriesCid = oneCreated(await sub(w, p.venue, `series:${k}`, [create(T.Series, seriesArgs(spec))]), T.Series);
    const open = await sub(w, p.venue, `open:${seriesKey}:0`, [exercise(T.Series, seriesCid, "Series_OpenWindow", { index: "0" })]);
    w.win[k] = { key: `${seriesKey}:0`, symbol: symbols[k], termsCid: oneCreated(open, T.MarketTerms), stateCid: oneCreated(open, T.WindowState) };
  }
  for (const [user, label] of [[p.alice, "alice"], [p.bob, "bob"]] as const) {
    const invite = oneCreated(await sub(w, p.venue, `invite:${label}`, [create(T.VenueAccountInvite, { venue: p.venue, owner: user, label })]), T.VenueAccountInvite);
    const account = oneCreated(await sub(w, user, `join:${label}`, [exercise(T.VenueAccountInvite, invite, "Invite_Accept")]), T.VenueAccount);
    const credit = await sub(w, p.venue, `credit:${label}`, Array.from({ length: 6 }, () => exercise(T.VenueAccount, account, "VenueAccount_Credit", { amount: "100000000", bucket: "demo" })));
    w.cash[user] = createdOf(credit, T.VenueCash).map((c) => c.contractId);
  }
  // Open prints at the anchor, one command per oracle covering every symbol (commandId print:<oracle>:<T>).
  const openPx = { BTC: [6_000_000_000_000, 6_000_100_000_000, 6_000_200_000_000], ETH: [300_000_000_000, 300_000_000_000, 300_000_000_000], SOL: [15_000_000_000, 15_000_000_000, 15_000_000_000] };
  await postPrints(w, anchor, openPx);
  return w;
}

async function postPrints(w: World, boundary: number, px: Record<string, number[]>): Promise<void> {
  for (const [i, oracle] of w.p.oracles.entries()) {
    await sub(w, oracle, `print:${i}:${boundary}`, Object.entries(px).map(([symbol, prices]) => priceQuote(oracle, w.p.venue, w.p.resolver, symbol, boundary, prices[i]!)));
  }
}

async function quoteIds(w: World, symbol: string, boundary: number): Promise<string[]> {
  const out: string[] = [];
  for await (const page of w.s.c.iterateActiveContracts({ parties: [w.p.resolver], templateIds: [T.PriceQuote] })) {
    for (const c of page.contracts) {
      const a = c.createdEvent.createArgument as { symbol: string; boundaryT: string };
      if (a.symbol === symbol && Math.floor(Date.parse(a.boundaryT) / 1000) === boundary) out.push(c.createdEvent.contractId);
    }
  }
  return out;
}

export async function recordOpens(w: World): Promise<void> {
  await untilSec(w.anchor + 1, "the open boundary", w.log);
  for (const k of ["A", "B", "C"] as const) {
    const win = w.win[k];
    const tx = await sub(w, w.p.resolver, `record-open:${k}`, [
      exercise(T.MarketTerms, win.termsCid, "Terms_RecordOpen", { stateCid: win.stateCid, quoteCids: await quoteIds(w, win.symbol, w.anchor) }),
    ]);
    win.openCid = oneCreated(tx, T.OpenPrint);
  }
  w.log("recorded the open print on A, B, C");
}

async function issue(w: World, user: string, k: "A" | "B" | "C", side: Side, ticks: number, lots: number, fee: number, pairId: string, validFor = 20) {
  const lockAt = w.anchor + CADENCE - LOCK_LEAD;
  const validUntil = Math.min(nowSec() + validFor, lockAt);
  const tx = await sub(w, w.p.venue, `quote:${pairId}`, [
    exercise(T.VenueDesk, await desk(w), "Desk_IssueQuote", {
      shardCid: w.shards.pop()!, user, termsCid: w.win[k].termsCid, pairId, side, priceTicks: String(ticks), lots: String(lots), fee: String(fee),
      validUntil: new Date(validUntil * 1000).toISOString(),
    }),
  ]);
  return oneCreated(tx, T.Quote);
}

let deskCid: string | null = null;
async function desk(w: World): Promise<string> {
  if (deskCid) return deskCid;
  for await (const page of w.s.c.iterateActiveContracts({ parties: [w.p.venue], templateIds: [T.VenueDesk] })) deskCid = page.contracts[0]?.createdEvent.contractId ?? deskCid;
  if (!deskCid) throw new Error("no VenueDesk");
  return deskCid;
}

async function take(w: World, user: string, k: "A" | "B" | "C", side: Side, ticks: number, lots: number, fee: number, name: string): Promise<void> {
  const pairId = `${name}:${w.s.run}`;
  const quote = await issue(w, user, k, side, ticks, lots, fee, pairId);
  const tx = await sub(w, user, `accept:${pairId}`, [exercise(T.Quote, quote, "Quote_Accept", { cash: [w.cash[user]!.pop()!], beneficiaryRef: null })]);
  w.legs[name] = oneCreated(tx, T.Leg, (a) => a.owner === user);
  w.legs[`${name}/venue`] = oneCreated(tx, T.Leg, (a) => a.owner === w.p.venue);
}

export async function trade(w: World): Promise<void> {
  const { alice, bob, venue } = w.p;
  await take(w, alice, "A", "SideUp", 600, 10, 5, "A-alice");
  await take(w, bob, "A", "SideDown", 400, 10, 5, "A-bob");
  await take(w, bob, "A", "SideUp", 550, 5, 3, "A-bob2");
  await sub(w, alice, "publish:A-alice", [exercise(T.Leg, w.legs["A-alice"]!, "Leg_Publish", { handle: "alice" })]);
  await sub(w, venue, "merge:A", [exercise(T.Leg, w.legs["A-alice/venue"]!, "Leg_Merge", { otherCid: w.legs["A-bob/venue"]! })]);
  const bq = oneCreated(await sub(w, venue, "buyquote:A-bob2", [exercise(T.VenueDesk, await desk(w), "Desk_IssueBuyQuote", {
    shardCid: w.shards.pop()!, legCid: w.legs["A-bob2"]!, priceTicks: "500", validUntil: new Date(Math.min(nowSec() + 20, w.anchor + CADENCE - LOCK_LEAD) * 1000).toISOString(),
  })]), T.BuyQuote);
  const sold = await sub(w, bob, "sell:A-bob2", [exercise(T.BuyQuote, bq, "BuyQuote_Accept")]);
  w.legs["A-bob2/buyback"] = oneCreated(sold, T.Leg, (a) => a.owner === venue);
  w.log("A: alice Up 10 @600, bob Down 10 @400, bob Up 5 @550 then sold back @500; alice published; venue merged its pair");

  await take(w, alice, "B", "SideUp", 500, 20, 10, "B-alice");
  await take(w, bob, "B", "SideDown", 500, 20, 10, "B-bob");
  await sub(w, alice, "publish:B-alice", [exercise(T.Leg, w.legs["B-alice"]!, "Leg_Publish", { handle: "alice" })]);
  const pub = oneCreated(await sub(w, bob, "publish:B-bob", [exercise(T.Leg, w.legs["B-bob"]!, "Leg_Publish", { handle: "bob" })]), T.Publication);
  await sub(w, bob, "retract:B-bob", [exercise(T.Publication, pub, "Publication_Retract")]);
  w.log("B: alice Up 20 @500, bob Down 20 @500; alice published, bob published then retracted");

  await take(w, alice, "C", "SideUp", 300, 7, 2, "C-alice");
  w.legs.expiring = await issue(w, bob, "C", "SideDown", 700, 3, 1, `C-bob-exp:${w.s.run}`, 2);
  const withdrawn = await issue(w, alice, "C", "SideUp", 310, 4, 1, `C-alice-wd:${w.s.run}`);
  await sub(w, venue, "withdraw:C", [exercise(T.Quote, withdrawn, "Quote_Withdraw", { reason: "scenario" })]);
  // Left live to the end, so the recount compares live Quote and BuyQuote sets too.
  await issue(w, alice, "B", "SideDown", 480, 2, 1, `B-alice-live:${w.s.run}`);
  await sub(w, venue, "buyquote:C-alice", [exercise(T.VenueDesk, await desk(w), "Desk_IssueBuyQuote", {
    shardCid: w.shards.pop()!, legCid: w.legs["C-alice"]!, priceTicks: "250", validUntil: new Date((nowSec() + 3600) * 1000).toISOString(),
  })]);
  w.log("C: alice Up 7 @300; a quote to bob left to expire; a quote to alice withdrawn; a B quote and a C buy-back quote left live");
}

export async function resolve(w: World): Promise<void> {
  const expiry = w.anchor + CADENCE;
  await untilSec(expiry + 1, "expiry", w.log);
  // A closes up, B's oracles disagree past 50 bps (void), C closes down.
  await postPrints(w, expiry, { BTC: [6_010_000_000_000, 6_010_100_000_000, 6_010_200_000_000], ETH: [300_000_000_000, 330_000_000_000, 360_000_000_000], SOL: [14_900_000_000, 14_900_000_000, 14_900_000_000] });
  for (const k of ["A", "B", "C"] as const) {
    const win = w.win[k];
    const tx = await sub(w, w.p.resolver, `resolve:${win.termsCid.slice(0, 16)}`, [
      exercise(T.MarketTerms, win.termsCid, "Terms_Resolve", { openCid: win.openCid!, quoteCids: await quoteIds(w, win.symbol, expiry) }),
    ]);
    win.resolutionCid = oneCreated(tx, T.Resolution);
  }
  await sub(w, w.p.venue, "expire:C-bob", [exercise(T.Quote, w.legs.expiring!, "Quote_Expire")]);
  w.log("resolved A (Up) and C (Down), voided B (source disagreement); expired bob's C quote");
}

export async function settle(w: World): Promise<void> {
  const batch = async (k: "A" | "B" | "C", legs: string[]) =>
    sub(w, w.p.venue, `settle:${k}`, [exercise(T.VenueDesk, await desk(w), "Desk_SettleBatch", { legCids: legs, resolutionCid: w.win[k].resolutionCid! })]);
  const L = w.legs;
  await batch("A", [L["A-alice"]!, L["A-bob"]!, L["A-bob2/venue"]!, L["A-bob2/buyback"]!]);
  await batch("B", [L["B-alice"]!, L["B-bob"]!, L["B-alice/venue"]!, L["B-bob/venue"]!]);
  await batch("C", [L["C-alice/venue"]!]);
  w.log("settled A (4 legs) and B (4 legs, void refunds) in batches; C's venue leg only (alice's leg left for the stale refund)");
}

export async function staleRefund(w: World): Promise<void> {
  await untilSec(w.anchor + CADENCE + CLOSE_ADMISSION + SETTLE_GRACE + 1, "refundAfter", w.log);
  await sub(w, w.p.alice, "refund:C-alice", [exercise(T.Leg, w.legs["C-alice"]!, "Leg_RefundStale")]);
  w.log("alice took the stale refund on C");
}
