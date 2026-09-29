/**
 * `POST /internal/tickets/{range,parlay,boost,earn}` (C8c): the web's HMAC-signed calls, the party taken by the web
 * from the lease only. Each prices with core's kernels (`@agari/markets/ops/tickets` pricing) off the Window's venue
 * ladder, answers a preview, a requote above the cap the seat confirmed, or a refusal without writing; otherwise it
 * issues on the reserve's `RiskBook` (one queue per reserve) with a leased reserve shard. The accept is always the
 * seat's own; ops never submits it.
 */
import { randomUUID } from "node:crypto";
import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import { diagnosis, type DiagnosisKind } from "@agari/core/types";
import type { LeverageRefusal } from "@agari/core/leverage";
import type { ParlayRefusal } from "@agari/core/parlay";
import type { RangeRefusal } from "@agari/core/range";
import { refusalDiagnosis } from "@agari/markets/leverage";
import { bidLevels, failureText, isInactive, isIndefinite, refusalId, walkExit, type Side } from "@agari/markets/ops/canton";
import {
  decodeBoostExitQuote, decodeBoostQuote, decodeParlayQuote, decodeRangeQuote, decodeSupplyQuote, decodeWithdrawQuote, leverageParams, parlayParams, priceBoost, priceParlay,
  priceRange, rangeBasisOf, rangeParams, tcmd, validUntilFor, TICKET_QUOTE_LIFE_SEC, type TicketReserveId, type TicketWindow,
} from "@agari/markets/ops/tickets";
import { boostTicketRequestWire, earnRequestWire, parlayTicketRequestWire, rangeTicketRequestWire } from "@agari/markets/server";
import { consume } from "../quote-issuer/issuer";
import { PoolBusyError, type Lease, type ShardPool } from "../quote-issuer/pool";
import type { LadderEntry } from "../market-maker/seat/ladder-board";
import { adoptCreated, createdOne, submitWithPools, type Desk } from "./desk";

type Answer = { status: number; body: unknown };
const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;
const LEASE_ID = /^[A-Za-z0-9_\-]{1,64}$/;

/** Bigints travel as decimal strings: the HTTP layer's `jsonText` writes them so. */
const reply = (body: unknown): Answer => ({ status: 200, body });
const refused = (kind: DiagnosisKind, technical: string): Answer => reply({ kind: "refused", diagnosis: diagnosis(kind, technical) });
const nowSec = () => Math.floor(Date.now() / 1000);

/** Who the web says the seat is (taken from its lease row), checked for shape and against the infrastructure parties. */
function seatOf(d: Desk, body: Record<string, unknown>): { party: string; leaseId: string } | Answer {
  const { party, leaseId } = body;
  if (typeof party !== "string" || !PARTY_ID.test(party)) return { status: 400, body: { diagnosis: diagnosis("unknown", "party must be a party id") } };
  if (typeof leaseId !== "string" || !LEASE_ID.test(leaseId)) return { status: 400, body: { diagnosis: diagnosis("unknown", "leaseId must be 1–64 of [A-Za-z0-9_-]") } };
  if (d.infrastructure.has(party)) return refused("unknown", "an infrastructure party is not a seat");
  return { party, leaseId };
}

const isAnswer = (x: unknown): x is Answer => typeof x === "object" && x !== null && "status" in x && "body" in x;

function split(body: unknown): { rest: Record<string, unknown>; seat: Record<string, unknown> } | null {
  if (typeof body !== "object" || body === null) return null;
  const { party, leaseId, ...rest } = body as Record<string, unknown>;
  return { rest, seat: { party, leaseId } };
}

function windowFor(d: Desk, marketId: string): LadderEntry | Answer {
  const entry = d.board.get({ marketId });
  if (!entry || entry.state !== "quoting") return refused("market-not-trading", "the venue is not quoting this Window (no open print yet, or its quoting time is over)");
  return entry;
}

