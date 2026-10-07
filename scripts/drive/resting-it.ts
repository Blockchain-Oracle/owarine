/**
 * C7c integration: the pre-open resting call end to end on a LOCAL stack (sandbox on abu-pm-main 0.5.1, the real ops with
 * its resting desk, the projector on Postgres, the built web app). Two seats lease through `/api/seat`, and on one listed
 * BTC-1m Window (the roller lists a 24/7 Window 120 s ahead) the drive:
 *
 *   before the bell   alice rests UP at 60¢ for 5 lots (A: crosses the venue's ladder after the bell) and UP at 1¢ for
 *                     4 lots (B: never crosses); bob rests DOWN at 40¢ (C) and cancels it. Each place holds the escrow in
 *                     the call: the seat's cash drops by exactly lots x price x cash unit. Bob cannot cancel or read
 *                     alice's calls. A second offer on the started Window is refused.
 *   after the bell    ops fills A at exactly 600 ticks (the ladder is 3 lots deep, so 3 then 2), the same Leg pair a firm
 *                     quote's accept makes; B is swept at its expiry and its escrow returns as venue credit; the Window
 *                     resolves and A's legs settle.
 *
 * Every row prints its update id (from the ledger's own answers and the projection). Exits 0 only when every check passes.
 *
 *   source <env>; pnpm --filter @owarine/scripts exec tsx drive/resting-it.ts [--web http://localhost:3130] [--db postgres://localhost:5432/pm_c7c]
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { restingQuote } from "@owarine/core/orders";
import { TEMPLATE_IDS } from "@owarine/daml";
import { ledgerClientFromEnv, parseLedgerEnv } from "@owarine/ledger";
import { parseMarketsEnv } from "@owarine/markets";
import { decodeLeg, decodeRestingCall, decodeTerms, decodeVenueCash, pick, readActive, type RoleSession } from "@owarine/markets/ops/canton";
import { appMarketId } from "@owarine/markets/server";
import { newSeat, webClient, type Seat } from "./first-call/seat";
import { waitFor } from "./first-call/ledger";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const WEB = arg("--web", "http://localhost:3130").replace(/\/+$/, "");
const DB = arg("--db", process.env.DATABASE_URL ?? "postgres://localhost:5432/pm_c7c");
const LANE = arg("--lane", "BTC-1m");
const nowSec = () => Math.floor(Date.now() / 1000);
const credits = (base: bigint) => (Number(base) / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
const short = (s: string) => `${s.slice(0, 12)}…`;

const rows: Array<{ check: string; ok: boolean; detail: string }> = [];
function record(check: string, ok: boolean, detail: string): boolean {
  rows.push({ check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${check} | ${detail}`);
  return ok;
}

/** One SQL statement against the projection's database, rows as arrays of text. */
function sql(query: string): string[][] {
  const out = execFileSync("psql", [DB, "-At", "-F", "|", "-c", query], { encoding: "utf8" }).trim();
  return out === "" ? [] : out.split("\n").map((l) => l.split("|"));
}

