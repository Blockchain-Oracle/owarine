/**
 * `POST /internal/tickets/{range,parlay,boost}` (C8c): the web's HMAC-signed calls, the party taken by the web from the
 * lease only. Each prices with core's kernels (`@owarine/markets/ops/tickets` pricing) off the Window's venue ladder,
 * answers a preview, a requote above the cap the seat confirmed, or a refusal without writing; otherwise it issues on
 * the reserve's `RiskBook` (one queue per reserve) with a leased reserve shard. The accept is always the seat's own;
 * ops never submits it. Earn's liquidity quotes are `earn.ts`.
 */
import { randomUUID } from "node:crypto";
import { TICKET_TEMPLATE_IDS } from "@owarine/daml";
import { diagnosis } from "@owarine/core/types";
import type { LeverageRefusal } from "@owarine/core/leverage";
import type { ParlayRefusal } from "@owarine/core/parlay";
import type { RangeRefusal } from "@owarine/core/range";
import { refusalDiagnosis } from "@owarine/markets/leverage";
import { bidLevels, walkExit, type Side } from "@owarine/markets/ops/canton";
import {
  decodeBoostExitQuote, decodeBoostQuote, decodeParlayQuote, decodeRangeQuote, leverageParams, parlayParams, priceBoost, priceParlay,
  priceRange, rangeBasisOf, rangeParams, tcmd, validUntilFor, TICKET_QUOTE_LIFE_SEC,
} from "@owarine/markets/ops/tickets";
import { boostTicketRequestWire, parlayTicketRequestWire, rangeTicketRequestWire } from "@owarine/markets/server";
import { consume } from "../quote-issuer/issuer";
import type { Lease, ShardPool } from "../quote-issuer/pool";
import type { LadderEntry } from "../market-maker/seat/ladder-board";
import { createdOne, submitWithPools, type Desk } from "./desk";
import { failed, isAnswer, lease, nowSec, onReserve, refused, reply, seatOf, split, windowFor, type Answer } from "./common";
import { venueModeRefusalNow } from "../../runtime/venue-mode";

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
  const modeWhy = venueModeRefusalNow("open-position");
  if (modeWhy) return refused("market-not-trading", modeWhy);
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
  const modeWhy = venueModeRefusalNow("open-position");
  if (modeWhy) return refused("market-not-trading", modeWhy);
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
  // A boost's exit returned above, before this: a way out never asks the venue mode.
  const modeWhy = venueModeRefusalNow("open-position");
  if (modeWhy) return refused("market-not-trading", modeWhy);
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