function rangeRefusal(r: RangeRefusal | { kind: "too-late"; leftSec: number; minSec: number } | { kind: "centre"; centerQE6: number }): Answer {
  switch (r.kind) {
    case "band":
      return refused("outside-band", `the band ${r.lowPrint}–${r.highPrint} is empty`);
    case "long-shot":
      return refused("outside-band", `LongShot(${r.probRaw}, ${r.minProbRaw}): the reserve prices nothing this unlikely`);
    case "near-certain":
      return refused("outside-band", `NearCertain(${r.probRaw}, ${r.maxProbRaw}): too close to certain to price`);
    case "underpriced":
      return refused("outside-band", `Underpriced(${r.stakeBase}, ${r.maxPayoutBase})`);
    case "over-payout-cap":
      return refused("reserve-cap", `OverPayoutCap(${r.maxPayoutBase}, ${r.capBase})`);
    case "zero":
      return refused("below-min-quantity", "the amount is zero");
    case "too-late":
      return refused("market-not-trading", `${r.leftSec}s left; tickets close ${r.minSec}s before the Window ends`);
    case "centre":
      return refused("thin-book", `the venue's price (${r.centerQE6 / 10_000}%) is too one-sided to price a band`);
  }
}

function parlayRefusal(r: ParlayRefusal | { kind: "too-late"; legIdx: number; leftSec: number; minSec: number } | { kind: "duplicate-leg" }): Answer {
  switch (r.kind) {
    case "legs":
      return refused("contract-revert", `a parlay has ${r.min} to ${r.max} legs`);
    case "thin-book":
      return refused("thin-book", `leg ${r.legIdx + 1}: ${r.availableRaw} of ${r.neededRaw} on offer`);
    case "long-shot":
      return refused("outside-band", `LongShot(${r.combinedProbRaw}, ${r.minCombinedProbRaw})`);
    case "underpriced":
      return refused("outside-band", `Underpriced(${r.stakeBase}, ${r.maxPayoutBase})`);
    case "over-payout-cap":
      return refused("reserve-cap", `OverPayoutCap(${r.maxPayoutBase}, ${r.capBase})`);
    case "zero":
      return refused("below-min-quantity", "the amount is zero");
    case "too-late":
      return refused("market-not-trading", `leg ${r.legIdx + 1}: ${r.leftSec}s left; tickets close ${r.minSec}s before a Window ends`);
    case "duplicate-leg":
      return refused("contract-revert", "each leg must be a different Window");
  }
}

function boostRefusal(r: LeverageRefusal): Answer {
  const d = refusalDiagnosis(r);
  return reply({ kind: "refused", diagnosis: d });
}

async function lease(pool: ShardPool | null, amount: bigint, purpose: string): Promise<Lease | Answer> {
  if (!pool) return refused("not-deployed", "no shard pool in this ops process");
  try {
    return await pool.lease(amount, purpose);
  } catch (error) {
    if (error instanceof PoolBusyError) return refused("reserve-cap", `no ${purpose.split(" ")[0]} shard covers ${amount} right now; try again in a moment`);
    throw error;
  }
}

/** A write on one reserve's book or statement: its queue, a stale-id retry once, and the pools told what landed. */
async function onReserve(d: Desk, reserve: TicketReserveId, held: ReadonlyArray<readonly [ShardPool, readonly Lease[]]>, build: (ids: { navCid: string; bookCid: string }) => { commandId: string; commands: import("@agari/ledger").Command[] }) {
  return d.lock(reserve, async () => {
    for (let attempt = 0; ; attempt++) {
      const l = d.live.get(reserve)!;
      if (!l.navCid || !l.bookCid) {
        await d.refresh();
        if (!l.navCid || !l.bookCid) throw new DeskRefusal("not-deployed", `the ${reserve} reserve has no statement or book on this participant: run the bootstrap`);
      }
      try {
        const input = build({ navCid: l.navCid!, bookCid: l.bookCid! });
        const out = await submitWithPools(d.venue, held, input);
        adoptCreated(d, reserve, out);
        return out;
      } catch (error) {
        // The book or statement moved under us (a publish from another process): read again, once.
        if (attempt === 0 && isInactive(error) && [l.navCid, l.bookCid].some((c) => c && failureText(error).includes(c))) {
          await d.refresh();
          continue;
        }
        throw error;
      }
    }
  });
}

class DeskRefusal extends Error {
  constructor(readonly kind: DiagnosisKind, technical: string) {
    super(technical);
  }
}

function failed(d: Desk, what: string, error: unknown): Answer {
  if (error instanceof DeskRefusal) return refused(error.kind, error.message);
  if (isIndefinite(error)) return refused("send-unknown", `the ledger did not answer in time (${what}); the shards are held until its outcome is known`);
  const id = refusalId(error);
  d.log(`${what} refused: ${failureText(error)}`);
  const kind: DiagnosisKind = id && /over-|exposure/.test(id) ? "reserve-cap" : "contract-revert";
  return refused(kind, id ?? failureText(error).slice(0, 200));
}

// ---- range ------------------------------------------------------------------------------------------

