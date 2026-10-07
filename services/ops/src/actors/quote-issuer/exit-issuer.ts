/**
 * The exit issuer (C7a, plan §6 mirrored for a sale): `POST /internal/exit-quotes` walks the BID side of the venue price
 * ladder with core's kernel (`exitWalk`, via `walkExit`) for the seat's held side, answers a requote and creates nothing
 * when the proceeds are below the floor the user confirmed, and otherwise exercises `Desk_IssueBuyQuote` once per leg
 * the sale takes (largest first, the last one partial through `sellLots`), each locking its price from a leased shard:
 * firm `BuyQuote`s for this seat, alive 20 s. The accept is the user's own (`BuyQuote_Accept`), never ops'.
 *
 * The seat's earlier live buy-backs on the same Window are withdrawn in the same transaction, so a fresh exit quote
 * always supersedes the last one and no leg is ever quoted twice. User exits never check the venue's mode: a draining
 * seat may still sell.
 *
 *   request  `{ marketId, side, contractsRaw, displayedMinProceedsBase, party, leaseId }` (bigints as strings)
 *   reply    `{ kind: "quote", quoteCids, exit, validUntilMs }` · `{ kind: "requote", exit }` · `{ kind: "refused", diagnosis }`
 */
import { randomUUID } from "node:crypto";
import { TEMPLATE_IDS } from "@owarine/daml";
import { diagnosis, isMarketId, type DiagnosisKind, type ExitQuote } from "@owarine/core/types";
import {
  allocateLegs, bidLevels, cmd, decodeBuyQuote, decodeLeg, exitQuoteCommandId, failureText, isIndefinite, pick, readActive, refusalId,
  templateSuffix, walkExit, type Side, type WalkedExit,
} from "@owarine/markets/ops/canton";
import { CASH_DECIMALS } from "@owarine/markets/server";
import { emitVenueEvent } from "../venue/events";
import { consume, latencies, type IssuerDeps } from "./issuer";
import { PoolBusyError, type Lease, type ShardPool } from "./pool";
import { submitWithShards } from "./pooled-submit";

/** The reference's words (`provider/exit-quote.ts`), so the portfolio's refusals read the same. */
export const NO_EXIT_LIQUIDITY = "No exit liquidity right now";
export const EXIT_LOCKED = "No exit liquidity: this Window has locked, it pays at settlement";
/** One exit quote takes at most this many legs (one shard each). */
export const MAX_EXIT_LEGS = 4;

export interface ExitRequest {
  marketId: string;
  side: "up" | "down";
  contractsRaw: bigint;
  displayedMinProceedsBase: bigint;
  party: string;
  leaseId: string;
}

type Answer = { status: number; body: unknown };

const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;
const LEASE_ID = /^[A-Za-z0-9_\-]{1,64}$/;
const UINT = /^\d{1,19}$/;

export function parseExitRequest(body: unknown): ExitRequest | string {
  if (typeof body !== "object" || body === null) return "body must be an object";
  const b = body as Record<string, unknown>;
  if (typeof b.party !== "string" || !PARTY_ID.test(b.party)) return "party must be a party id";
  if (typeof b.leaseId !== "string" || !LEASE_ID.test(b.leaseId)) return "leaseId must be 1–64 of [A-Za-z0-9_-]";
  if (typeof b.marketId !== "string" || !isMarketId(b.marketId)) return "marketId must be the app's base58 market id";
  if (b.side !== "up" && b.side !== "down") return "side must be up or down";
  if (typeof b.contractsRaw !== "string" || !UINT.test(b.contractsRaw) || BigInt(b.contractsRaw) === 0n) return "contractsRaw must be a positive decimal integer string";
  if (typeof b.displayedMinProceedsBase !== "string" || !UINT.test(b.displayedMinProceedsBase)) return "displayedMinProceedsBase must be a decimal integer string";
  return { marketId: b.marketId, side: b.side, contractsRaw: BigInt(b.contractsRaw), displayedMinProceedsBase: BigInt(b.displayedMinProceedsBase), party: b.party, leaseId: b.leaseId };
}

