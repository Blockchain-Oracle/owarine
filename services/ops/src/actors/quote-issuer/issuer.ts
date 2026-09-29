/**
 * The quote issuer (plan §6, the seed maker's `quote.ts` re-meant): `POST /internal/quotes` walks the venue price ladder
 * with core's kernel (`walkStake`), answers a requote and creates nothing when the cost is above the cap the user
 * confirmed, and otherwise exercises `Desk_IssueQuote` on a shard leased from the pool: a firm `Quote` for this seat,
 * alive 20 s, the venue's stake locked inside it. The accept is the user's own (`Quote_Accept`), never ops'.
 *
 * The contract is the web's (`@agari/markets/server` `OpsQuoteRequest`, `quoteReplyWire`):
 *   request  `{ marketId, side, stakeBase, displayedMaxCostBase, party, leaseId }`, bigints as strings, `marketId` the
 *            app's id (`@agari/core` `marketIdFromDaml`), `party` taken by the web from the lease only
 *   reply    `{ kind: "quote", quoteCid, quote, validUntilMs }` · `{ kind: "requote", quote }` · `{ kind: "refused", diagnosis }`
 */
import { randomUUID } from "node:crypto";
import { TEMPLATE_IDS } from "@agari/daml";
import { diagnosis, isMarketId, type Diagnosis, type DiagnosisKind, type Quote } from "@agari/core/types";
import { bpsToOddsCents, oneCent } from "@agari/core/units";
import { cmd, failureText, isIndefinite, quoteCommandId, refusalId, templateSuffix, walkStake, type RoleSession, type Side, type WalkedQuote } from "@agari/markets/ops/canton";
import { CASH_DECIMALS } from "@agari/markets/server";
import type { LadderBoard, LadderEntry } from "../market-maker/seat/ladder-board";
import type { PricerSettings } from "../market-maker/seat/pricer";
import { emitVenueEvent } from "../venue/events";
import { PoolBusyError, type ShardPool } from "./pool";
import { submitWithShards } from "./pooled-submit";

export interface IssuerDeps {
  venue: RoleSession;
  deskCid: () => Promise<string>;
  board: LadderBoard;
  pool: ShardPool;
  settings: PricerSettings;
  /** Parties that are never a seat (the infrastructure roles): a quote to one is refused. */
  infrastructure: ReadonlySet<string>;
  log: (why: string) => void;
}

export interface QuoteRequest {
  marketId: string;
  side: "up" | "down";
  stakeBase: bigint;
  displayedMaxCostBase: bigint;
  party: string;
  leaseId: string;
}

/** Bodies may carry bigints: the HTTP layer writes them as decimal strings (`jsonText`). */
type Answer = { status: number; body: unknown };

const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;
const LEASE_ID = /^[A-Za-z0-9_\-]{1,64}$/;
const UINT = /^\d{1,19}$/;

export function parseQuoteRequest(body: unknown): QuoteRequest | string {
  if (typeof body !== "object" || body === null) return "body must be an object";
  const b = body as Record<string, unknown>;
  if (typeof b.party !== "string" || !PARTY_ID.test(b.party)) return "party must be a party id";
  if (typeof b.leaseId !== "string" || !LEASE_ID.test(b.leaseId)) return "leaseId must be 1–64 of [A-Za-z0-9_-]";
  if (typeof b.marketId !== "string" || !isMarketId(b.marketId)) return "marketId must be the app's base58 market id";
  if (b.side !== "up" && b.side !== "down") return "side must be up or down";
  if (typeof b.stakeBase !== "string" || !UINT.test(b.stakeBase)) return "stakeBase must be a decimal integer string";
  if (typeof b.displayedMaxCostBase !== "string" || !UINT.test(b.displayedMaxCostBase)) return "displayedMaxCostBase must be a decimal integer string";
  return { marketId: b.marketId, side: b.side, stakeBase: BigInt(b.stakeBase), displayedMaxCostBase: BigInt(b.displayedMaxCostBase), party: b.party, leaseId: b.leaseId };
}

const refused = (kind: DiagnosisKind, technical: string): Answer => ({ status: 200, body: { kind: "refused", diagnosis: diagnosis(kind, technical) satisfies Diagnosis } });

/** The walked quote in the app's `Quote` shape: a firm quote, so expected and max cost are the same number. */
export function quoteOf(req: QuoteRequest, w: WalkedQuote, cashUnit: bigint, nowMs: number): Quote {
  const contractsRaw = w.lots * 1000n * cashUnit;
  const yesTicks = req.side === "up" ? w.priceTicks : 1000 - w.priceTicks;
  const avgPriceBps = w.priceTicks * 10;
  const stakePart = w.costBase - w.fee;
  return {
    side: req.side, stakeBase: req.stakeBase, contractsRaw, expectedCostBase: w.costBase, maxCostBase: w.costBase,
    limitPriceRaw: (BigInt(yesTicks) * 10n ** BigInt(CASH_DECIMALS)) / 1000n, avgPriceBps, oddsCents: bpsToOddsCents(avgPriceBps),
    payoutIfRightBase: contractsRaw, fillableStakeBase: w.costBase, partial: req.stakeBase - w.costBase > oneCent(CASH_DECIMALS),
    feeBps: stakePart > 0n ? Number((w.fee * 10_000n) / stakePart) : 0, decimals: CASH_DECIMALS, quotedAtMs: nowMs,
  };
}