export async function handleRange(d: Desk, body: unknown): Promise<Answer> {
  const parts = split(body);
  if (!parts) return { status: 400, body: { diagnosis: diagnosis("unknown", "body must be an object") } };
  const parsed = rangeTicketRequestWire.safeParse(parts.rest);
  if (!parsed.success) return { status: 400, body: { diagnosis: diagnosis("unknown", `bad range request: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`) } };
  const req = parsed.data;
  const w = windowFor(d, req.marketId);
  if (isAnswer(w)) return w;
  const now = nowSec();
  const params = rangeParams();
  if (req.op === "basis") {
    const b = rangeBasisOf(w, now);
    return reply({ kind: "basis", openingPrint: b.openingPrint, centerQE6: b.centerQE6, sigmaE8: b.sigmaE8, tauSec: b.basis.tauSec, expirySec: w.expirySec });
  }
  const band = { side: req.side, lowPrint: req.lowE8, highPrint: req.highE8 };
  if (req.op === "preview") {
    const p = priceRange(w, band, req.mode, params, now);
    return p.ok ? reply({ kind: "preview", quote: p.quote, basis: p.basis, openingPrint: p.openingPrint }) : rangeRefusal(p.refusal);
  }
  const seat = seatOf(d, parts.seat);
  if (isAnswer(seat)) return seat;
  if (d.draining?.has(seat.party)) return refused("market-not-trading", "this seat is draining: no new tickets");
  const p = priceRange(w, band, { kind: "fixPayout", maxPayoutBase: req.maxPayoutBase }, params, now);
  if (!p.ok) return rangeRefusal(p.refusal);
  if (p.quote.stakeBase > req.maxStakeBase) return reply({ kind: "requote", stakeBase: p.quote.stakeBase, maxPayoutBase: p.quote.maxPayoutBase });
  const validUntilSec = validUntilFor(w, now);
  const houseLocked = p.quote.maxPayoutBase - p.quote.stakeBase;
  const pool = d.reservePools.get("range")!;
  const shard = await lease(pool, houseLocked, "reserve range");
  if (isAnswer(shard)) return shard;
  const requestId = randomUUID();
  try {
    const out = await onReserve(d, "range", [[pool, [shard]]], ({ navCid, bookCid }) => ({
      commandId: `ticket:range:${requestId}`,
      commands: [tcmd.issueRange(bookCid, {
        navCid, shardCid: shard.cid, user: seat.party, termsCid: w.termsCid, kind: req.moonshot ? "Moonshot" : "RangeTicket",
        side: req.side === "inside" ? "Inside" : "Outside", lowE8: req.lowE8, highE8: req.highE8, stake: p.quote.stakeBase, maxPayout: p.quote.maxPayoutBase, validUntilSec,
      })],
    }));
    if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
    const q = createdOne(out, TICKET_TEMPLATE_IDS.RangeQuote, decodeRangeQuote);
    if (!q) return refused("unknown", "the issue landed without a range quote");
    d.log(`range ${w.damlMarketId} ${req.side} ${req.lowE8}–${req.highE8} ${q.data.stake}→${q.data.maxPayout} to ${seat.party.split("::")[0]} (lease ${seat.leaseId}) in ${out.ms} ms`);
    return reply({ kind: "quote", quoteCid: q.cid, stakeBase: q.data.stake, maxPayoutBase: q.data.maxPayout, validUntilMs: validUntilSec * 1000 });
  } catch (error) {
    return failed(d, `range ${requestId}`, error);
  }
}

// ---- parlay -----------------------------------------------------------------------------------------