const refused = (kind: DiagnosisKind, technical: string): Answer => ({ status: 200, body: { kind: "refused", diagnosis: diagnosis(kind, technical) } });

/** The walked sale in the app's `ExitQuote` shape: firm, so expected and minimum proceeds are the same number. */
export function exitOf(side: "up" | "down", w: WalkedExit, cashUnit: bigint): ExitQuote {
  const yesTicks = side === "up" ? w.priceTicks : 1000 - w.priceTicks;
  return {
    contractsRaw: w.lots * 1000n * cashUnit,
    limitPriceRaw: (BigInt(yesTicks) * 10n ** BigInt(CASH_DECIMALS)) / 1000n,
    expectedProceedsBase: w.proceedsBase,
    minProceedsBase: w.proceedsBase,
    avgPriceBps: w.priceTicks * 10,
  };
}

export async function issueExitQuote(d: IssuerDeps, req: ExitRequest): Promise<Answer> {
  if (d.infrastructure.has(req.party)) return refused("unknown", "an infrastructure party is not a seat");
  const entry = d.board.get({ marketId: req.marketId });
  if (!entry || entry.state !== "quoting") return refused("market-not-trading", EXIT_LOCKED);
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const validUntilSec = Math.min(nowSec + d.settings.quoteLifeSec, entry.lockAtSec);
  if (nowSec > entry.quotingUntilSec || validUntilSec - nowSec < d.settings.minQuoteLifeSec) return refused("market-not-trading", EXIT_LOCKED);

  const outcome: Side = req.side === "up" ? "SideUp" : "SideDown";
  const acs = await readActive(d.venue, [TEMPLATE_IDS.Leg, TEMPLATE_IDS.BuyQuote]);
  const legs = pick(acs, TEMPLATE_IDS.Leg, decodeLeg)
    .filter((l) => l.data.owner === req.party && l.data.termsCid === entry.termsCid && l.data.outcome === outcome)
    .map((l) => ({ cid: l.cid, lots: l.data.lots }));
  const stale = pick(acs, TEMPLATE_IDS.BuyQuote, decodeBuyQuote).filter((q) => q.data.user === req.party && q.data.termsCid === entry.termsCid);
  const held = legs.reduce((s, l) => s + l.lots, 0n);
  if (held === 0n) return refused("contract-revert", `nothing held on the ${req.side} side to cash out`);

  const unit = 1000n * entry.cashUnit;
  const want = req.contractsRaw / unit < held ? req.contractsRaw / unit : held;
  if (want === 0n) return refused("below-min-quantity", "the size is below one lot");
  const walked = walkExit(bidLevels(entry, req.side), want, entry.cashUnit);
  if (!walked) return refused("no-liquidity", NO_EXIT_LIQUIDITY);
  const exit = exitOf(req.side, walked, entry.cashUnit);
  if (walked.proceedsBase < req.displayedMinProceedsBase) return { status: 200, body: { kind: "requote", exit } };

  const plan = allocateLegs(legs, walked.lots, MAX_EXIT_LEGS);
  const planned = plan.reduce((s, p) => s + p.sell, 0n);
  if (planned < walked.lots) {
    // More legs than one quote takes: sell what the largest legs hold, at the same price, as a fresh quote says.
    const fewer = exitOf(req.side, { ...walked, lots: planned, proceedsBase: planned * BigInt(walked.priceTicks) * entry.cashUnit }, entry.cashUnit);
    if (fewer.minProceedsBase < req.displayedMinProceedsBase) return { status: 200, body: { kind: "requote", exit: fewer } };
  }

  const started = Date.now();
  const lockOf = (sell: bigint) => sell * BigInt(walked.priceTicks) * entry.cashUnit;
  // 0.5.0: the maker vault buys back what it sold (the other half of each pair is its own), so it can net the pair.
  const pairOf = new Map(pick(acs, TEMPLATE_IDS.Leg, decodeLeg).map((l) => [l.cid, l.data.pairId]));
  const takes = d.maker?.takesExit(entry, {
    side: req.side, pairIds: plan.map((p) => pairOf.get(p.leg.cid) ?? ""), priceTicks: walked.priceTicks, lots: planned, lockBase: lockOf(planned),
  }) ?? null;
  // Every shard of one exit comes from one pool: the book's when it takes the exit and covers every leg, else the desk's.
  const leaseAll = async (from: ShardPool, purpose: string): Promise<Lease[]> => {
    const got: Lease[] = [];
    try {
      for (const p of plan) got.push(await from.lease(lockOf(p.sell), purpose));
      return got;
    } catch (error) {
      from.release(got);
      throw error;
    }
  };
  let pool = d.pool;
  let book = false;
  let leases: Lease[];
  try {
    if (takes?.take && d.maker) {
      try {
        leases = await leaseAll(d.maker.pool, `maker exit ${entry.damlMarketId}`);
        pool = d.maker.pool;
        book = true;
      } catch (error) {
        if (!(error instanceof PoolBusyError)) throw error;
        leases = await leaseAll(d.pool, `exit ${entry.damlMarketId}`);
      }
    } else leases = await leaseAll(d.pool, `exit ${entry.damlMarketId}`);
  } catch (error) {
    if (error instanceof PoolBusyError) return refused("rpc-down", "every venue shard is in use; try again in a moment");
    throw error;
  }
  const requestId = randomUUID();
  const deskCid = await d.deskCid();
  try {
    const out = await submitWithShards(pool, d.venue, leases, {
      commandId: exitQuoteCommandId(requestId),
      commands: [
        ...stale.map((q) => cmd.withdrawBuyQuote(q.cid, "superseded by a fresh exit quote")),
        ...plan.map((p, i) => cmd.issueBuyQuote(deskCid, { shardCid: leases[i]!.cid, legCid: p.leg.cid, priceTicks: walked.priceTicks, validUntilSec, sellLots: p.sell === p.leg.lots ? null : p.sell })),
      ],
    });
    if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
    const quoteCids = out.created.filter((e) => templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.BuyQuote)).map((e) => e.contractId);
    if (quoteCids.length === 0) return refused("unknown", "the issue landed without a buy-back quote");
    const lots = plan.reduce((s, p) => s + p.sell, 0n);
    const firm = exitOf(req.side, { lots, priceTicks: walked.priceTicks, proceedsBase: lots * BigInt(walked.priceTicks) * entry.cashUnit }, entry.cashUnit);
    // The bid side is the opposite ladder: a buy-back takes depth from there.
    consume(entry, req.side === "up" ? "down" : "up", lots);
    if (book) d.maker?.touched();
    const issueMs = Date.now() - started;
    latencies.push(issueMs);
    emitVenueEvent({ kind: "quoted", marketId: entry.damlMarketId, quoteCid: quoteCids[0]!, side: req.side, lots: lots.toString(), priceTicks: walked.priceTicks, issueMs, atMs: Date.now() });
    d.log(`exit ${entry.damlMarketId} sell ${req.side} ${lots} @ ${walked.priceTicks} over ${plan.length} leg(s)${stale.length ? `, ${stale.length} superseded` : ""}${book ? " · maker vault" : ""} to ${req.party.split("::")[0]} (lease ${req.leaseId}) in ${issueMs} ms`);
    return { status: 200, body: { kind: "quote", quoteCids, exit: firm, validUntilMs: validUntilSec * 1000 } };
  } catch (error) {
    if (isIndefinite(error)) return refused("send-unknown", `the ledger did not answer in time (exit quote ${requestId}); the shards are held until its outcome is known`);
    d.log(`exit ${entry.damlMarketId} refused: ${failureText(error)}`);
    return refused("contract-revert", refusalId(error) ?? failureText(error).slice(0, 200));
  }
}
