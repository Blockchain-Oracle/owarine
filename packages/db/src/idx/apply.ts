/**
 * Facts → rows, inside the caller's DB transaction (`write.ts` owns it and advances the cursor in it). Every write is
 * idempotent on its own key, so a replayed update changes nothing; `write.ts` also refuses an update at or below the
 * cursor, so the guard is double.
 *
 * How each ledger event lands (the decode in services/ops/src/actors/projector/decode.ts produces the facts):
 *   Series created                  → idx_series upsert (the roller recreates it every window)
 *   MarketTerms created             → idx_markets insert (state open)
 *   WindowState created / consumed  → window_state_cid set / cleared
 *   OpenPrint created / consumed    → open print columns / open_print_cid cleared
 *   Resolution created              → state resolved (winner 0/1) or voided (winner 2, void_reason 1|2), close print
 *   PriceQuote created / retired    → idx_prints row per contract, the resolution's one per (oracle, symbol, boundary) `chosen` / retired
 *   Quote, BuyQuote created         → idx_quotes 'issued'; quotes_issued + 1
 *   Quote(_)Accept                  → 'accepted'; Expire / Withdraw → row deleted, quotes_expired / _withdrawn + 1
 *   Leg created                     → idx_legs; a user leg from Quote_Accept also writes the fill (MINT), the position,
 *                                     the candle and the market's volume (a resting call's Rest_Fill does too, marked `resting`)
 *   RestingCall created / consumed  → idx_resting (0.5.1, `apply-rest.ts`): a row per call, kept when it ends
 *   BuyQuote_Accept                 → a SELL fill (DIRECT) for the sold lots; the archived user leg closes as 'sold' and a
 *                                     partial sale's remainder opens as a new user leg (origin 'buyback')
 *   Leg exits                       → Leg_Settle 'settled' (by crank), Leg_Claim 'claimed', Leg_RefundStale
 *                                     'refunded_stale', Leg_CloseOut 'closed_out', Leg_Merge / archive-in-merge 'merged';
 *                                     result won / lost / void from the Window's Resolution
 *   Publication created / archived  → idx_publications insert / delete (0.4.0: with its ticket `product`)
 *   EventTerms created              → the Window's event columns (question, committee); never archived
 *   EventState created / consumed   → event_state_cid set / cleared
 *   EventAttestation created / retired → idx_event_attestations insert / retired
 *   EventVerdict created            → event_verdict_cid, event_answer (NULL = void) and the attestations counted
 *   SettlementReceipt created / dismissed → idx_receipts insert / dismissed (pair legs and tickets alike)
 */
import type postgres from "postgres";
import { LANE_BASES } from "@owarine/core/types";
import { parseLaneKey } from "@owarine/core/market";
import { restCallRow, restClosedRow } from "./apply-rest";
import { dependentClosed, dependentRows } from "./apply-dependents";
import { marketIdOfKey, seriesIdOfKey } from "./ids";
import type { IdxEvidence, IdxFact, IdxUpdate } from "./types";

type Tx = postgres.TransactionSql;
type Fact<K extends IdxFact["kind"]> = Extract<IdxFact, { kind: K }>;

const PAIR_TICKS = 1000n;

interface Ctx {
  tx: Tx;
  u: IdxUpdate;
  tsSec: number;
  venue: string;
}

async function marketOf(c: Ctx, termsCid: string, marketKey: string | null): Promise<string | null> {
  if (marketKey) return marketIdOfKey(marketKey);
  const [row] = await c.tx<{ market: string }[]>`SELECT market FROM idx_markets WHERE terms_cid = ${termsCid}`;
  return row?.market ?? null;
}

/** The user's side price from the ledger's own figures: backingShare = lots × ticks × cashUnit. */
function sideTicksOf(backingShare: string, lots: string, cashUnit: string): number {
  const unit = BigInt(lots) * BigInt(cashUnit);
  return unit === 0n ? 0 : Number(BigInt(backingShare) / unit);
}

/**
 * The lane a Series key names (C6): its registry ticker and basis. A token lane's ledger symbol is the asset its prints
 * price (`TSLAx`), so the app's row carries the ticker (`TSLA`) and basis 2, as the reference's Series did; a crypto
 * lane is 24/7 (basis 2). A key outside the registry keeps its ledger symbol, basis Regular.
 */