export async function handleParlay(d: Desk, body: unknown): Promise<Answer> {
  const parts = split(body);
  if (!parts) return { status: 400, body: { diagnosis: diagnosis("unknown", "body must be an object") } };
  const parsed = parlayTicketRequestWire.safeParse(parts.rest);
  if (!parsed.success) return { status: 400, body: { diagnosis: diagnosis("unknown", `bad parlay request: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`) } };
  const req = parsed.data;
  const legs: Array<{ window: LadderEntry; side: "up" | "down" }> = [];
  for (const l of req.legs) {
    const w = windowFor(d, l.marketId);
    if (isAnswer(w)) return w;
    legs.push({ window: w, side: l.side });
  }
  const now = nowSec();
  const params = parlayParams();
  if (req.op === "preview") {
    if (legs.length < 2) return reply({ kind: "refused", diagnosis: diagnosis("contract-revert", "a parlay has 2 to 3 legs") });
    const p = priceParlay(legs, req.mode, params, now);
    return p.ok ? reply({ kind: "preview", quote: p.quote }) : parlayRefusal(p.refusal);
  }
  const seat = seatOf(d, parts.seat);
  if (isAnswer(seat)) return seat;
  if (d.draining?.has(seat.party)) return refused("market-not-trading", "this seat is draining: no new tickets");
  const p = priceParlay(legs, { kind: "fixPayout", maxPayoutBase: req.maxPayoutBase }, params, now);
  if (!p.ok) return parlayRefusal(p.refusal);
  if (p.quote.stakeBase > req.maxStakeBase) return reply({ kind: "requote", stakeBase: p.quote.stakeBase, maxPayoutBase: p.quote.maxPayoutBase });
  // Every leg must still trade until the quote expires (`validUntil <= lockAt` for each).
  const validUntilSec = Math.min(now + TICKET_QUOTE_LIFE_SEC, ...legs.map((l) => l.window.lockAtSec));
  if (validUntilSec - now < 5) return refused("market-not-trading", "a leg's Window locks too soon to hold a price");
  const houseLocked = p.quote.maxPayoutBase - p.quote.stakeBase;
  const pool = d.reservePools.get("parlay")!;
  const shard = await lease(pool, houseLocked, "reserve parlay");
  if (isAnswer(shard)) return shard;
  const requestId = randomUUID();
  try {
    const out = await onReserve(d, "parlay", [[pool, [shard]]], ({ navCid, bookCid }) => ({
      commandId: `ticket:parlay:${requestId}`,
      commands: [tcmd.issueParlay(bookCid, {
        navCid, shardCid: shard.cid, user: seat.party, picks: legs.map((l) => ({ termsCid: l.window.termsCid, side: (l.side === "up" ? "SideUp" : "SideDown") as Side })),
        stake: p.quote.stakeBase, maxPayout: p.quote.maxPayoutBase, validUntilSec,
      })],
    }));
    if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
    const q = createdOne(out, TICKET_TEMPLATE_IDS.ParlayQuote, decodeParlayQuote);
    if (!q) return refused("unknown", "the issue landed without a parlay quote");
    d.log(`parlay ${legs.map((l) => `${l.window.damlMarketId} ${l.side}`).join(" + ")} ${q.data.stake}→${q.data.maxPayout} to ${seat.party.split("::")[0]} in ${out.ms} ms`);
    return reply({ kind: "quote", quoteCid: q.cid, stakeBase: q.data.stake, maxPayoutBase: q.data.maxPayout, validUntilMs: validUntilSec * 1000 });
  } catch (error) {
    return failed(d, `parlay ${requestId}`, error);
  }
}

// ---- boost ------------------------------------------------------------------------------------------

