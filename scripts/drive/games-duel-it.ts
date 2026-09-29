/**
 * C9b drive: two seats duel on a REAL local stack (sandbox + `drive/ops-local.ts` with the arena desk, the room and the
 * projector), through the same server code the web's `/api/ledger/games/duel/*` routes run, and a season pool pays out.
 *
 *   lease two seats (the web's seat store) → fund → both queue in the room (seed commitments) → paired → seeds revealed
 *   → the deckmaster seals and commits → creator opens (Arena_OpenDuel, pot) → challenger joins (Open_Join, pot)
 *   → the settler reveals: the ledger recomputes sha256 over the preimage (and this script recomputes it too)
 *   → each seat picks every card (firm quote within the cap, accepted with the duel tag, Duel_RecordPick)
 *   → the Windows resolve → the settler scores and finalizes → DuelResult; the pot moved exactly once
 *   → a season pool funded by the venue pays two winners once (ops' route), refuses a second payout, remainder withdrawn
 *
 *   LEDGER_JSON_API_URL=http://localhost:7575 AGARI_PARTIES_FILE=… DATABASE_URL=…/pm_c9b OPS=http://localhost:8777 \
 *   OPS_INTERNAL_SECRET=… ROOM=ws://127.0.0.1:8857 ROOM_TOKEN_SECRET=… pnpm --filter @agari/scripts exec tsx drive/games-duel-it.ts
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { createHmac, randomBytes, randomUUID, webcrypto } from "node:crypto";
import { mintRoomToken, roomSessionClaims, type StakeTierId } from "@agari/core/games";
import { encodeBase58, type Address, type Hash32 } from "@agari/core/types";
import { getDb } from "@agari/db";
import { GAMES_TEMPLATE_IDS, TEMPLATE_IDS } from "@agari/daml";
import { createLedgerClient, noAuth, parseLedgerEnv } from "@agari/ledger";
import { distributeSeasonPrizes, duelDeckHash, keccak256 } from "@agari/markets/games";
import { cmd, decodeVenueCash, pick } from "@agari/markets/ops/canton";
import { decodeDuelMatch, decodeSeasonPool, gcmd } from "@agari/markets/ops/games";
import { createGamesSeat, createOpsClient, createSeatLedger } from "@agari/markets/server";
import { createSeatStore } from "../../web/src/lib/seat-store.server";
import { readPartiesFile } from "../../services/ops/src/runtime/keys";

const OPS = process.env.OPS ?? "http://localhost:8777";
const ROOM = process.env.ROOM ?? "ws://127.0.0.1:8857";
const TIER = (process.env.DUEL_TIER ?? "t1") as StakeTierId;
const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("games-duel-it runs against an unauthenticated local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });
const ops = createOpsClient({ baseUrl: OPS, secret: process.env.OPS_INTERNAL_SECRET! });
const file = readPartiesFile()!;
const venue = file.parties.venue!;
const db = getDb();
if (!db) throw new Error("DATABASE_URL is required: the seats are leased through the web's seat store");
const seatParties = Object.entries(file.users ?? {}).filter(([n]) => n.startsWith("seat-")).map(([, p]) => p);
const store = createSeatStore(db, seatParties);
const ledger = createSeatLedger({ client, venueParty: venue, journal: store.commands });
const games = createGamesSeat({ client, venueParty: venue, journal: store.commands, ledger, ops });

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${typeof detail === "string" ? detail : JSON.stringify(detail, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);

async function newAddress(): Promise<Address> {
  const pair = (await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as webcrypto.CryptoKeyPair;
  return encodeBase58(new Uint8Array(await webcrypto.subtle.exportKey("raw", pair.publicKey))) as Address;
}
async function cashOf(party: string, bucket?: string): Promise<bigint> {
  const r = await client.activeContracts({ parties: [party], templateIds: [TEMPLATE_IDS.VenueCash] });
  return pick(r.contracts, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === party && (!bucket || c.data.bucket === bucket)).reduce((s, c) => s + c.data.amount, 0n);
}

// ---- the room ---------------------------------------------------------------------------------------------------

interface Conn { send: (m: unknown) => void; next: (type: string, timeoutMs: number) => Promise<Record<string, any>>; close: () => void }
function connect(token: string): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(ROOM, ["agari.room.v1", token]);
    const inbox: Record<string, any>[] = [];
    const waiters: { type: string; resolve: (m: Record<string, any>) => void }[] = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as Record<string, any>;
      if (m.type === "error") console.log(`${stamp()} room error: ${m.code} ${m.why ?? ""}`);
      const w = waiters.findIndex((x) => x.type === m.type);
      if (w >= 0) waiters.splice(w, 1)[0]!.resolve(m);
      else inbox.push(m);
    };
    ws.onerror = () => reject(new Error(`room unreachable at ${ROOM}`));
    ws.onopen = () =>
      resolve({
        send: (m) => ws.send(JSON.stringify(m)),
        next: (type, timeoutMs) => {
          const i = inbox.findIndex((m) => m.type === type);
          if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]!);
          return new Promise((res, rej) => {
            const t = setTimeout(() => rej(new Error(`no ${type} within ${timeoutMs} ms`)), timeoutMs);
            waiters.push({ type, resolve: (m) => (clearTimeout(t), res(m)) });
          });
        },
        close: () => ws.close(),
      });
  });
}

// ---- the duel ---------------------------------------------------------------------------------------------------

await store.ready();
const arena = await ops.gameState();
if (!arena.ok || !arena.value.deployed) throw new Error(`no arena on this ledger: ${arena.ok ? "not deployed" : arena.diagnosis.technical}`);
const tier = arena.value.tiers.find((t) => t.tierId === TIER)!;
console.log(`${stamp()} arena ${arena.value.arenaId} policy ${arena.value.policyVersion}; tier ${TIER} pot ${tier.potBase} cap ${tier.perCardCapBase}`);

// The deckmaster deals only 15 m and longer Windows (the reference's rule) with the arena's whole phase budget still
// ahead of them: wait for two such ladders before queueing, so a pairing is not dissolved for want of a deck.
const headroomSec = arena.value.params.joinWindowSec + arena.value.params.revealWindowSec + arena.value.params.pickWindowSec + Number(process.env.GAME_DECK_CREATE_LATENCY_SEC ?? 45) + 20;
for (let i = 0; ; i++) {
  const body = (await (await fetch(`${OPS}/ladders/latest`)).json()) as { ladders: Array<{ state: string; tradingStartSec: number; expirySec: number; up: unknown[]; down: unknown[] }> };
  const now = Date.now() / 1000;
  const dealable = body.ladders.filter((l) => l.state === "quoting" && l.expirySec - l.tradingStartSec !== 300 && l.expirySec - now >= headroomSec && l.up.length > 0 && l.down.length > 0);
  if (dealable.length >= 2) break;
  if (i === 0) console.log(`${stamp()} waiting for two dealable Windows (15 m or longer, ${headroomSec} s of life left)…`);
  if (i > 900) throw new Error("no dealable deck within 30 minutes");
  await sleep(2_000);
}

const players = await Promise.all([0, 1].map(async (i) => {
  const address = await newAddress();
  const lease = await store.lease(address, Date.now(), { startOffset: 0, leaseId: randomUUID() });
  if (lease.kind !== "leased") throw new Error("the seat pool is full");
  const fund = await ops.fundSeat({ party: lease.lease.party, leaseId: lease.lease.leaseId, address });
  // Under load ops can credit the seat after the call's own timeout: the seat's cash is the answer, not the reply.
  let held = 0n;
  for (let t = 0; t < 30 && held === 0n; t++) (held = await cashOf(lease.lease.party)) === 0n && (await sleep(1_000));
  check(`seat ${i + 1} leased and funded`, held > 0n, { party: lease.lease.party.split("::")[0], reply: fund.kind, cash: held });
  return { address, actor: { party: lease.lease.party, leaseId: lease.lease.leaseId } };
}));
const before = await Promise.all(players.map((p) => cashOf(p.actor.party)));

const sign = (payload: string) => createHmac("sha256", process.env.ROOM_TOKEN_SECRET!).update(payload).digest("base64url");
const conns = await Promise.all(players.map((p) => connect(mintRoomToken(roomSessionClaims(p.address, p.address, arena.value.chainId, arena.value.address, Date.now()), sign))));
const seeds = players.map(() => `0x${randomBytes(32).toString("hex")}` as Hash32);
for (const [i, c] of conns.entries()) {
  c.send({ type: "hello", protocolVersion: 1 });
  await c.next("snapshot", 10_000);
  c.send({ type: "queue.join", mode: tier.ranked ? "ranked" : "free", tier: TIER, region: "default", clientSeedCommitment: keccak256(seeds[i]!) });
  await sleep(300);
}
const found = await Promise.all(conns.map((c) => c.next("match.found", 30_000)));
const matchId = found[0]!.room.matchId as Hash32;
check("the matchmaker paired the two seats", found.every((f) => f.room.matchId === matchId), matchId);
conns.forEach((c, i) => c.send({ type: "seed.reveal", matchId, seed: seeds[i] }));
const committed = await conns[0]!.next("deck.committed", 4 * 60_000);
check("the deckmaster sealed a deck and published its commitment", /^0x[0-9a-f]{64}$/.test(committed.commitment.hash), committed.commitment);
const creator = players.find((p) => p.address === found[0]!.players.creator)!;
const challenger = players.find((p) => p !== creator)!;

const write = (p: typeof creator, action: Parameters<typeof games.write>[1], extra: { cardIndex?: number; side?: "up" | "down" } = {}) =>
  games.write(p.actor, action, { commandId: randomUUID(), matchId, ...extra }, p.address);
const opened = await write(creator, "open");
check("the creator opened the duel (Arena_OpenDuel with the pot)", opened.kind === "confirmed", opened);
let joined = await write(challenger, "join");
for (let i = 0; i < 5 && joined.kind !== "confirmed"; i++) (await sleep(1_500), (joined = await write(challenger, "join")));
check("the challenger joined (Open_Join with the pot)", joined.kind === "confirmed", joined);

async function ledgerMatch() {
  const r = await client.activeContracts({ parties: [creator.actor.party], templateIds: [GAMES_TEMPLATE_IDS.DuelMatch] });
  return r.contracts.map((c) => decodeDuelMatch(c.createdEvent.createArgument)).find((m) => m.matchId === matchId) ?? null;
}
let m = await ledgerMatch();
for (let i = 0; i < 60 && m?.status.tag !== "Picking"; i++) (await sleep(1_000), (m = await ledgerMatch()));
check("the settler revealed the deck and the ledger accepted it (Duel_Reveal checks sha256)", m?.status.tag === "Picking", m?.status);
if (m) {
  const recomputed = duelDeckHash({ arenaId: m.arenaId, matchId, policyVersion: m.policyVersion, serverSeed: m.serverSeed!, clientSeeds: m.clientSeeds, cards: m.cards.map((c) => c.marketId) });
  check("the revealed preimage reproduces the committed hash off the ledger too", recomputed === m.deckHash, { deckHash: m.deckHash, cards: m.cards.map((c) => c.marketId) });
  check("the client seeds on the ledger are the two the room revealed", seeds.every((s) => m!.clientSeeds.includes(s)));
  for (const [i, p] of [creator, challenger].entries()) {
    for (let card = 0; card < m.cards.length; card++) {
      const r = await write(p, "pick", { cardIndex: card, side: i === 0 ? "up" : "down" });
      check(`seat ${i === 0 ? "creator" : "challenger"} picked card ${card}`, r.kind === "confirmed", r.kind === "confirmed" ? { cost: r.costBase, quantity: r.quantity } : r);
    }
  }
}

console.log(`${stamp()} waiting for the Windows to resolve and the settler to finalize…`);
let view = await ops.gameMatch(matchId);
for (let i = 0; i < 900 && !(view.ok && view.value.view && ["finalized", "refunded"].includes(view.value.view.match.status)); i++) (await sleep(2_000), (view = await ops.gameMatch(matchId)));
const final = view.ok ? view.value.view : null;
check("the duel was decided on the ledger (DuelResult)", final?.match.status === "finalized", final?.match.status);
const after = await Promise.all(players.map((p) => cashOf(p.actor.party)));
const pots = await Promise.all(players.map((p) => cashOf(p.actor.party, "duel-pot")));
check("the pot moved exactly once: 2 × pot to the winner, or split on a tie", pots[0]! + pots[1]! === 2n * tier.potBase, { pots, pnl: [final?.creatorPnlBase, final?.challengerPnlBase] });
console.log(`${stamp()} cash before ${before.join(" / ")} → after ${after.join(" / ")}`);
conns.forEach((c) => c.close());

// ---- the season pool ------------------------------------------------------------------------------------------------

const seasonId = `drive-${Date.now().toString(36)}`;
const created = await client.submitAndWaitForTransaction({ actAs: [venue], commandId: `drive:season:${seasonId}`, commands: [gcmd.createSeasonPool({ venue, seasonId, endsAtSec: Math.floor(Date.now() / 1000) + 12 })] });
const poolCid = created.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : [])).find((e) => e.templateId.endsWith(":SeasonPool"))!.contractId;
const shard = await client.submitAndWaitForTransaction({ actAs: [venue], commandId: `drive:season-cash:${seasonId}`, commands: [cmd.createShard(venue, 100_000_000n, "season-seed")] });
const shardCid = shard.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : [])).find((e) => e.templateId.endsWith(":VenueCash"))!.contractId;
await client.submitAndWaitForTransaction({ actAs: [venue], commandId: `drive:season-fund:${seasonId}`, commands: [gcmd.fundSeason(poolCid, [shardCid])] });
await sleep(14_000);
const input = { secretKey: new Uint8Array(0), rpcUrl: OPS, rpcSubscriptionsUrl: "", seasonId, winners: [creator.address, challenger.address], amountsBase: [60_000_000n, 30_000_000n], opsSecret: process.env.OPS_INTERNAL_SECRET! };
const paid = await distributeSeasonPrizes(input).then((id) => ({ ok: true, id }), (e: unknown) => ({ ok: false, id: String(e) }));
check("the season pool paid its two winners once (Season_Distribute via ops)", paid.ok, paid.id);
const again = await distributeSeasonPrizes(input).then(() => "paid twice", (e: unknown) => String(e));
check("a second payout is refused", again !== "paid twice", again);
check("each winner was credited to their seat", (await cashOf(creator.actor.party, `season:${seasonId}`)) === 60_000_000n && (await cashOf(challenger.actor.party, `season:${seasonId}`)) === 30_000_000n);
const pools = await client.activeContracts({ parties: [venue], templateIds: [GAMES_TEMPLATE_IDS.SeasonPool] });
const pool = pools.contracts.map((c) => ({ cid: c.createdEvent.contractId, data: decodeSeasonPool(c.createdEvent.createArgument) })).find((p) => p.data.seasonId === seasonId)!;
check("the pool shows it distributed, holding the remainder", pool.data.distributed && pool.data.amount === 10_000_000n, pool.data);
const withdrawn = await client.submitAndWaitForTransaction({ actAs: [venue], commandId: `drive:season-withdraw:${seasonId}`, commands: [gcmd.withdrawSeasonRemainder(pool.cid)] });
check("the venue withdrew the remainder and the pool closed", withdrawn.transaction.events.some((e) => "CreatedEvent" in e && e.CreatedEvent.templateId.endsWith(":VenueCash")));

for (const p of players) await store.release(p.actor.leaseId, Date.now(), "drive done");
console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}  match ${matchId}`);
process.exit(failures === 0 ? 0 : 1);