function laneRow(seriesKey: string, symbol: string): { symbol: string; basis: number } {
  const lane = parseLaneKey(seriesKey);
  return lane ? { symbol: lane.symbol, basis: LANE_BASES.indexOf(lane.basis) } : { symbol, basis: 0 };
}

async function series(c: Ctx, f: Fact<"series">): Promise<void> {
  const row = {
    series: seriesIdOfKey(f.seriesKey), series_key: f.seriesKey, ...laneRow(f.seriesKey, f.symbol), cadence_sec: f.cadenceSec, cash_unit: f.cashUnit,
    contract_id: f.contractId, next_index: f.nextIndex, anchor_sec: f.anchorSec, lock_lead_sec: f.lockLeadSec, settle_grace_sec: f.settleGraceSec,
    quorum: f.quorum, oracles: c.tx.json(f.oracles), max_deviation_bps: f.maxDeviationBps, resolver: f.resolver,
    policy_versions: c.tx.json(f.policyVersions as unknown as postgres.JSONValue), updated_offset: c.u.offset,
  };
  await c.tx`INSERT INTO idx_series ${c.tx(row)}
    ON CONFLICT (series) DO UPDATE SET contract_id = EXCLUDED.contract_id, next_index = EXCLUDED.next_index, quorum = EXCLUDED.quorum,
      oracles = EXCLUDED.oracles, max_deviation_bps = EXCLUDED.max_deviation_bps, policy_versions = EXCLUDED.policy_versions,
      cash_unit = EXCLUDED.cash_unit, updated_offset = EXCLUDED.updated_offset
    WHERE idx_series.updated_offset <= EXCLUDED.updated_offset`;
}

async function windowOpened(c: Ctx, f: Fact<"window-opened">): Promise<void> {
  const row = {
    market: marketIdOfKey(f.marketKey), market_key: f.marketKey, terms_cid: f.termsCid, series: seriesIdOfKey(f.seriesKey), series_key: f.seriesKey,
    ...laneRow(f.seriesKey, f.symbol), cadence_sec: f.expirySec - f.tradingStartSec, market_index: f.index, cash_unit: f.cashUnit,
    trading_start_sec: f.tradingStartSec, lock_at_sec: f.lockAtSec, expiry_sec: f.expirySec, open_deadline_sec: f.openDeadlineSec,
    close_deadline_sec: f.closeDeadlineSec, refund_after_sec: f.refundAfterSec, policy_version: f.policyVersion, print_source: f.printSource,
    min_delay_sec: f.minDelaySec, bar_len_sec: f.barLenSec, tie_up: f.tieUp, quorum: f.quorum, oracles: c.tx.json(f.oracles),
    max_deviation_bps: f.maxDeviationBps, resolver: f.resolver, opened_update_id: c.u.updateId, opened_offset: c.u.offset, opened_ts_sec: c.tsSec,
  };
  await c.tx`INSERT INTO idx_markets ${c.tx(row)} ON CONFLICT (market) DO NOTHING`;
}

async function resolution(c: Ctx, f: Fact<"resolution">): Promise<void> {
  const voided = f.outcome === null;
  const closeSigners = f.closePriceE8 === null ? null : f.closeEvidence.length;
  await c.tx`
    UPDATE idx_markets SET state = ${voided ? "voided" : "resolved"}, winner = ${voided ? 2 : f.outcome},
      void_reason = ${voided ? (f.voidDetail?.startsWith("SourceDisagreement") ? 2 : 1) : null}, void_detail = ${f.voidDetail},
      open_price_e8 = COALESCE(open_price_e8, ${f.openPriceE8}::numeric), close_price_e8 = ${f.closePriceE8}::numeric, close_signers = ${closeSigners},
      close_evidence = ${c.tx.json(f.closeEvidence as unknown as postgres.JSONValue)}, signers = ${f.signers}, single_source = ${f.signers < 2},
      resolution_cid = ${f.contractId}, resolved_ts_sec = ${c.tsSec}, resolved_update_id = ${c.u.updateId}, resolved_at_ms = ${f.createdAtMs},
      resolution_blob = ${f.createdEventBlob}, resolution_template_id = ${f.templateId}, synchronizer_id = ${f.synchronizerId}
    WHERE terms_cid = ${f.termsCid} AND resolution_cid IS NULL`;
  await citeEvidence(c, [...f.openEvidence, ...f.closeEvidence]);
}

