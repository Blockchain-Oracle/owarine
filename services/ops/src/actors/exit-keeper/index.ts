/**
 * The exit keeper (R2, revamp step 4): the venue's side of the seats' resting exits (abu-pm-seat `RestingExit`) and of
 * credit transfers between seats. Once a second it reads every exit the venue observes and, per exit (`rule.ts`):
 *
 *   trail    follows the live spot in memory and moves the ledger's level in steps   RestExit_Ratchet   exitratchet:<cid>:<level>
 *   fill     a stop crossed or a take-profit reached: sells the seat's legs at the
 *            venue's own bid, never below the exit's floor, from one pool shard     RestExit_Fill      exitfill:<cid>
 *   sweep    past `expiresAt` it expires; a Window that locked or a seat that holds
 *            nothing on that side any more, it withdraws naming why                 RestExit_Expire / _Withdraw   exitsweep:<cid>
 *
 * and serves `POST /internal/exits/close`: the seat's Close tap on a position whose exit is armed is one venue command
 * (`RestExit_Fill` at the bid, never below what the seat confirmed), not a quote and an accept.
 *
 * On start it also makes sure the venue's `TransferDesk` exists (created once, venue-only): the web discloses it to a
 * sending seat, whose own `TransferDesk_Offer` moves its own credits into an offer. The keeper never touches an offer.
 *
 * The ledger bounds every fill's price and size; the trigger's timing is the venue's word against the live spot, which
 * is why the level itself is on the ledger and only moves in the seat's favour. A fill whose exit or legs went away
 * first (the seat cancelled, closed by hand, or another pass got it) is done, not a failure.
 */
import { SEAT_TEMPLATE_IDS, TEMPLATE_IDS } from "@owarine/daml";
import { LedgerError } from "@owarine/ledger";
import { parseLaneKey, spotSymbolOf, TICKERS, type TickerSymbol } from "@owarine/core/market";
import {
  bidLevels, cmd, createdOf, decodeLeg, decodeRestingExit, exitFillCommandId, exitRatchetCommandId, exitSweepCommandId, failureText, isInactive, isIndefinite,
  pick, readActive, refusalId, submit, transferDeskCommandId, type Active, type RestingExitC, type RoleSession,
} from "@owarine/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import type { SpotFeed } from "../../prices/spot";
import type { LadderBoard, LadderEntry } from "../market-maker/seat/ladder-board";
import { consume, type ShardPool } from "../quote-issuer";
import { PoolBusyError } from "../quote-issuer/pool";
import { submitWithShards } from "../quote-issuer/pooled-submit";
import { emitVenueEvent } from "../venue/events";
import type { VenueContext } from "../venue/context";
import { decideExit, effectiveStop, impliedPeak, nextPeak, shouldRatchet, type ExitDecision, type TrailMemory } from "./rule";

/** One fill sells at most this many legs (largest first); a seat with more keeps the rest, and the exit rests for them. */
export const MAX_FILL_LEGS = 8;
const EXITS_PER_PASS = 40;
/** The ledger's trail level moves at most this often per exit; the keeper triggers on its own level in between. */
const RATCHET_GAP_MS = 10_000;
const SPOT_MAX_AGE_SEC = 15;

type Log = (why: string) => void;

export interface ExitKeeperHandle {
  /** `POST /internal/exits/close`. */
  handleClose: (body: unknown) => Promise<{ status: number; body: unknown }>;
  stop: () => void;
}

const isTicker = (s: string): s is TickerSymbol => s in TICKERS;

/** The spot a Window's trail is judged on: the pricer's own choice (a token lane's xStock, else its ticker). */
export function spotSymbolFor(entry: Pick<LadderEntry, "seriesKey" | "symbol">): string | null {
  const lane = parseLaneKey(entry.seriesKey);
  if (lane) return spotSymbolOf(lane.symbol, lane.basis);
  return isTicker(entry.symbol) ? entry.symbol : null;
}

const sideOf = (x: RestingExitC): "up" | "down" => (x.outcome === "SideUp" ? "up" : "down");
const memoryKey = (x: RestingExitC) => `${x.owner}|${x.exitRef}`;

const counters = { filled: 0, partial: 0, ratcheted: 0, expired: 0, withdrawn: 0, held: 0, alreadyEnded: 0, failed: 0, closes: 0 };

