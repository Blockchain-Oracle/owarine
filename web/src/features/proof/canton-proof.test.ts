import { reverify, sha256Hex } from "@owarine/core/proof";
import { describe, expect, it } from "vitest";
import { buildProofView, rawEvidence, toProofResolution, type WindowRowWire } from "./canton-proof";
import { priceE8Text } from "./format";

const T = 1_790_000_040 - (1_790_000_040 % 60);
const CB = "owarine-oracle-coinbase-r1::1220aa";
const KR = "owarine-oracle-kraken-r1::1220bb";
const BS = "owarine-oracle-bitstamp-r1::1220cc";
const ev = (oracle: string, price: string, at: number) => ({ oracle, priceE8: price, fetchedAtSec: at, payloadHash: sha256Hex(`${oracle}${at}`), quoteCid: "00" });

const row = (over: Partial<WindowRowWire> = {}): WindowRowWire => ({
  market: "m", symbol: "BTC", state: "resolved", winner: 1, void_detail: null, tie_up: false, quorum: 2, oracles: [CB, KR, BS], max_deviation_bps: 50,
  trading_start_sec: String(T), expiry_sec: String(T + 60), open_price_e8: "10000", open_evidence: [ev(CB, "10000", T + 10), ev(KR, "10001", T + 10)],
  close_price_e8: "9990", close_evidence: [ev(CB, "9990", T + 70), ev(KR, "9991", T + 70)], resolver: "resolver::1220", resolution_cid: "00r",
  resolved_update_id: "u1", resolved_at_ms: String((T + 72) * 1000), resolved_ts_sec: String(T + 72), resolution_venue: "venue::1220",
  resolution_resolver: "resolver::1220", resolution_open_evidence: null, resolution_close_evidence: null, ...over,
});

describe("the proof page's view", () => {
  it("lists every oracle per slot: counted, posted late, or silent", () => {
    const view = buildProofView(row(), [{ oracle: BS, boundary_sec: String(T + 60), price_e8: "9995", fetched_at_sec: String(T + 90), payload_hash: "h", update_id: "u9" }]);
    expect(view.close.prints.map((p) => [p.exchange, p.counted, p.priceE8])).toEqual([["coinbase", true, "9990"], ["kraken", true, "9991"], ["bitstamp", false, "9995"]]);
    expect(view.open.prints[2]).toMatchObject({ exchange: "bitstamp", counted: false, priceE8: null });
    expect(view.close.medianE8).toBe("9990");
    expect(view.signatories).toEqual({ resolver: "resolver::1220", venue: "venue::1220" });
    expect(view.result).toMatchObject({ kind: "resolved", side: "down" });
  });

  it("prefers the Resolution's own evidence, as the ledger sent it", () => {
    const raw = [{ oracle: CB, priceE8: "9990", fetchedAt: new Date((T + 70) * 1000).toISOString(), payloadHash: "h1", quoteCid: "00q" }, { oracle: 5 }];
    expect(rawEvidence(raw)).toEqual([{ oracle: CB, priceE8: "9990", fetchedAtSec: T + 70, payloadHash: "h1", quoteCid: "00q" }]);
    const voided = row({ winner: 2, void_detail: "QuorumNotMet:CloseSlot", close_price_e8: null, close_evidence: null, resolution_close_evidence: raw });
    const r = toProofResolution(voided)!;
    expect(r.voidReason).toEqual({ kind: "QuorumNotMet", slot: "close" });
    expect(r.closeEvidence).toHaveLength(1);
    expect(reverify(r, []).verdict).toBe("pass");
  });

  it("has nothing to re-verify before a Resolution, and writes prices the page's way", () => {
    expect(toProofResolution(row({ resolution_cid: null }))).toBeNull();
    expect(priceE8Text("11234567000000")).toBe("112,345.67");
    expect(priceE8Text(null)).toBe("—");
  });
});