async function price(c: Ctx, f: Fact<"price">): Promise<void> {
  const row = {
    oracle: f.oracle, symbol: f.symbol, boundary_sec: f.boundarySec, contract_id: f.contractId, price_e8: f.priceE8, bar_start_sec: f.barStartSec,
    bar_len_sec: f.barLenSec, fetched_at_sec: f.fetchedAtSec, payload_hash: f.payloadHash, policy_version: f.policyVersion,
    recorded_ts_sec: c.tsSec, update_id: c.u.updateId, chosen: false,
  };
  const inserted = await c.tx`INSERT INTO idx_prints ${c.tx(row)} ON CONFLICT (contract_id) DO NOTHING RETURNING 1`;
  if (inserted.length > 0) await rechoose(c, [f.contractId]);
}

/**
 * C6e (K-070): re-flags the (oracle, symbol, boundary) keys of these quotes. Every post stays a row; the `chosen` one is
 * the quote the ledger cited as evidence (an OpenPrint or Resolution), else the resolver's own rule (`evidenceFor`, the
 * Daml's `collectEvidence`): the earliest fetch, then the lowest price, then the contract id so a replay picks the same.
 */
async function rechoose(c: Ctx, contractIds: readonly string[]): Promise<void> {
  await c.tx`
    WITH keys AS (SELECT DISTINCT oracle, symbol, boundary_sec FROM idx_prints WHERE contract_id = ANY(${contractIds as string[]}::text[])),
    ranked AS (
      SELECT p.contract_id,
        row_number() OVER (PARTITION BY p.oracle, p.symbol, p.boundary_sec ORDER BY p.evidence DESC, p.fetched_at_sec, p.price_e8, p.contract_id) AS rn,
        count(*) OVER (PARTITION BY p.oracle, p.symbol, p.boundary_sec) AS n
      FROM idx_prints p JOIN keys k USING (oracle, symbol, boundary_sec))
    UPDATE idx_prints p SET chosen = (r.rn = 1), duplicates = CASE WHEN r.rn = 1 THEN r.n - 1 ELSE 0 END
    FROM ranked r WHERE p.contract_id = r.contract_id`;
}

/** The quotes an OpenPrint or Resolution counted: flagged as evidence, and their keys re-chosen around them. */
async function citeEvidence(c: Ctx, evidence: readonly IdxEvidence[]): Promise<void> {
  const cids = evidence.map((e) => e.quoteCid);
  if (cids.length === 0) return;
  await c.tx`UPDATE idx_prints SET evidence = true WHERE contract_id = ANY(${cids}::text[])`;
  await rechoose(c, cids);
}

async function quote(c: Ctx, f: Fact<"quote">): Promise<void> {
  const market = await marketOf(c, f.termsCid, f.marketKey);
  if (!market) return;
  const row = {
    quote_cid: f.contractId, kind: f.quoteKind, market, terms_cid: f.termsCid, user_party: f.user, pair_id: f.pairId, side: f.side,
    price_ticks: f.priceTicks, lots: f.lots, cash_unit: f.cashUnit, fee: f.fee, leg_cid: f.legCid, valid_until_sec: f.validUntilSec,
    issued_update_id: c.u.updateId, issued_offset: c.u.offset, issued_ts_sec: c.tsSec, status: "issued",
  };
  const inserted = await c.tx`INSERT INTO idx_quotes ${c.tx(row)} ON CONFLICT (quote_cid) DO NOTHING RETURNING 1`;
  if (inserted.length > 0) await c.tx`UPDATE idx_markets SET quotes_issued = quotes_issued + 1 WHERE market = ${market}`;
}

async function quoteClosed(c: Ctx, f: Fact<"quote-closed">): Promise<void> {
  if (f.how === "accepted") {
    const rows = await c.tx<{ market: string }[]>`
      UPDATE idx_quotes SET status = 'accepted', closed_update_id = ${c.u.updateId}, closed_ts_sec = ${c.tsSec}
      WHERE quote_cid = ${f.contractId} AND status = 'issued' RETURNING market`;
    if (rows[0]) await c.tx`UPDATE idx_markets SET quotes_accepted = quotes_accepted + 1 WHERE market = ${rows[0].market}`;
    return;
  }
  // The request is gone from the ledger; its row goes too (privacy-thesis.md §4). Only the count survives.
  const rows = await c.tx<{ market: string }[]>`DELETE FROM idx_quotes WHERE quote_cid = ${f.contractId} AND status = 'issued' RETURNING market`;
  if (!rows[0]) return;
  if (f.how === "expired") await c.tx`UPDATE idx_markets SET quotes_expired = quotes_expired + 1 WHERE market = ${rows[0].market}`;
  else await c.tx`UPDATE idx_markets SET quotes_withdrawn = quotes_withdrawn + 1 WHERE market = ${rows[0].market}`;
}

