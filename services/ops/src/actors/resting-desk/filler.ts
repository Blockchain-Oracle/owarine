/**
 * The resting desk's pass (C7c, K-235): what the venue does with the calls it holds, once a second.
 *
 *   fill      a call whose Window is trading and whose price reaches the venue's ladder on its side is filled at exactly its
 *             own price, for the depth the ladder has there (`rule.ts`): `Rest_Fill` from one pool shard, the same pair a
 *             quote's accept makes. A partial fill leaves the rest resting; the next pass looks again.
 *   expire    a call past its `expiresAt` is swept: `Rest_Expire` returns the escrow of the lots still resting to its owner
 *   offers    an offer nobody placed, past its window, is archived (`RestOffer_Expire`); it held nothing
 *
 * A call the owner cancelled, or another pass filled, is gone by the time a command names it: that is done, not a failure.
 * Command ids are stable per action (`restfill:<call>:<lots>`, `restexp:<call>`), so a retry after a crash lands once.
 */
import { TEMPLATE_IDS } from "@agari/daml";
import {
  cmd, decodeRestingCall, decodeRestingOffer, failureText, isIndefinite, isInactive, pick, readActive, refusalId, restExpireCommandId, restFillCommandId, restOfferExpireCommandId, submit,
  type Active, type RestingCallC, type RoleSession,
} from "@agari/markets/ops/canton";
import type { PassResult } from "../../runtime/actor";
import { consume, leaseFrom, submitWithShards, type ShardPool } from "../quote-issuer";
import { PoolBusyError } from "../quote-issuer/pool";
import type { LadderBoard } from "../market-maker/seat/ladder-board";
import type { MakerVault } from "../maker-vault/vault";
import { emitVenueEvent } from "../venue/events";
import { callExpired, fillableLots, offerLapsed } from "./rule";

const SWEEPS_PER_PASS = 20;
const FILLS_PER_PASS = 8;

export interface FillerDeps {
  venue: RoleSession;
  board: LadderBoard;
  pool: ShardPool;
  maker: MakerVault | null;
  /** The most lots one fill may take. */
  capLots: bigint;
  /** `RESTING_FILL=off`: the venue never takes a resting call (the reference's post-only maker); every call expires. */
  fillEnabled: boolean;
  log: (why: string) => void;
  nowMs?: () => number;
}

const counters = { filled: 0, partial: 0, expired: 0, offersSwept: 0, alreadyEnded: 0, failed: 0 };

async function sweepExpired(d: FillerDeps, calls: readonly Active<RestingCallC>[]): Promise<string[]> {
  const notes: string[] = [];
  for (const c of calls) {
    try {
      const out = await submit(d.venue, { commandId: restExpireCommandId(c.cid), commands: [cmd.expireRest(c.cid)] });
      if (out.kind === "dry") {
        notes.push(out.note);
        continue;
      }
      counters.expired++;
      emitVenueEvent({ kind: "rest-expired", marketId: c.data.marketId, callCid: c.cid, atMs: Date.now() });
    } catch (error) {
      if (isInactive(error)) counters.alreadyEnded++;
      else {
        counters.failed++;
        notes.push(`expire ${c.cid.slice(0, 12)}… failed: ${failureText(error)}`);
      }
    }
  }
  return notes;
}