export async function handleBoost(d: Desk, body: unknown): Promise<Answer> {
  const parts = split(body);
  if (!parts) return { status: 400, body: { diagnosis: diagnosis("unknown", "body must be an object") } };
  const parsed = boostTicketRequestWire.safeParse(parts.rest);
  if (!parsed.success) return { status: 400, body: { diagnosis: diagnosis("unknown", `bad boost request: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`) } };
  const req = parsed.data;
  if (req.op === "exit") return boostExit(d, parts.seat, req.positionCid, req.minProceedsBase);
  const w = windowFor(d, req.marketId);
  if (isAnswer(w)) return w;
  const now = nowSec();
  const params = leverageParams();
  const p = priceBoost(w, req.side, req.stakeBase, req.leverageBps, params, now);
  if (req.op === "preview") return p.ok ? reply({ kind: "preview", quote: p.quote }) : boostRefusal(p.refusal);
  const seat = seatOf(d, parts.seat);
  if (isAnswer(seat)) return seat;
  if (d.draining?.has(seat.party)) return refused("market-not-trading", "this seat is draining: no new boosts");
  if (!p.ok) return boostRefusal(p.refusal);
  if (p.quote.quantityRaw < req.minQuantityRaw) return reply({ kind: "requote", quote: p.quote, proceedsBase: null });
  const t = p.terms;
  const validUntilSec = validUntilFor(w, now);
  const reservePool = d.reservePools.get("boost")!;
  const houseStake = t.lots * BigInt(1000 - t.priceTicks) * t.cashUnit;
  const house = await lease(d.venuePool, houseStake, "venue boost");
  if (isAnswer(house)) return house;
  let front: Lease | null = null;
  if (t.fronted > 0n) {
    const r = await lease(reservePool, t.fronted, "reserve boost");
    if (isAnswer(r)) {
      d.venuePool?.release([house]);
      return r;
    }
    front = r;
  }
  const requestId = randomUUID();
  const held: Array<readonly [ShardPool, readonly Lease[]]> = [[d.venuePool!, [house]], ...(front ? [[reservePool, [front]] as const] : [])];
  try {
    const out = await onReserve(d, "boost", held, ({ navCid, bookCid }) => ({
      commandId: `ticket:boost:${requestId}`,
      commands: [tcmd.issueBoost(bookCid, {
        navCid, reserveShardCid: front?.cid ?? house.cid, houseShardCid: house.cid, user: seat.party, termsCid: w.termsCid, pairId: requestId,
        side: req.side === "up" ? "SideUp" : "SideDown", priceTicks: t.priceTicks, lots: t.lots, leverageBps: t.leverageBps, stake: t.stake, fronted: t.fronted,
        premium: t.premium, barrierE8: t.barrierE8, knockOutProceeds: t.knockOutProceeds, validUntilSec,
      })],
    }));
    if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
    const q = createdOne(out, TICKET_TEMPLATE_IDS.BoostQuote, decodeBoostQuote);
    if (!q) return refused("unknown", "the issue landed without a boost quote");
    consume(w, req.side, t.lots);
    d.log(`boost ${w.damlMarketId} ${req.side} ${t.leverageBps / 10_000}x ${t.lots} @ ${t.priceTicks} stake ${t.stake} front ${t.fronted} to ${seat.party.split("::")[0]} in ${out.ms} ms`);
    return reply({ kind: "quote", quoteCid: q.cid, quote: p.quote, validUntilMs: validUntilSec * 1000 });
  } catch (error) {
    return failed(d, `boost ${requestId}`, error);
  }
}

/** A firm whole-position buy-back (`Boost_OfferExit`) at the bid side's walk, superseding the seat's earlier ones. */
async function boostExit(d: Desk, seatBody: Record<string, unknown>, positionCid: string, minProceedsBase: bigint): Promise<Answer> {
  const seat = seatOf(d, seatBody);
  if (isAnswer(seat)) return seat;
  const snap = await d.refresh();
  const pos = snap.positions.find((p) => p.cid === positionCid);
  if (!pos || pos.data.owner !== seat.party) return refused("already-claimed", "this seat holds no such boost (settled, knocked out or sold)");
  const side = pos.data.side === "SideUp" ? "up" : "down";
  const w = d.board.get({ termsCid: pos.data.termsCid });
  const now = nowSec();
  if (!w || w.state !== "quoting" || now >= w.lockAtSec) return refused("market-not-trading", "No exit liquidity: this Window has locked, it pays at settlement");
  const walked = walkExit(bidLevels(w, side), pos.data.lots, pos.data.cashUnit);
  if (!walked || walked.lots < pos.data.lots) return refused("no-liquidity", "No exit liquidity right now: the venue's bids cannot take the whole position");
  if (walked.proceedsBase < minProceedsBase) return reply({ kind: "requote", quote: null, proceedsBase: walked.proceedsBase });
  const shard = await lease(d.venuePool, walked.proceedsBase, "venue exit");
  if (isAnswer(shard)) return shard;
  const stale = snap.exitQuotes.filter((q) => q.data.positionCid === positionCid);
  const validUntilSec = Math.min(now + TICKET_QUOTE_LIFE_SEC, w.lockAtSec);
  const requestId = randomUUID();
  try {
    const out = await submitWithPools(d.venue, [[d.venuePool!, [shard]]], {
      commandId: `ticket:exit:${requestId}`,
      commands: [
        ...stale.map((q) => tcmd.withdrawBoostExit(q.cid, "superseded by a fresh exit quote")),
        tcmd.offerBoostExit(positionCid, { shardCid: shard.cid, exitTicks: walked.priceTicks, validUntilSec }),
      ],
    });
    if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
    const q = createdOne(out, TICKET_TEMPLATE_IDS.BoostExitQuote, decodeBoostExitQuote);
    if (!q) return refused("unknown", "the offer landed without an exit quote");
    consume(w, side === "up" ? "down" : "up", walked.lots);
    d.log(`boost exit ${w.damlMarketId} ${side} ${walked.lots} @ ${walked.priceTicks} → ${q.data.proceeds} to ${seat.party.split("::")[0]}`);
    return reply({ kind: "exit-quote", quoteCid: q.cid, proceedsBase: q.data.proceeds, validUntilMs: validUntilSec * 1000 });
  } catch (error) {
    return failed(d, `boost exit ${requestId}`, error);
  }
}