interface Trade {
  market: string;
  termsCid: string;
  quoteCid: string;
  legCid: string;
  pairId: string;
  owner: string;
  side: 0 | 1;
  buy: boolean;
  sideTicks: number;
  lots: string;
  fee: string;
  cashUnit: string;
  nodeId: number;
  /** 0.5.1: filled from a resting call (the seat's activity reads it as such). */
  resting?: boolean;
}

/** One fill: the tape row, the owner's position, the market's volume and the minute candle. */
async function trade(c: Ctx, t: Trade): Promise<void> {
  const yesTicks = t.side === 0 ? t.sideTicks : Number(PAIR_TICKS) - t.sideTicks;
  const kind = t.buy ? (t.side === 0 ? 0 : 2) : t.side === 0 ? 1 : 3;
  const path = t.buy ? 2 : t.side;
  const fill = {
    update_id: c.u.updateId, node_id: t.nodeId, ledger_offset: c.u.offset, market: t.market, terms_cid: t.termsCid, quote_cid: t.quoteCid,
    leg_cid: t.legCid, pair_id: t.pairId, owner_party: t.owner, venue_party: c.venue, side: t.side, kind, path, price_ticks: yesTicks,
    side_ticks: t.sideTicks, lots: t.lots, fee: t.fee, cash_unit: t.cashUnit, ts_sec: c.tsSec, resting: t.resting === true,
  };
  const inserted = await c.tx`INSERT INTO idx_fills ${c.tx(fill)} ON CONFLICT (update_id, node_id) DO NOTHING RETURNING 1`;
  if (inserted.length === 0) return;
  const lots = BigInt(t.lots);
  const ticklots = (lots * BigInt(t.sideTicks)).toString();
  const up = t.side === 0;
  await c.tx`
    INSERT INTO idx_positions (market, owner_party, fills, first_ts_sec, last_ts_sec, entry_update_id, last_update_id)
    VALUES (${t.market}, ${t.owner}, 0, ${c.tsSec}, ${c.tsSec}, ${c.u.updateId}, ${c.u.updateId})
    ON CONFLICT (market, owner_party) DO NOTHING`;
  await c.tx`
    UPDATE idx_positions SET fills = fills + 1, last_ts_sec = ${c.tsSec}, last_update_id = ${c.u.updateId},
      bought_yes_lots = bought_yes_lots + ${t.buy && up ? t.lots : "0"}::numeric, bought_no_lots = bought_no_lots + ${t.buy && !up ? t.lots : "0"}::numeric,
      sold_yes_lots = sold_yes_lots + ${!t.buy && up ? t.lots : "0"}::numeric, sold_no_lots = sold_no_lots + ${!t.buy && !up ? t.lots : "0"}::numeric,
      paid_ticklots = paid_ticklots + ${t.buy ? ticklots : "0"}::numeric, received_ticklots = received_ticklots + ${t.buy ? "0" : ticklots}::numeric,
      fees_paid_base = fees_paid_base + ${t.fee}::numeric
    WHERE market = ${t.market} AND owner_party = ${t.owner}`;
  await c.tx`
    UPDATE idx_markets SET volume_lots = volume_lots + ${t.lots}::numeric, volume_ticklots = volume_ticklots + ${ticklots}::numeric,
      backing_lots = backing_lots + ${t.buy ? t.lots : "0"}::numeric, trade_count = trade_count + 1, last_price_ticks = ${yesTicks}, last_trade_sec = ${c.tsSec},
      participants = (SELECT count(*) FROM idx_positions WHERE market = ${t.market} AND fills > 0)
    WHERE market = ${t.market}`;
  const bucket = c.tsSec - (c.tsSec % 60);
  await c.tx`
    INSERT INTO idx_candles (market, bucket_sec, open_ticks, high_ticks, low_ticks, close_ticks, volume_lots, trades)
    VALUES (${t.market}, ${bucket}, ${yesTicks}, ${yesTicks}, ${yesTicks}, ${yesTicks}, ${t.lots}::numeric, 1)
    ON CONFLICT (market, bucket_sec) DO UPDATE SET high_ticks = GREATEST(idx_candles.high_ticks, EXCLUDED.high_ticks),
      low_ticks = LEAST(idx_candles.low_ticks, EXCLUDED.low_ticks), close_ticks = EXCLUDED.close_ticks,
      volume_lots = idx_candles.volume_lots + EXCLUDED.volume_lots, trades = idx_candles.trades + 1`;
}