/** `filled`: a `Rest_Fill` landed; `note`: something worth a log line (a wait, a refusal). */
async function fillOne(d: FillerDeps, c: Active<RestingCallC>): Promise<{ filled: boolean; note?: string }> {
  const entry = d.board.get({ termsCid: c.data.termsCid });
  if (!entry || entry.state !== "quoting") return { filled: false };
  const levels = c.data.side === "SideUp" ? entry.up : entry.down;
  const decision = fillableLots({ priceTicks: c.data.priceTicks, lots: c.data.lots }, levels, d.capLots);
  if (decision.lots <= 0n) return { filled: false };
  const side = c.data.side === "SideUp" ? "up" : "down";
  const stake = decision.lots * BigInt(1000 - c.data.priceTicks) * c.data.cashUnit;
  const takes = d.maker?.takesQuote(entry, { side, priceTicks: c.data.priceTicks, lots: decision.lots, stakeBase: stake }) ?? null;
  let held;
  try {
    held = await leaseFrom(d.pool, d.maker, takes?.take === true, stake, `rest fill ${entry.damlMarketId}`);
  } catch (error) {
    if (error instanceof PoolBusyError) return { filled: false, note: "every venue shard is in use: the fill waits for the next pass" };
    throw error;
  }
  try {
    const out = await submitWithShards(held.pool, d.venue, [held.lease], {
      commandId: restFillCommandId(c.cid, decision.lots),
      commands: [cmd.fillRest(c.cid, { shardCid: held.lease.cid, fillLots: decision.lots })],
    });
    if (out.kind === "dry") return { filled: false, note: `DRY RUN: ${out.note}` };
    consume(entry, side, decision.lots);
    if (held.book) d.maker?.touched();
    if (decision.lots < c.data.lots) counters.partial++;
    else counters.filled++;
    emitVenueEvent({ kind: "rest-filled", marketId: entry.damlMarketId, callCid: c.cid, side, lots: decision.lots.toString(), priceTicks: c.data.priceTicks, atMs: Date.now() });
    d.log(`rest fill ${entry.damlMarketId} ${side} ${decision.lots} of ${c.data.lots} lots @ ${c.data.priceTicks} for ${c.data.owner.split("::")[0]} (${held.book ? "maker vault" : "desk"}; ${decision.why})`);
    return { filled: true };
  } catch (error) {
    if (isInactive(error)) {
      // The owner cancelled it, or the sweeper got it: the shard was freed by `submitWithShards`.
      counters.alreadyEnded++;
      return { filled: false };
    }
    if (isIndefinite(error)) return { filled: false, note: `fill ${c.cid.slice(0, 12)}… did not answer in time; its shard is held until the outcome is known` };
    counters.failed++;
    return { filled: false, note: `fill ${c.cid.slice(0, 12)}… refused: ${refusalId(error) ?? failureText(error)}` };
  }
}

export async function restingPass(d: FillerDeps): Promise<PassResult> {
  const nowSec = Math.floor((d.nowMs ?? Date.now)() / 1000);
  const acs = await readActive(d.venue, [TEMPLATE_IDS.RestingCall, TEMPLATE_IDS.RestingOffer]);
  const calls = pick(acs, TEMPLATE_IDS.RestingCall, decodeRestingCall).filter((c) => c.data.venue === d.venue.party);
  const offers = pick(acs, TEMPLATE_IDS.RestingOffer, decodeRestingOffer).filter((o) => o.data.venue === d.venue.party);
  const notes: string[] = [];

  const due = calls.filter((c) => callExpired(c.data.expiresAtSec, nowSec));
  notes.push(...(await sweepExpired(d, due.slice(0, SWEEPS_PER_PASS))));

  for (const o of offers.filter((x) => offerLapsed(x.data.validUntilSec, nowSec)).slice(0, SWEEPS_PER_PASS)) {
    try {
      const out = await submit(d.venue, { commandId: restOfferExpireCommandId(o.cid), commands: [cmd.expireRestOffer(o.cid)] });
      if (out.kind === "done") counters.offersSwept++;
    } catch (error) {
      if (!isInactive(error)) notes.push(`offer sweep ${o.cid.slice(0, 12)}… failed: ${failureText(error)}`);
    }
  }

  let fills = 0;
  if (d.fillEnabled) {
    const dueCids = new Set(due.map((c) => c.cid));
    // Oldest expiry first: the calls closest to lapsing get the venue's depth before it is spent.
    const live = calls.filter((c) => !dueCids.has(c.cid) && nowSec >= c.data.tradingStartSec).sort((a, b) => a.data.expiresAtSec - b.data.expiresAtSec);
    for (const c of live.slice(0, FILLS_PER_PASS)) {
      const r = await fillOne(d, c);
      if (r.note) notes.push(r.note);
      if (r.filled) fills++;
    }
  }
  for (const n of notes) d.log(n);
  const waiting = calls.filter((c) => nowSec < c.data.tradingStartSec).length;
  return {
    why: `${calls.length} calls (${waiting} waiting for the bell), ${offers.length} offers; filled ${counters.filled}, partly ${counters.partial}, expired ${counters.expired}, already ended ${counters.alreadyEnded}, failed ${counters.failed}${d.fillEnabled ? "" : " · FILL OFF"}${d.venue.dryRun ? " · DRY RUN" : ""}`,
    detail: { ...counters, calls: calls.length, offers: offers.length, waiting },
    nextDelayMs: fills === FILLS_PER_PASS || due.length >= SWEEPS_PER_PASS ? 200 : undefined,
  };
}