async function main(): Promise<number> {
  const parties = JSON.parse(readFileSync(process.env.OWARINE_PARTIES_FILE ?? "", "utf8")) as { parties: Record<string, string> };
  const client = ledgerClientFromEnv(parseLedgerEnv(process.env));
  const venue: RoleSession = { role: "venue", party: parties.parties.venue!, client, dryRun: false };
  const cluster = parseMarketsEnv({ cluster: process.env.NEXT_PUBLIC_CANTON_NETWORK }).cluster;
  const web = webClient(WEB, cluster);

  const alice = await newSeat("alice");
  const bob = await newSeat("bob");
  for (const s of [alice, bob]) {
    const r = await web.lease(s);
    const leased = r.json.kind === "leased";
    if (!record(`lease ${s.name}`, leased, leased ? `party ${short(String(r.json.party))}` : `${r.status} ${JSON.stringify(r.json).slice(0, 300)}`)) return 1;
  }
  const cash = async (s: Seat) => (await readActive({ ...venue, party: s.party! }, [TEMPLATE_IDS.VenueCash])).map((c) => decodeVenueCash(c.createdEvent.createArgument)).filter((c) => c.owner === s.party).reduce((n, c) => n + c.amount, 0n);
  await waitFor("alice's demo credits", async () => ((await cash(alice)) > 0n ? true : null), 120_000);
  await waitFor("bob's demo credits", async () => ((await cash(bob)) > 0n ? true : null), 120_000);
  const aliceStart = await cash(alice);
  const bobStart = await cash(bob);
  record("seats funded", true, `alice ${credits(aliceStart)}, bob ${credits(bobStart)} credits`);

  // ---- a listed Window with time to spare -------------------------------------------------------------------------
  const listed = await waitFor(
    `a listed ${LANE} Window with 50+ s to the bell`,
    async () => {
      const terms = pick(await readActive(venue, [TEMPLATE_IDS.MarketTerms]), TEMPLATE_IDS.MarketTerms, decodeTerms).filter((t) => t.data.seriesKey === LANE && t.data.tradingStartSec - nowSec() >= 50);
      return terms.sort((a, b) => a.data.tradingStartSec - b.data.tradingStartSec)[0] ?? null;
    },
    240_000,
    1_000,
  );
  const t = listed.data;
  const marketId = appMarketId(t.marketId);
  const cu = t.cashUnit;
  record("listed Window", true, `${t.marketId}: bell ${new Date(t.tradingStartSec * 1000).toISOString()}, lock ${new Date(t.lockAtSec * 1000).toISOString()} (${t.tradingStartSec - nowSec()} s to the bell), cash unit ${cu}`);

  const grid = { lotBase: cu * 1000n, tickBase: cu, cashUnit: cu, minLots: 1n };
  async function rest(s: Seat, side: "up" | "down", priceCents: number, lots: bigint) {
    const stakeBase = lots * BigInt(priceCents * 10) * cu;
    const sized = restingQuote({ side, priceCents, stakeBase, grid, decimals: 6, quotedAtMs: Date.now() });
    if (!sized.ok) throw new Error(`no resting quote: ${sized.blocker}`);
    const offer = await web.call(s, "POST", "/api/ledger/resting", { marketId, side, stakeBase, priceCents, restUntil: "bell", displayedEscrowBase: sized.quote.maxCostBase });
    if (offer.json.kind !== "offer") return { offer, placed: null, escrow: sized.quote.maxCostBase };
    const placed = await web.call(s, "POST", `/api/ledger/resting/${offer.json.offerCid}/place`, { commandId: randomUUID() });
    return { offer, placed, escrow: sized.quote.maxCostBase };
  }

  // A: alice UP 60c x 5 lots; B: alice UP 20c x 4 lots; C: bob DOWN 40c x 4 lots
  const a = await rest(alice, "up", 60, 5n);
  const aRef = String(a.placed?.json.rested?.callRef ?? "");
  const aOk = a.placed?.json.kind === "confirmed" && a.placed.json.rested.escrowBase === String(5n * 600n * cu);
  record("A placed: alice UP 60¢ x 5 lots", aOk, aOk ? `call ${aRef}, escrow ${credits(a.escrow)} held in the call, expires ${new Date(a.placed!.json.rested.expireSec * 1000).toISOString()}, update ${a.placed!.json.updateId}` : JSON.stringify(a.offer.json).slice(0, 300));
  // 1¢ = 10 ticks, under any price the venue's ladder can reach (its best UP is never under 20 ticks plus the spread): a call that never crosses.
  const b = await rest(alice, "up", 1, 4n);
  const bRef = String(b.placed?.json.rested?.callRef ?? "");
  const bOk = b.placed?.json.kind === "confirmed";
  record("B placed: alice UP 1¢ x 4 lots (never crosses)", bOk, bOk ? `call ${bRef}, escrow ${credits(b.escrow)}, update ${b.placed!.json.updateId}` : JSON.stringify(b.offer.json).slice(0, 300));
  const c = await rest(bob, "down", 40, 4n);
  const cRef = String(c.placed?.json.rested?.callRef ?? "");
  const cOk = c.placed?.json.kind === "confirmed";
  record("C placed: bob DOWN 40¢ x 4 lots", cOk, cOk ? `call ${cRef}, escrow ${credits(c.escrow)}, update ${c.placed!.json.updateId}` : JSON.stringify(c.offer.json).slice(0, 300));
  if (!aOk || !bOk || !cOk) return 1;

  const aliceHeld = await cash(alice);
  record("escrow is held in the calls, not promised", aliceHeld === aliceStart - a.escrow - b.escrow, `alice's cash ${credits(aliceStart)} → ${credits(aliceHeld)} (A ${credits(a.escrow)} + B ${credits(b.escrow)} held)`);
  const calls = pick(await readActive(venue, [TEMPLATE_IDS.RestingCall]), TEMPLATE_IDS.RestingCall, decodeRestingCall);
  record("the venue holds the calls", calls.filter((x) => x.data.marketId === t.marketId).length === 3, `${calls.length} RestingCall contracts on the ledger (venue view)`);

  // other seats see nothing, and cannot cancel another's call
  const bobCancelsAlice = await web.call(bob, "POST", "/api/ledger/resting/cancel", { commandId: randomUUID(), marketId, callRefs: [aRef] });
  record("bob cannot cancel alice's call", bobCancelsAlice.json.kind === "gone", `bob's cancel of ${aRef}: ${bobCancelsAlice.json.kind}`);
  const bobViews = await web.call(bob, "GET", `/api/index/wallet/${alice.address}/resting`);
  record("bob cannot read alice's resting rows", bobViews.status === 401 || bobViews.status === 403, `GET /api/index/wallet/<alice>/resting as bob → ${bobViews.status}`);
  const bobOwn = await web.call(bob, "GET", `/api/index/wallet/${bob.address}/resting`);
  const bobRows = (bobOwn.json.rows ?? []) as { call_ref: string }[];
  record("bob reads only his own", bobOwn.status === 200 && bobRows.length === 1 && bobRows[0]!.call_ref === cRef, `${bobRows.length} row(s): ${bobRows.map((r) => r.call_ref).join(", ")}`);

  // C: cancelled before the bell, escrow back as venue credit
  const cancel = await web.call(bob, "POST", "/api/ledger/resting/cancel", { commandId: randomUUID(), marketId, callRefs: [cRef] });
  const bobAfter = await cash(bob);
  record("C cancelled: the escrow is back as venue credit", cancel.json.kind === "confirmed" && bobAfter === bobStart, `${credits(BigInt(cancel.json.refundedBase ?? 0))} back, bob's cash ${credits(bobAfter)} of ${credits(bobStart)}, update ${cancel.json.updateId}`);

  // ---- the bell ------------------------------------------------------------------------------------------------------
  const toBell = t.tradingStartSec - nowSec();
  console.log(`waiting ${toBell} s for the bell…`);
  await waitFor("the bell", async () => (nowSec() >= t.tradingStartSec + 1 ? true : null), (toBell + 30) * 1000, 500);
  const late = await web.call(alice, "POST", "/api/ledger/resting", {
    marketId, side: "up", stakeBase: 600n * cu, priceCents: 60, restUntil: "bell", displayedEscrowBase: 600n * cu,
  });
  record("a call on the started Window is refused", late.json.kind === "refused", `${late.json.diagnosis?.kind}: ${String(late.json.diagnosis?.technical ?? "").slice(0, 120)}`);

  // A: filled at exactly 600 ticks, 3 then 2 lots
  const fills = await waitFor(
    "A's fills",
    async () => {
      const r = sql(`SELECT update_id, lots::text, side_ticks, price_ticks, fee::text, resting FROM idx_fills WHERE owner_party = '${alice.party}' AND market = '${marketId}' ORDER BY ledger_offset`);
      return r.reduce((n, x) => n + Number(x[1]), 0) >= 5 ? r : null;
    },
    120_000,
    1_000,
  );
  const fillOk = fills.every((f) => f[2] === "600" && f[4] === "0" && f[5] === "t") && fills.reduce((n, f) => n + Number(f[1]), 0) === 5;
  record("A filled at exactly the call's price, in part then in full", fillOk, `${fills.map((f) => `${f[1]} lots @ ${f[2]} ticks, fee ${f[4]}, update ${f[0]}`).join(" · ")}`);
  const legs = pick(await readActive({ ...venue, party: alice.party! }, [TEMPLATE_IDS.Leg]), TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.owner === alice.party && l.data.marketId === t.marketId);
  const legLots = legs.reduce((n, l) => n + l.data.lots, 0n);
  const legBacking = legs.reduce((n, l) => n + l.data.backingShare, 0n);
  record("alice's legs equal a normal accept's: lots x price x cash unit, no fee", legLots === 5n && legBacking === 5n * 600n * cu && legs.every((l) => l.data.feePaid === 0n && l.data.outcome === "SideUp"), `${legs.length} leg(s), ${legLots} lots, backing ${credits(legBacking)} = 5 x 600 x ${cu}`);
  const venueLegs = pick(await readActive(venue, [TEMPLATE_IDS.Leg]), TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.owner === venue.party && l.data.marketId === t.marketId);
  const vLots = venueLegs.filter((l) => l.data.outcome === "SideDown").reduce((n, l) => n + l.data.lots, 0n);
  record("the venue holds the opposite side, locked from its own shard", vLots >= 5n && venueLegs.filter((l) => l.data.outcome === "SideDown").reduce((n, l) => n + l.data.backingShare, 0n) >= 5n * 400n * cu, `venue Down legs: ${vLots} lots (backing at 400 ticks a lot = ${credits(5n * 400n * cu)} for A's 5)`);

  // B: swept at its expiry; the escrow returns
  const bRow = await waitFor("B to end", async () => {
    const r = sql(`SELECT status, refunded_base::text, lots_placed::text, lots_remaining::text, closed_update_id FROM idx_resting WHERE call_ref = '${bRef}'`)[0];
    return r && r[0] !== "open" ? r : null;
  }, 180_000, 1_000);
  const aliceMid = await cash(alice);
  record("B unfilled: swept at its expiry, escrow returned as venue credit", bRow[0] === "expired" && BigInt(bRow[1]!) === b.escrow && aliceMid === aliceStart - a.escrow, `status ${bRow[0]}, refunded ${credits(BigInt(bRow[1]!))}, alice's cash ${credits(aliceMid)} = start ${credits(aliceStart)} − A ${credits(a.escrow)}, update ${bRow[4]}`);
  const aRow = sql(`SELECT status, lots_placed::text, lots_remaining::text FROM idx_resting WHERE call_ref = '${aRef}'`)[0];
  record("A's row is filled and kept", aRow?.[0] === "filled" && aRow[2] === "0", `status ${aRow?.[0]}, ${aRow?.[1]} placed, ${aRow?.[2]} remaining`);
  const cRow = sql(`SELECT status, refunded_base::text FROM idx_resting WHERE call_ref = '${cRef}'`)[0];
  record("C's row is cancelled and kept", cRow?.[0] === "cancelled" && BigInt(cRow[1]!) === c.escrow, `status ${cRow?.[0]}, refunded ${credits(BigInt(cRow?.[1] ?? "0"))}`);

  // the seat's own reads and inbox
  const mine = await web.call(alice, "GET", `/api/index/wallet/${alice.address}/resting`);
  const mineRows = (mine.json.rows ?? []) as { call_ref: string; status: string; filled_lots: string; remaining_lots: string; refunded_base: string }[];
  const statuses = mineRows.map((r) => `${r.call_ref.slice(0, 8)}=${r.status}${r.status === "expired" ? ` (refunded ${credits(BigInt(r.refunded_base))})` : ""}`).sort();
  record("alice's resting rows over the web (lease-gated)", mine.status === 200 && mineRows.length === 2 && mineRows.some((r) => r.status === "filled") && mineRows.some((r) => r.status === "expired"), statuses.join(", "));
  const inbox = await web.call(alice, "GET", `/api/activity?wallet=${alice.address}&sinceSec=${t.tradingStartSec - 10}`);
  const kinds = ((inbox.json.items ?? []) as { kind: string }[]).map((i) => i.kind);
  record("alice's inbox says her resting call filled", kinds.filter((k) => k === "resting-filled").length === fills.length, `kinds: ${kinds.join(", ") || "none"} (one per fill)`);

  // the Window resolves and A's legs settle
  const settled = await waitFor("A's legs to settle", async () => {
    const r = sql(`SELECT status, result, payout_base::text, closed_update_id FROM idx_legs WHERE owner_party = '${alice.party}' AND market = '${marketId}' AND status <> 'open'`);
    return r.length >= legs.length ? r : null;
  }, 360_000, 2_000);
  const aliceEnd = await cash(alice);
  const payout = settled.reduce((n, r) => n + BigInt(r[2] ?? "0"), 0n);
  record("A settles like any leg", settled.every((r) => r[0] === "settled" || r[0] === "claimed"), `${settled.map((r) => `${r[0]} ${r[1]} payout ${credits(BigInt(r[2]!))} (update ${r[3]})`).join(" · ")}; alice's cash ${credits(aliceMid)} → ${credits(aliceEnd)} (+ ${credits(payout)})`);
  record("no stake was lost or created", aliceEnd === aliceStart - a.escrow + payout, `start ${credits(aliceStart)} − A's escrow ${credits(a.escrow)} + payout ${credits(payout)} = ${credits(aliceStart - a.escrow + payout)} = end ${credits(aliceEnd)}`);

  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} checks passed`);
  return failed.length ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