export async function startExitKeeper(input: {
  venue: VenueContext;
  board: LadderBoard;
  pool: ShardPool | null;
  spot: SpotFeed | null;
  log: Log;
  env?: NodeJS.ProcessEnv;
}): Promise<ExitKeeperHandle | null> {
  const session = input.venue.session("venue");
  if (!session) {
    input.log("VENUE_PARTY and the parties file are missing: no exits are kept");
    return null;
  }
  const pool = input.pool;
  // Before the R2 DAR is on the participant the package is unknown: the keeper idles and makes the desk once it is.
  let deskReady = false;
  const ensureDesk = async () => {
    if (deskReady) return;
    deskReady = (await ensureTransferDesk(session, input.log)) !== null;
  };
  await ensureDesk().catch((error: unknown) => input.log(`transfer desk: ${seatPkgMissing(error) ? "abu-pm-seat is not on the participant yet (R2)" : failureText(error)}; sending credits waits for it`));
  if (!pool) {
    input.log("no shard pool (the issuer is off): exits rest but nothing fills them");
  }
  const memory = new Map<string, TrailMemory>();
  const inFlight = new Set<string>();

  const spotOf = (entry: LadderEntry): bigint | null => {
    const sym = spotSymbolFor(entry);
    return sym ? (input.spot?.latest(sym as TickerSymbol, SPOT_MAX_AGE_SEC)?.priceE8 ?? null) : null;
  };

  /** The seat's sellable legs for an exit, largest first (private calls are never sold through an exit). */
  const legsFor = async (x: RestingExitC) => {
    const acs = await readActive(session, [TEMPLATE_IDS.Leg]);
    return pick(acs, TEMPLATE_IDS.Leg, decodeLeg)
      .filter((l) => l.data.owner === x.owner && l.data.venue === session.party && l.data.termsCid === x.termsCid && l.data.outcome === x.outcome && l.data.beneficiaryRef !== "private")
      .sort((a, b) => (a.data.lots === b.data.lots ? a.cid.localeCompare(b.cid) : a.data.lots > b.data.lots ? -1 : 1));
  };

  const sweep = async (e: Active<RestingExitC>, how: "expire" | "withdraw", reason: string): Promise<string | null> => {
    try {
      const out = await submit(session, { commandId: exitSweepCommandId(e.cid), commands: [how === "expire" ? cmd.expireExit(e.cid) : cmd.withdrawExit(e.cid, reason)] });
      if (out.kind === "dry") return out.note;
      if (how === "expire") counters.expired++;
      else counters.withdrawn++;
      memory.delete(memoryKey(e.data));
      return `exit ${e.data.exitRef} of ${e.data.owner.split("::")[0]} ${how === "expire" ? "expired" : `withdrawn: ${reason}`}`;
    } catch (error) {
      if (isInactive(error)) {
        counters.alreadyEnded++;
        return null;
      }
      counters.failed++;
      return `sweep ${e.cid.slice(0, 12)}… failed: ${failureText(error)}`;
    }
  };

  /** Fill one exit per its decision, against the seat's legs as the ledger has them now. */
  type FillAnswer = { kind: "filled"; lots: bigint; priceTicks: number; proceedsBase: bigint; updateId: string } | { kind: "not-filled"; why: string; decision?: ExitDecision };
  const fill = async (e: Active<RestingExitC>, entry: LadderEntry, decide: (held: bigint) => ExitDecision): Promise<FillAnswer> => {
    if (!pool) return { kind: "not-filled", why: "no shard pool" };
    if (inFlight.has(e.cid)) return { kind: "not-filled", why: "a fill of this exit is in flight" };
    inFlight.add(e.cid);
    try {
      const legs = await legsFor(e.data);
      if (legs.length === 0) return { kind: "not-filled", why: "nothing held" };
      const sellable = legs.slice(0, MAX_FILL_LEGS);
      const held = sellable.reduce((s, l) => s + l.data.lots, 0n);
      const d = decide(held);
      if (d.kind !== "fill") return { kind: "not-filled", why: d.why, decision: d };
      // Only the legs the fill reaches: largest first, the last one split by the ledger.
      const used: string[] = [];
      let covered = 0n;
      for (const l of sellable) {
        if (covered >= d.lots) break;
        used.push(l.cid);
        covered += l.data.lots;
      }
      let lease;
      try {
        lease = await pool.lease(d.proceedsBase, `exit ${entry.damlMarketId}`);
      } catch (error) {
        if (error instanceof PoolBusyError) return { kind: "not-filled", why: "every venue shard is in use: the fill waits for the next pass" };
        throw error;
      }
      const out = await submitWithShards(pool, session, [lease], {
        commandId: exitFillCommandId(e.cid),
        commands: [cmd.fillExit(e.cid, { shardCid: lease.cid, legCids: used, fillLots: d.lots, priceTicks: d.priceTicks })],
      });
      if (out.kind === "dry") return { kind: "not-filled", why: `DRY RUN: ${out.note}` };
      // The buy-back takes depth from the opposite ladder, as an exit quote does.
      consume(entry, sideOf(e.data) === "up" ? "down" : "up", d.lots);
      if (d.lots < e.data.lots) counters.partial++;
      else counters.filled++;
      if (d.lots >= e.data.lots) memory.delete(memoryKey(e.data));
      emitVenueEvent({ kind: "exit-filled", marketId: entry.damlMarketId, exitCid: e.cid, side: sideOf(e.data), lots: d.lots.toString(), priceTicks: d.priceTicks, trigger: d.trigger, atMs: Date.now() });
      input.log(`exit ${d.trigger} ${entry.damlMarketId} sold ${sideOf(e.data)} ${d.lots} of ${e.data.lots} lots @ ${d.priceTicks} for ${e.data.owner.split("::")[0]}`);
      return { kind: "filled", lots: d.lots, priceTicks: d.priceTicks, proceedsBase: d.proceedsBase, updateId: out.transaction.updateId };
    } catch (error) {
      if (isInactive(error)) {
        counters.alreadyEnded++;
        return { kind: "not-filled", why: "the exit or its legs ended first" };
      }
      if (isIndefinite(error)) return { kind: "not-filled", why: `fill ${e.cid.slice(0, 12)}… did not answer in time; its shard is held until the outcome is known` };
      counters.failed++;
      return { kind: "not-filled", why: `fill refused: ${refusalId(error) ?? failureText(error)}` };
    } finally {
      inFlight.delete(e.cid);
    }
  };

  const readExits = async () =>
    pick(await readActive(session, [SEAT_TEMPLATE_IDS.RestingExit]), SEAT_TEMPLATE_IDS.RestingExit, decodeRestingExit).filter((x) => x.data.venue === session.party);

  const pass = async (): Promise<PassResult> => {
    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    let exits: Active<RestingExitC>[];
    try {
      await ensureDesk();
      exits = await readExits();
    } catch (error) {
      if (seatPkgMissing(error)) return { why: "abu-pm-seat is not on the participant yet (R2): no exits to keep", nextDelayMs: 60_000 };
      throw error;
    }
    const live = new Set(exits.map((x) => memoryKey(x.data)));
    for (const k of memory.keys()) if (!live.has(k)) memory.delete(k);
    const notes: string[] = [];
    let armed = 0;
    for (const e of exits.slice(0, EXITS_PER_PASS)) {
      const x = e.data;
      if (nowSec >= x.expiresAtSec) {
        const n = await sweep(e, "expire", "");
        if (n) notes.push(n);
        continue;
      }
      const entry = input.board.get({ termsCid: x.termsCid });
      if (!entry) continue;
      if (nowSec >= entry.lockAtSec || entry.state !== "quoting") {
        const n = await sweep(e, "withdraw", "the Window stopped trading");
        if (n) notes.push(n);
        continue;
      }
      armed++;
      const spotE8 = x.stop ? spotOf(entry) : null;
      // The trail: the best spot since arming, seeded after a restart from what the ledger's level implies.
      const key = memoryKey(x);
      let mem = memory.get(key);
      if (x.stop?.trailBps != null) {
        const seed = impliedPeak(x.outcome, x.stop.stopE8, x.stop.trailBps);
        mem ??= { peakE8: seed, lastRatchetMs: 0 };
        if (spotE8 !== null) mem.peakE8 = nextPeak(x.outcome, nextPeak(x.outcome, mem.peakE8, seed), spotE8);
        memory.set(key, mem);
      }
      const level = effectiveStop(x, mem?.peakE8 ?? null);
      const bids = bidLevels(entry, sideOf(x));
      const decide = (held: bigint) => decideExit({ exit: x, held, spotE8, stopE8: level, bids });
      // Judge on what the exit names first; read the seat's legs only when it would fill.
      if (decide(x.lots).kind === "fill") {
        const r = await fill(e, entry, decide);
        if (r.kind === "filled") continue;
        if (r.why === "nothing held") {
          const n = await sweep(e, "withdraw", "the seat holds nothing on this side");
          if (n) notes.push(n);
          continue;
        }
        if (r.decision?.kind === "hold") counters.held++;
        notes.push(`exit ${x.exitRef} ${entry.damlMarketId}: ${r.why}`);
        continue;
      }
      if (mem && level !== null && shouldRatchet(x, level, nowMs, mem.lastRatchetMs, RATCHET_GAP_MS)) {
        try {
          const out = await submit(session, { commandId: exitRatchetCommandId(e.cid, level), commands: [cmd.ratchetExit(e.cid, level)] });
          if (out.kind === "done") {
            mem.lastRatchetMs = nowMs;
            counters.ratcheted++;
          }
        } catch (error) {
          if (isInactive(error)) counters.alreadyEnded++;
          else notes.push(`ratchet ${x.exitRef} failed: ${refusalId(error) ?? failureText(error)}`);
        }
      }
    }
    for (const n of notes) input.log(n);
    return {
      why: `${exits.length} exits (${armed} armed on a trading Window); filled ${counters.filled}, partly ${counters.partial}, ratcheted ${counters.ratcheted}, expired ${counters.expired}, withdrawn ${counters.withdrawn}, held at the floor ${counters.held}, closes ${counters.closes}, already ended ${counters.alreadyEnded}, failed ${counters.failed}${session.dryRun ? " · DRY RUN" : ""}`,
      detail: { ...counters, exits: exits.length, armed },
    };
  };

  const handleClose = async (body: unknown): Promise<{ status: number; body: unknown }> => {
    const req = parseCloseRequest(body);
    if (typeof req === "string") return { status: 400, body: { error: req } };
    const exits = await readExits();
    const e = exits.find((x) => x.cid === req.exitCid && x.data.owner === req.party);
    if (!e) return { status: 200, body: { kind: "gone", why: "no armed exit with that id for this seat" } };
    const entry = input.board.get({ termsCid: e.data.termsCid });
    if (!entry || entry.state !== "quoting" || Math.floor(Date.now() / 1000) > entry.quotingUntilSec) return { status: 200, body: { kind: "refused", why: "this Window has locked; it pays at settlement" } };
    const bids = bidLevels(entry, sideOf(e.data));
    const r = await fill(e, entry, (held) => decideExit({ exit: e.data, held, spotE8: null, stopE8: null, bids, close: { minProceedsBase: req.minProceedsBase } }));
    if (r.kind === "filled") {
      counters.closes++;
      return { status: 200, body: { kind: "closed", lots: r.lots.toString(), priceTicks: r.priceTicks, proceedsBase: r.proceedsBase.toString(), updateId: r.updateId } };
    }
    return { status: 200, body: { kind: r.decision?.kind === "hold" ? "requote" : "refused", why: r.why } };
  };

  input.log(`exit keeper as ${session.party.split("::")[0]}: trails, stops and take-profits fill at the venue's bid, never below an exit's floor`);
  const actor = runActor({ name: "exit-keeper", log: input.log, dryRun: session.dryRun, everyMs: 1_000, pass });
  return { handleClose, stop: actor.stop };
}