// ---- earn ---------------------------------------------------------------------------------------------

export const LIQUIDITY_QUOTE_LIFE_SEC = 30;

export async function handleEarn(d: Desk, body: unknown): Promise<Answer> {
  const parts = split(body);
  if (!parts) return { status: 400, body: { diagnosis: diagnosis("unknown", "body must be an object") } };
  const parsed = earnRequestWire.safeParse(parts.rest);
  if (!parsed.success) return { status: 400, body: { diagnosis: diagnosis("unknown", `bad earn request: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`) } };
  const req = parsed.data;
  const seat = seatOf(d, parts.seat);
  if (isAnswer(seat)) return seat;
  const reserve = req.reserve;
  const validUntilSec = nowSec() + LIQUIDITY_QUOTE_LIFE_SEC;
  const requestId = randomUUID();
  if (req.op === "supply") {
    if (req.amountBase <= 0n) return refused("below-min-quantity", "supply must be positive");
    try {
      const out = await onReserve(d, reserve, [], ({ navCid }) => ({ commandId: `earn:supply:${requestId}`, commands: [tcmd.issueSupply(navCid, { provider: seat.party, cashIn: req.amountBase, validUntilSec })] }));
      if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
      const q = createdOne(out, TEMPLATE_IDS.SupplyQuote, decodeSupplyQuote);
      if (!q) return refused("unknown", "the issue landed without a supply quote");
      d.log(`earn ${reserve} supply ${q.data.cashIn} → ${q.data.sharesOut} shares for ${seat.party.split("::")[0]}`);
      return reply({ kind: "supply-quote", quoteCid: q.cid, cashIn: q.data.cashIn, sharesOut: q.data.sharesOut, validUntilMs: validUntilSec * 1000 });
    } catch (error) {
      return failed(d, `earn supply ${requestId}`, error);
    }
  }
  const snap = await d.refresh();
  const shares = snap.lpShares.filter((s) => s.data.provider === seat.party && s.data.reserveId === reserve).sort((a, b) => (a.data.shares > b.data.shares ? -1 : 1));
  const share = shares[0];
  if (!share) return refused("insufficient-collateral", `this seat holds no ${reserve} reserve shares`);
  if (req.shares <= 0n || req.shares > share.data.shares) {
    return refused("insufficient-collateral", shares.length > 1 ? `withdraw at most ${share.data.shares} shares at once (merge the seat's shares first)` : `this seat holds ${share.data.shares} shares`);
  }
  const nav = snap.navs.get(reserve);
  if (!nav || nav.data.shares === 0n) return refused("not-deployed", `the ${reserve} reserve has no live statement`);
  const cashOut = (req.shares * nav.data.assets) / nav.data.shares;
  if (cashOut <= 0n) return refused("below-min-quantity", "these shares redeem for nothing at this NAV");
  const pool = d.reservePools.get(reserve)!;
  const shard = await lease(pool, cashOut, `reserve ${reserve}`);
  if (isAnswer(shard)) return refused("reserve-cap", `the ${reserve} reserve's liquid cash cannot pay ${cashOut} right now: the rest is locked behind live tickets`);
  try {
    const earnDesk = d.earnDeskCid;
    if (!earnDesk) throw new DeskRefusal("not-deployed", "no EarnDesk on this participant: run the bootstrap");
    const out = await onReserve(d, reserve, [[pool, [shard]]], ({ navCid }) => ({
      commandId: `earn:withdraw:${requestId}`,
      commands: [tcmd.issueWithdraw(earnDesk, { navCid, provider: seat.party, lpShareCid: share.cid, sharesIn: req.shares, shardCid: shard.cid, validUntilSec })],
    }));
    if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
    const q = createdOne(out, TEMPLATE_IDS.WithdrawQuote, decodeWithdrawQuote);
    if (!q) return refused("unknown", "the issue landed without a withdraw quote");
    d.log(`earn ${reserve} withdraw ${q.data.sharesIn} shares → ${q.data.cashOut} for ${seat.party.split("::")[0]}`);
    return reply({ kind: "withdraw-quote", quoteCid: q.cid, sharesIn: q.data.sharesIn, cashOut: q.data.cashOut, validUntilMs: validUntilSec * 1000 });
  } catch (error) {
    return failed(d, `earn withdraw ${requestId}`, error);
  }
}

export type { TicketWindow };