async function leg(c: Ctx, f: Fact<"leg">): Promise<void> {
  const market = marketIdOfKey(f.marketKey);
  const isVenue = f.owner === f.venue;
  const row = {
    leg_cid: f.contractId, market, terms_cid: f.termsCid, owner_party: f.owner, is_venue: isVenue, pair_id: f.pairId, outcome: f.outcome,
    lots: f.lots, cash_unit: f.cashUnit, backing_share: f.backingShare, fee_paid: f.feePaid, refund_after_sec: f.refundAfterSec, origin: f.origin,
    created_update_id: c.u.updateId, created_offset: c.u.offset, created_ts_sec: c.tsSec, beneficiary_ref: f.ref ?? null,
  };
  const inserted = await c.tx`INSERT INTO idx_legs ${c.tx(row)} ON CONFLICT (leg_cid) DO NOTHING RETURNING 1`;
  if (inserted.length === 0 || isVenue) return;
  await c.tx`UPDATE idx_markets SET legs_open = legs_open + 1 WHERE market = ${market}`;
  if (f.origin === "accept" && f.acceptNodeId !== null && f.quoteCid !== null) {
    await c.tx`UPDATE idx_quotes SET leg_cid = ${f.contractId} WHERE quote_cid = ${f.quoteCid} AND kind = 'quote'`;
    const sideTicks = sideTicksOf(f.backingShare, f.lots, f.cashUnit);
    await trade(c, {
      market, termsCid: f.termsCid, quoteCid: f.quoteCid, legCid: f.contractId, pairId: f.pairId, owner: f.owner, side: f.outcome, buy: true,
      sideTicks, lots: f.lots, fee: f.feePaid, cashUnit: f.cashUnit, nodeId: f.acceptNodeId, resting: f.resting === true,
    });
  } else {
    await c.tx`
      INSERT INTO idx_positions (market, owner_party, first_ts_sec, last_ts_sec, entry_update_id, last_update_id)
      VALUES (${market}, ${f.owner}, ${c.tsSec}, ${c.tsSec}, ${c.u.updateId}, ${c.u.updateId}) ON CONFLICT (market, owner_party) DO NOTHING`;
  }
  const up = f.outcome === 0;
  await c.tx`
    UPDATE idx_positions SET open_legs = open_legs + 1, redeemed = false,
      yes_lots = yes_lots + ${up ? f.lots : "0"}::numeric, no_lots = no_lots + ${up ? "0" : f.lots}::numeric
    WHERE market = ${market} AND owner_party = ${f.owner}`;
}

async function sale(c: Ctx, f: Fact<"sale">): Promise<void> {
  const [l] = await c.tx<{ market: string; terms_cid: string; pair_id: string; owner_party: string; outcome: number; lots: string; cash_unit: string }[]>`
    SELECT market, terms_cid, pair_id, owner_party, outcome, lots::text, cash_unit::text FROM idx_legs WHERE leg_cid = ${f.legCid}`;
  if (!l) return;
  await trade(c, {
    market: l.market, termsCid: l.terms_cid, quoteCid: f.buyQuoteCid, legCid: f.legCid, pairId: l.pair_id, owner: l.owner_party,
    side: l.outcome === 0 ? 0 : 1, buy: false, sideTicks: f.priceTicks, lots: f.lots ?? l.lots, fee: "0", cashUnit: l.cash_unit, nodeId: f.nodeId,
  });
}