/** Takes `lots` off the front of a ladder side in place, so the next request before the pricer's pass sees less depth. */
function consume(entry: LadderEntry, side: "up" | "down", lots: bigint): void {
  const levels = side === "up" ? entry.up : entry.down;
  let left = lots;
  while (left > 0n && levels.length > 0) {
    const [ticks, have] = levels[0]!;
    if (have > left) {
      levels[0] = [ticks, have - left];
      left = 0n;
    } else {
      levels.shift();
      left -= have;
    }
  }
}

export const latencies: number[] = [];

export async function issueQuote(d: IssuerDeps, req: QuoteRequest): Promise<Answer> {
  if (d.infrastructure.has(req.party)) return refused("unknown", "an infrastructure party is not a seat");
  const entry = d.board.get({ marketId: req.marketId });
  if (!entry || entry.state !== "quoting") return refused("market-not-trading", "the venue is not quoting this Window (no open print yet, or its quoting time is over)");
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const validUntilSec = Math.min(nowSec + d.settings.quoteLifeSec, entry.lockAtSec);
  if (nowSec > entry.quotingUntilSec || validUntilSec - nowSec < d.settings.minQuoteLifeSec) return refused("market-not-trading", "the Window stopped taking quotes");
  const levels = req.side === "up" ? entry.up : entry.down;
  const walked = walkStake(levels, req.stakeBase, entry.cashUnit, entry.feeRateBps, { maxLots: d.settings.maxQuoteLots });
  if (!walked) return levels.length === 0 ? refused("no-liquidity", "the venue ladder has no depth on this side") : refused("below-min-quantity", "the stake does not buy one lot");
  const quote = quoteOf(req, walked, entry.cashUnit, nowMs);
  if (walked.costBase > req.displayedMaxCostBase) return { status: 200, body: { kind: "requote", quote } };

  const started = Date.now();
  let lease;
  try {
    lease = await d.pool.lease(walked.venueStakeBase, `quote ${entry.damlMarketId}`);
  } catch (error) {
    if (error instanceof PoolBusyError) return refused("rpc-down", "every venue shard is in use; try again in a moment");
    throw error;
  }
  const requestId = randomUUID();
  const side: Side = req.side === "up" ? "SideUp" : "SideDown";
  try {
    const out = await submitWithShards(d.pool, d.venue, [lease], {
      commandId: quoteCommandId(requestId),
      commands: [cmd.issueQuote(await d.deskCid(), { shardCid: lease.cid, user: req.party, termsCid: entry.termsCid, pairId: requestId, side, priceTicks: walked.priceTicks, lots: walked.lots, fee: walked.fee, validUntilSec })],
    });
    if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
    const q = out.created.find((e) => templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.Quote));
    if (!q) return refused("unknown", "the issue landed without a quote");
    consume(entry, req.side, walked.lots);
    const issueMs = Date.now() - started;
    latencies.push(issueMs);
    if (latencies.length > 10_000) latencies.splice(0, latencies.length - 10_000);
    emitVenueEvent({ kind: "quoted", marketId: entry.damlMarketId, quoteCid: q.contractId, side: req.side, lots: walked.lots.toString(), priceTicks: walked.priceTicks, issueMs, atMs: Date.now() });
    d.log(`quote ${entry.damlMarketId} ${req.side} ${walked.lots} @ ${walked.priceTicks} (fee ${walked.fee}) to ${req.party.split("::")[0]} (lease ${req.leaseId}) in ${issueMs} ms`);
    return { status: 200, body: { kind: "quote", quoteCid: q.contractId, quote, validUntilMs: validUntilSec * 1000 } };
  } catch (error) {
    if (isIndefinite(error)) return refused("send-unknown", `the ledger did not answer in time (quote ${requestId}); the shard is held until its outcome is known`);
    d.log(`quote ${entry.damlMarketId} refused: ${failureText(error)}`);
    return refused("contract-revert", refusalId(error) ?? failureText(error).slice(0, 200));
  }
}

/** p50 / p95 of the issue latency so far (ms). */
export function latencySummary(): { n: number; p50: number | null; p95: number | null } {
  if (latencies.length === 0) return { n: 0, p50: null, p95: null };
  const s = [...latencies].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]!;
  return { n: s.length, p50: at(0.5), p95: at(0.95) };
}