const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;
const CID = /^[0-9a-f]{40,400}$/;
const UINT = /^\d{1,19}$/;

export interface CloseRequest {
  party: string;
  exitCid: string;
  minProceedsBase: bigint;
}

/** `{ party, exitCid, minProceedsBase }` (bigint as a decimal string). */
export function parseCloseRequest(body: unknown): CloseRequest | string {
  if (typeof body !== "object" || body === null) return "body must be an object";
  const b = body as Record<string, unknown>;
  if (typeof b.party !== "string" || !PARTY_ID.test(b.party)) return "party must be a party id";
  if (typeof b.exitCid !== "string" || !CID.test(b.exitCid)) return "exitCid must be a contract id";
  if (typeof b.minProceedsBase !== "string" || !UINT.test(b.minProceedsBase)) return "minProceedsBase must be a decimal integer string";
  return { party: b.party, exitCid: b.exitCid, minProceedsBase: BigInt(b.minProceedsBase) };
}

const NOT_DEPLOYED = new Set(["PACKAGE_NAMES_NOT_FOUND", "PACKAGE_NOT_FOUND", "TEMPLATES_OR_INTERFACES_NOT_FOUND", "NO_TEMPLATES_OR_INTERFACES_FOR_PACKAGE_NAME"]);
/** Whether the participant does not know abu-pm-seat (R2 not uploaded yet). */
export const seatPkgMissing = (error: unknown): boolean =>
  error instanceof LedgerError && ((error.code !== undefined && NOT_DEPLOYED.has(error.code)) || (/abu-pm-seat/.test(error.message) && /not found|unknown/i.test(error.message)));

/** The venue's `TransferDesk`, made once when it has none (a venue-only contract that carries no money). */
export async function ensureTransferDesk(session: RoleSession, log: Log): Promise<string | null> {
  const [first] = pick(await readActive(session, [SEAT_TEMPLATE_IDS.TransferDesk]), SEAT_TEMPLATE_IDS.TransferDesk, (v) => v);
  if (first) return first.cid;
  const out = await submit(session, { commandId: transferDeskCommandId(session.party), commands: [cmd.createTransferDesk(session.party)] });
  if (out.kind === "dry") {
    log("DRY RUN: the venue has no TransferDesk and would create one");
    return null;
  }
  const created = createdOf(out.created, SEAT_TEMPLATE_IDS.TransferDesk)[0];
  log("created the venue's TransferDesk");
  return created?.contractId ?? null;
}