async function legClosed(c: Ctx, f: Fact<"leg-closed">): Promise<void> {
  const [m] = f.resolutionCid
    ? await c.tx<{ state: string; winner: number | null }[]>`SELECT state, winner FROM idx_markets WHERE resolution_cid = ${f.resolutionCid}`
    : [];
  const [l] = await c.tx<{ market: string; owner_party: string; is_venue: boolean; outcome: number; lots: string }[]>`
    UPDATE idx_legs SET status = ${f.how}, payout_base = ${f.paidBase}::numeric, fee_recognized_base = ${f.feeBase}::numeric,
      result = CASE WHEN ${m?.state ?? null}::text = 'voided' THEN 'void' WHEN ${m?.winner ?? null}::smallint IS NULL THEN NULL
                    WHEN ${m?.winner ?? null}::smallint = outcome THEN 'won' ELSE 'lost' END,
      closed_update_id = ${c.u.updateId}, closed_offset = ${c.u.offset}, closed_ts_sec = ${c.tsSec}
    WHERE leg_cid = ${f.contractId} AND status = 'open'
    RETURNING market, owner_party, is_venue, outcome, lots::text`;
  if (!l) return;
  const counter = { settled: "legs_settled", claimed: "legs_claimed", refunded_stale: "legs_refunded_stale", sold: "legs_sold", closed_out: "legs_closed_out", merged: "legs_merged", archived: null }[f.how];
  await c.tx`
    UPDATE idx_markets SET fees_recognized_base = fees_recognized_base + ${f.feeBase}::numeric
      ${counter ? c.tx`, ${c.tx(counter)} = ${c.tx(counter)} + 1` : c.tx``}
      ${l.is_venue ? c.tx`` : c.tx`, legs_open = legs_open - 1, payouts_base = payouts_base + ${f.paidBase}::numeric`}
    WHERE market = ${l.market}`;
  if (l.is_venue) return;
  const up = l.outcome === 0;
  const paysOut = f.how === "settled" || f.how === "claimed";
  const refunds = f.how === "refunded_stale" || f.how === "closed_out";
  await c.tx`
    UPDATE idx_positions SET open_legs = open_legs - 1, redeemed = (open_legs - 1 = 0),
      yes_lots = yes_lots - ${up ? l.lots : "0"}::numeric, no_lots = no_lots - ${up ? "0" : l.lots}::numeric,
      payout_base = payout_base + ${paysOut ? f.paidBase : "0"}::numeric, refunded_base = refunded_base + ${refunds ? f.paidBase : "0"}::numeric,
      redeemed_by_crank = redeemed_by_crank OR ${f.how === "settled"}, refunded_stale = refunded_stale OR ${f.how === "refunded_stale"},
      closed_out = closed_out OR ${f.how === "closed_out"}, last_ts_sec = ${c.tsSec}, last_update_id = ${c.u.updateId}
    WHERE market = ${l.market} AND owner_party = ${l.owner_party}`;
}

async function publication(c: Ctx, f: Fact<"publication">): Promise<void> {
  const market = marketIdOfKey(f.marketKey);
  const [m] = await c.tx<{ cash_unit: string }[]>`SELECT cash_unit::text FROM idx_markets WHERE market = ${market}`;
  const row = {
    publication_cid: f.contractId, owner_party: f.owner, handle: f.handle, market, market_key: f.marketKey, pair_id: f.pairId, outcome: f.outcome, product: f.product,
    lots: f.lots, backing_share: f.backingShare, price_ticks: m ? sideTicksOf(f.backingShare, f.lots, m.cash_unit) : null,
    created_update_id: c.u.updateId, created_offset: c.u.offset, created_ts_sec: c.tsSec,
  };
  await c.tx`INSERT INTO idx_publications ${c.tx(row)} ON CONFLICT (publication_cid) DO NOTHING`;
}

async function receipt(c: Ctx, f: Fact<"receipt">): Promise<void> {
  const row = {
    receipt_cid: f.contractId, owner_party: f.owner, market: marketIdOfKey(f.marketKey), market_key: f.marketKey, pair_id: f.pairId, outcome: f.outcome,
    resolved: f.resolved, lots: f.lots, cash_unit: f.cashUnit, backing_share: f.backingShare, cost: f.cost, payout: f.payout, fee: f.fee, product: f.product,
    detail: f.detail === null ? null : c.tx.json(f.detail as unknown as postgres.JSONValue), paid_into: f.paidInto ?? null,
    created_update_id: c.u.updateId, created_offset: c.u.offset, created_ts_sec: c.tsSec,
  };
  await c.tx`INSERT INTO idx_receipts ${c.tx(row)} ON CONFLICT (receipt_cid) DO NOTHING`;
}

