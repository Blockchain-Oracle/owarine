import { reverify, sha256Hex, type SourceInput } from "@owarine/core/proof";
import type { ReverifyResult } from "@/features/proof";
import { buildProofView, toProofResolution, type CantonProofView, type PrintRowWire, type WindowRowWire } from "@/features/proof/canton-proof";
import { party, updateId, VENUE, RESOLVER } from "../canton-ids";

/**
 * `/dev/proof`: a BTC 1m Window decided two ways over canned projection rows, and re-verify reports in every state
 * (all green, a tampered archive, an exchange that no longer serves the candle). Prices, times and ids are fixture
 * values; the views and reports are built by the same code the live page runs.
 */
const T = Math.floor(Date.UTC(2026, 8, 29, 14, 35, 0) / 1000);
const CB = party("owarine-oracle-coinbase-r1", "0a1b2c3d4e5f6071");
const KR = party("owarine-oracle-kraken-r1", "1b2c3d4e5f607182");
const BS = party("owarine-oracle-bitstamp-r1", "2c3d4e5f60718293");
const ORACLES = [CB, KR, BS];

const coinbaseBody = (boundary: number, close: string) => `[[${boundary - 60},1,2,1.5,${close},3]]`;
const ev = (oracle: string, price: string, payload: string, fetchedAtSec: number) => ({ oracle, priceE8: price, fetchedAtSec, payloadHash: sha256Hex(payload), quoteCid: "00" });

const OPEN = [ev(CB, "11234567000000", coinbaseBody(T, "112345.67"), T + 10), ev(KR, "11234612000000", "kraken-open", T + 10), ev(BS, "11234400000000", "bitstamp-open", T + 11)];
const CLOSE_OK = [ev(CB, "11241230000000", coinbaseBody(T + 60, "112412.3"), T + 70), ev(KR, "11241100000000", "kraken-close", T + 70), ev(BS, "11241450000000", "bitstamp-close", T + 71)];
const CLOSE_FAR = [CLOSE_OK[0]!, ev(KR, "11298000000000", "kraken-close-far", T + 70), CLOSE_OK[2]!];

const base: WindowRowWire = {
  market: "7e57".repeat(11), symbol: "BTC", state: "resolved", winner: 0, void_detail: null, tie_up: false, quorum: 2, oracles: ORACLES,
  max_deviation_bps: 50, trading_start_sec: String(T), expiry_sec: String(T + 60), open_price_e8: "11234567000000", open_evidence: OPEN,
  close_price_e8: "11241230000000", close_evidence: CLOSE_OK, resolver: RESOLVER, resolution_cid: "00d44d", resolved_update_id: updateId("d44d"),
  resolved_at_ms: String((T + 72) * 1000), resolved_ts_sec: String(T + 72), resolution_venue: VENUE, resolution_resolver: RESOLVER,
  resolution_open_evidence: null, resolution_close_evidence: null,
};

const printsOf = (rows: ReturnType<typeof ev>[], boundary: number): PrintRowWire[] =>
  rows.map((e, i) => ({ oracle: e.oracle, boundary_sec: String(boundary), price_e8: e.priceE8, fetched_at_sec: String(e.fetchedAtSec), payload_hash: e.payloadHash, update_id: updateId(`a${i}${boundary % 10}`) }));

const RESOLVED_ROW = base;
const VOIDED_ROW: WindowRowWire = { ...base, state: "voided", winner: 2, void_detail: "SourceDisagreement:CloseSlot", close_price_e8: null, close_evidence: CLOSE_FAR };

export const RESOLVED_VIEW: CantonProofView = buildProofView(RESOLVED_ROW, [...printsOf(OPEN, T), ...printsOf(CLOSE_OK, T + 60)]);
export const VOIDED_VIEW: CantonProofView = buildProofView(VOIDED_ROW, [...printsOf(OPEN, T), ...printsOf(CLOSE_FAR, T + 60)]);

function report(row: WindowRowWire, mode: "green" | "tampered" | "gone"): ReverifyResult {
  const r = toProofResolution(row)!;
  const cbClose = r.closeEvidence[0]!;
  const payload = coinbaseBody(T + 60, "112412.3");
  const source: SourceInput = {
    slot: "close",
    item: cbClose,
    source: mode === "tampered" ? { exchange: "coinbase", archive: "tampered", hashMatches: false } : { exchange: "coinbase", archive: payload, hashMatches: true },
    refetch: mode === "gone" ? { kind: "ok", payload: "[]" } : { kind: "ok", payload },
  };
  const kraken: SourceInput = { slot: "close", item: r.closeEvidence[1]!, source: { exchange: "kraken", archive: null, hashMatches: false }, refetch: { kind: "unavailable", why: "the exchange answered HTTP 429" } };
  return { report: reverify(r, mode === "green" ? [source] : [source, kraken]), atMs: (T + 600) * 1000 };
}

export const REPORT_GREEN = report(RESOLVED_ROW, "green");
export const REPORT_TAMPERED = report(RESOLVED_ROW, "tampered");
export const REPORT_GONE = report(VOIDED_ROW, "gone");
