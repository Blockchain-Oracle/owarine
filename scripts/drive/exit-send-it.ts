/**
 * R2 integration (revamp step 4): the seat's resting exit and credit transfers end to end on a LOCAL stack (sandbox with
 * abu-pm-seat 0.1.0, the real ops with its exit keeper, the web app). Two seats lease through `/api/seat`, and on a
 * trading BTC Window the drive:
 *
 *   stop      alice buys UP and arms a stop above the spot: the keeper sees it crossed and sells at its bid (no seat
 *             command after the arm); her legs and the exit are gone and the sale cash is hers
 *   trail     alice buys UP and arms a 20 % trail from the lowest level: the keeper ratchets the ledger's level up to the
 *             live spot less 20 % (a new exit contract, same ref), and nothing fills
 *   close     she closes through that armed exit: ONE venue command (`RestExit_Fill`) sells it at the bid
 *   take      alice buys UP and arms a 1-tick take-profit: filled at once; and a 999-tick one is disarmed by the seat
 *   privacy   bob's exits read shows none of alice's; bob cannot close alice's exit
 *   send      alice sends bob credits: accepted (bob's cash rises by exactly that), rejected (back to alice), withdrawn;
 *             bob cannot withdraw alice's offer; credits are conserved across the two seats
 *
 * Every row prints the ledger's update id where there is one. Exits 0 only when every check passes.
 *
 *   set -a; . r2.env; set +a; pnpm --filter @owarine/scripts exec tsx drive/exit-send-it.ts [--web http://localhost:3137] [--lane BTC-2m]
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { SEAT_TEMPLATE_IDS, TEMPLATE_IDS } from "@owarine/daml";
import { ledgerClientFromEnv, parseLedgerEnv } from "@owarine/ledger";
import { parseMarketsEnv } from "@owarine/markets";
import { decodeLeg, decodeRestingExit, decodeTerms, decodeVenueCash, pick, readActive, type RoleSession } from "@owarine/markets/ops/canton";
import { appMarketId } from "@owarine/markets/server";
import { newSeat, webClient, type Seat } from "./first-call/seat";
import { waitFor } from "./first-call/ledger";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const WEB = arg("--web", "http://localhost:3137").replace(/\/+$/, "");
const LANES = arg("--lane", "BTC-2m,BTC-2m_1").split(",");
const nowSec = () => Math.floor(Date.now() / 1000);
const credits = (base: bigint) => (Number(base) / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
const short = (s: string) => `${s.slice(0, 12)}…`;

const rows: Array<{ check: string; ok: boolean; detail: string }> = [];
function record(check: string, ok: boolean, detail: string): boolean {
  rows.push({ check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${check} | ${detail}`);
  return ok;
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
  const cash = async (s: Seat) =>
    (await readActive({ ...venue, party: s.party! }, [TEMPLATE_IDS.VenueCash])).map((c) => decodeVenueCash(c.createdEvent.createArgument)).filter((c) => c.owner === s.party && c.bucket !== "private").reduce((n, c) => n + c.amount, 0n);
  await waitFor("alice's demo credits", async () => ((await cash(alice)) > 0n ? true : null), 120_000);
  await waitFor("bob's demo credits", async () => ((await cash(bob)) > 0n ? true : null), 120_000);
  record("seats funded", true, `alice ${credits(await cash(alice))}, bob ${credits(await cash(bob))} credits`);

  const legsOf = async (s: Seat, termsCid: string) =>
    pick(await readActive(venue, [TEMPLATE_IDS.Leg]), TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.owner === s.party && l.data.termsCid === termsCid);
  const exitsOf = async (s: Seat) => pick(await readActive(venue, [SEAT_TEMPLATE_IDS.RestingExit]), SEAT_TEMPLATE_IDS.RestingExit, decodeRestingExit).filter((x) => x.data.owner === s.party);

  /** A trading Window with 60+ s of quoting left, then a firm UP buy at `stakeBase`. */
  async function buyUp(s: Seat, stakeBase: bigint) {
    return waitFor(
      "a trading Window that quotes UP",
      async () => {
        const terms = pick(await readActive(venue, [TEMPLATE_IDS.MarketTerms]), TEMPLATE_IDS.MarketTerms, decodeTerms)
          .filter((t) => LANES.includes(t.data.seriesKey) && t.data.tradingStartSec + 15 <= nowSec() && t.data.lockAtSec - nowSec() >= 60)
          .sort((a, b) => b.data.lockAtSec - a.data.lockAtSec);
        for (const t of terms) {
          const marketId = appMarketId(t.data.marketId);
          const q = await web.call(s, "POST", "/api/ledger/quotes", { marketId, side: "up", stakeBase, displayedMaxCostBase: stakeBase * 2n });
          if (q.json.kind !== "quote") continue;
          const acc = await web.call(s, "POST", `/api/ledger/quotes/${q.json.quoteCid}/accept`, { commandId: randomUUID() });
          if (acc.json.kind === "confirmed") return { t, marketId, update: String(acc.json.updateId), cost: BigInt(acc.json.booked.costBase) };
        }
        return null;
      },
      240_000,
      3_000,
    );
  }
  const arm = (s: Seat, body: Record<string, unknown>) => web.call(s, "POST", "/api/ledger/exits", { commandId: randomUUID(), ...body });

  // ---- stop: armed above the spot, the venue sells at its bid with no further seat command --------------------------
  const b1 = await buyUp(alice, 2_000_000n);
  record("alice buys UP", true, `${b1.t.data.marketId}, cost ${credits(b1.cost)}, update ${b1.update}`);
  const pkg0 = await web.call(alice, "GET", "/api/ledger/exits");
  record("the seat package is on the participant", pkg0.json.deployed === true && Array.isArray(pkg0.json.exits) && pkg0.json.exits.length === 0, `deployed ${pkg0.json.deployed}, ${pkg0.json.exits?.length} exits`);
  const cashBeforeStop = await cash(alice);
  const a1 = await arm(alice, { marketId: b1.marketId, side: "up", floorTicks: 1, stop: { stopE8: "100000000000000", trailBps: null } });
  record("alice arms a stop above the spot (one create, signed by her alone)", a1.json.kind === "confirmed", a1.json.kind === "confirmed" ? `exit ${a1.json.exit.exitRef} over ${a1.json.exit.lots} lots, update ${a1.json.updateId}` : JSON.stringify(a1.json).slice(0, 300));
  const stopFilled = await waitFor("the stop's fill", async () => ((await exitsOf(alice)).length === 0 && (await legsOf(alice, b1.t.cid)).length === 0 ? true : null), 60_000, 1_000).catch(() => false);
  const proceeds1 = (await cash(alice)) - cashBeforeStop;
  record("the venue sells the stop at its bid: exit and legs gone, sale cash hers", stopFilled === true && proceeds1 > 0n, `alice +${credits(proceeds1)} credits (cost ${credits(b1.cost)})`);

  // ---- trail: the keeper moves the ledger's level, then Close through the exit is one venue command -------------------
  const b2 = await buyUp(alice, 2_000_000n);
  record("alice buys UP again", true, `${b2.t.data.marketId}, update ${b2.update}`);
  const a2 = await arm(alice, { marketId: b2.marketId, side: "up", floorTicks: 1, stop: { stopE8: "1", trailBps: 2000 } });
  record("alice arms a 20 % trail from the lowest level (10⁻⁸)", a2.json.kind === "confirmed", a2.json.kind === "confirmed" ? `exit ${a2.json.exit.exitRef}, update ${a2.json.updateId}` : JSON.stringify(a2.json).slice(0, 300));
  const ratcheted = await waitFor("the keeper's ratchet", async () => {
    const x = (await exitsOf(alice))[0];
    return x && x.data.stop && x.data.stop.stopE8 > 1n ? x : null;
  }, 60_000, 1_000).catch(() => null);
  record("the venue ratchets the trail on the ledger (same ref, level in her favour only)", ratcheted !== null && ratcheted.data.exitRef === a2.json.exit?.exitRef, ratcheted ? `level 10⁻⁸ → $${(Number(ratcheted.data.stop!.stopE8) / 1e8).toFixed(6)} (spot less 20 %), exit ${short(ratcheted.cid)}` : "no ratchet within 60 s");

  // privacy: bob sees none of it, and cannot close it
  const bobPkg = await web.call(bob, "GET", "/api/ledger/exits");
  record("bob's exits read shows none of alice's", bobPkg.status === 200 && bobPkg.json.exits.length === 0, `${bobPkg.json.exits?.length} exits as bob`);
  const live = (await exitsOf(alice))[0];
  if (live) {
    const bobClose = await web.call(bob, "POST", `/api/ledger/exits/${live.cid}/close`, { minProceedsBase: "0" });
    record("bob cannot close alice's exit", bobClose.json.kind === "gone", `bob's close → ${bobClose.json.kind}`);
    const before = await cash(alice);
    const started = Date.now();
    const close = await web.call(alice, "POST", `/api/ledger/exits/${live.cid}/close`, { minProceedsBase: "1" });
    const ms = Date.now() - started;
    const gone = (await legsOf(alice, b2.t.cid)).length === 0 && (await exitsOf(alice)).length === 0;
    const got = (await cash(alice)) - before;
    record("Close through the armed exit: one venue command at the bid", close.json.kind === "closed" && gone && got === BigInt(close.json.proceedsBase ?? -1), close.json.kind === "closed" ? `sold ${close.json.lots} lots @ ${close.json.priceTicks} for ${credits(got)} in ${ms} ms, update ${close.json.updateId}` : JSON.stringify(close.json).slice(0, 300));
  } else record("Close through the armed exit: one venue command at the bid", false, "no armed exit to close");

  // ---- take-profit: one that fills at once, one the seat disarms -------------------------------------------------------
  const b3 = await buyUp(alice, 2_000_000n);
  const tpHigh = await arm(alice, { marketId: b3.marketId, side: "up", floorTicks: 1, takeProfitTicks: 999 });
  record("a 999-tick take-profit rests", tpHigh.json.kind === "confirmed", tpHigh.json.kind === "confirmed" ? `exit ${tpHigh.json.exit.exitRef}, update ${tpHigh.json.updateId}` : JSON.stringify(tpHigh.json).slice(0, 300));
  await new Promise((r) => setTimeout(r, 3_000));
  const stillThere = (await exitsOf(alice)).length === 1 && (await legsOf(alice, b3.t.cid)).length > 0;
  record("…and does not fill below its price", stillThere, stillThere ? "exit and legs still there after 3 s" : "it filled or vanished");
  const disarm = await web.call(alice, "POST", "/api/ledger/exits/cancel", { commandId: randomUUID(), marketId: b3.marketId, side: "up" });
  record("the seat disarms it alone", disarm.json.kind === "confirmed" && (await exitsOf(alice)).length === 0, `cancelled ${disarm.json.cancelled}, update ${disarm.json.updateId}`);
  const before3 = await cash(alice);
  const tpLow = await arm(alice, { marketId: b3.marketId, side: "up", floorTicks: 1, takeProfitTicks: 1 });
  const tpFilled = await waitFor("the take-profit's fill", async () => ((await exitsOf(alice)).length === 0 && (await legsOf(alice, b3.t.cid)).length === 0 ? true : null), 60_000, 1_000).catch(() => false);
  record("a 1-tick take-profit fills at the venue's bid", tpLow.json.kind === "confirmed" && tpFilled === true, `alice +${credits((await cash(alice)) - before3)} credits`);

  // ---- send ------------------------------------------------------------------------------------------------------------
  const a0 = await cash(alice);
  const bb0 = await cash(bob);
  const send = (amount: bigint, memo: string) => web.call(alice, "POST", "/api/ledger/transfers", { commandId: randomUUID(), to: bob.party, amount, memo });
  const s1 = await send(1_000_000n, "r2 drive");
  record("alice sends bob 1 credit", s1.json.kind === "confirmed" && (await cash(alice)) === a0 - 1_000_000n, s1.json.kind === "confirmed" ? `offer ${short(s1.json.transfer.cid)}, update ${s1.json.updateId}` : JSON.stringify(s1.json).slice(0, 300));
  const bobIn = await web.call(bob, "GET", "/api/ledger/transfers");
  const incoming = (bobIn.json.transfers ?? []).find((t: { direction: string; memo: string }) => t.direction === "in" && t.memo === "r2 drive");
  record("bob sees it incoming with its memo", Boolean(incoming), `${bobIn.json.transfers?.length} open transfer(s) as bob`);
  const acc = incoming ? await web.call(bob, "POST", `/api/ledger/transfers/${incoming.cid}`, { commandId: randomUUID(), choice: "accept" }) : { json: {} as Record<string, any> };
  record("bob accepts: his cash rises by exactly 1", acc.json.kind === "confirmed" && (await cash(bob)) === bb0 + 1_000_000n, `credited ${credits(BigInt(acc.json.creditedBase ?? 0))}, update ${acc.json.updateId}`);

  const s2 = await send(500_000n, "reject me");
  const off2 = (await web.call(bob, "GET", "/api/ledger/transfers")).json.transfers?.find((t: { memo: string }) => t.memo === "reject me");
  const rej = off2 ? await web.call(bob, "POST", `/api/ledger/transfers/${off2.cid}`, { commandId: randomUUID(), choice: "reject" }) : { json: {} as Record<string, any> };
  record("bob rejects: it goes back to alice", s2.json.kind === "confirmed" && rej.json.kind === "confirmed" && (await cash(alice)) === a0 - 1_000_000n, `update ${rej.json.updateId}`);

  const s3 = await send(250_000n, "withdraw me");
  const bobWithdraw = await web.call(bob, "POST", `/api/ledger/transfers/${s3.json.transfer?.cid}`, { commandId: randomUUID(), choice: "withdraw" });
  record("bob cannot withdraw alice's offer", bobWithdraw.json.kind === "refused", `bob's withdraw → ${bobWithdraw.json.kind}`);
  const wd = await web.call(alice, "POST", `/api/ledger/transfers/${s3.json.transfer?.cid}`, { commandId: randomUUID(), choice: "withdraw" });
  record("alice withdraws hers", wd.json.kind === "confirmed" && (await cash(alice)) === a0 - 1_000_000n, `update ${wd.json.updateId}`);
  const self = await web.call(alice, "POST", "/api/ledger/transfers", { commandId: randomUUID(), to: alice.party, amount: 1n, memo: "" });
  record("a seat cannot send to itself", self.json.kind === "refused", `→ ${self.json.kind}`);
  record("credits are conserved across the two seats", (await cash(alice)) + (await cash(bob)) === a0 + bb0, `alice ${credits(await cash(alice))} + bob ${credits(await cash(bob))} = ${credits(a0 + bb0)}`);

  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} checks passed`);
  return failed.length === 0 ? 0 : 1;
}

main().then((code) => process.exit(code), (error: unknown) => {
  console.error(error);
  process.exit(1);
});