async function eventVerdict(c: Ctx, f: Fact<"event-verdict">): Promise<void> {
  await c.tx`
    UPDATE idx_markets SET event_verdict_cid = ${f.contractId}, event_answer = ${f.answer},
      event_verdict = ${c.tx.json({ voidDetail: f.voidDetail, attestations: f.attestations } as unknown as postgres.JSONValue)}
    WHERE terms_cid = ${f.termsCid}`;
}

async function applyFact(c: Ctx, f: IdxFact): Promise<void> {
  switch (f.kind) {
    case "series": return series(c, f);
    case "window-opened": return windowOpened(c, f);
    case "window-state":
      if (f.live) await c.tx`UPDATE idx_markets SET window_state_cid = ${f.contractId} WHERE terms_cid = ${f.termsCid}`;
      else await c.tx`UPDATE idx_markets SET window_state_cid = NULL WHERE window_state_cid = ${f.contractId}`;
      return;
    case "open-print":
      await c.tx`
        UPDATE idx_markets SET open_print_cid = ${f.contractId}, open_price_e8 = ${f.openPriceE8}::numeric, open_signers = ${f.signers},
          open_evidence = ${c.tx.json(f.evidence as unknown as postgres.JSONValue)}, open_recorded_ts_sec = ${c.tsSec}, open_update_id = ${c.u.updateId}
        WHERE terms_cid = ${f.termsCid}`;
      await citeEvidence(c, f.evidence);
      return;
    case "open-print-consumed": return void (await c.tx`UPDATE idx_markets SET open_print_cid = NULL WHERE open_print_cid = ${f.contractId}`);
    case "resolution": return resolution(c, f);
    case "price": return price(c, f);
    case "price-retired":
      await c.tx`UPDATE idx_prints SET retired = true WHERE contract_id = ${f.contractId}`;
      return;
    case "quote": return quote(c, f);
    case "quote-closed": return quoteClosed(c, f);
    case "leg": return leg(c, f);
    case "rest-call": {
      const market = await marketOf(c, f.termsCid, f.marketKey);
      return market ? restCallRow(c.tx, c.u, c.tsSec, f, market) : undefined;
    }
    case "rest-closed": return restClosedRow(c.tx, c.u, c.tsSec, f);
    case "dependent": return dependentRows(c.tx, c.u, c.tsSec, f);
    case "dependent-closed": return dependentClosed(c.tx, c.u, c.tsSec, f);
    case "sale": return sale(c, f);
    case "leg-closed": return legClosed(c, f);
    case "publication": return publication(c, f);
    case "publication-archived": return void (await c.tx`DELETE FROM idx_publications WHERE publication_cid = ${f.contractId}`);
    case "event-terms":
      await c.tx`
        UPDATE idx_markets SET event_terms_cid = ${f.contractId}, event_question = ${f.question}, event_attestors = ${c.tx.json(f.attestors)}, event_quorum = ${f.quorum}
        WHERE terms_cid = ${f.termsCid}`;
      return;
    case "event-state":
      if (f.live) await c.tx`UPDATE idx_markets SET event_state_cid = ${f.contractId} WHERE terms_cid = ${f.termsCid}`;
      else await c.tx`UPDATE idx_markets SET event_state_cid = NULL WHERE event_state_cid = ${f.contractId}`;
      return;
    case "event-attestation": {
      const row = {
        contract_id: f.contractId, market_key: f.marketKey, attestor: f.attestor, answer: f.answer, attested_at_sec: f.attestedAtSec, statement_hash: f.statementHash,
        created_update_id: c.u.updateId, created_offset: c.u.offset,
      };
      await c.tx`INSERT INTO idx_event_attestations ${c.tx(row)} ON CONFLICT (contract_id) DO NOTHING`;
      return;
    }
    case "event-attestation-retired":
      await c.tx`UPDATE idx_event_attestations SET retired = true WHERE contract_id = ${f.contractId}`;
      return;
    case "event-verdict": return eventVerdict(c, f);
    case "receipt": return receipt(c, f);
    case "receipt-dismissed":
      await c.tx`UPDATE idx_receipts SET dismissed = true WHERE receipt_cid = ${f.contractId}`;
      return;
  }
}

/** Applies one update's facts in order, inside `tx`. `venue` is the projected party (the counterparty of every leg). */
export async function applyFacts(tx: Tx, u: IdxUpdate, venue: string): Promise<void> {
  const c: Ctx = { tx, u, tsSec: Math.floor(u.effectiveAtMs / 1000), venue };
  for (const f of u.facts) await applyFact(c, f);
}
