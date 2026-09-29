import { describe, expect, it } from "vitest";
import { disagrees, lowerMedian, missingReason, parseVoidDetail, spreadBps, winnerOf } from "./rule";
import { exchangeOfParty, identifySource, recountResolution, reverify, sha256Hex, type EvidenceItem, type ProofResolution, type SourceInput } from "./reverify";

const T = 1_790_000_040 - (1_790_000_040 % 60);
const CB = "agari-oracle-coinbase-r1::1220aa";
const KR = "agari-oracle-kraken-r1::1220bb";
const BS = "agari-oracle-bitstamp-r1::1220cc";

/** A Coinbase candles body whose candle starting at `boundary − 60` closes at `close`. */
const coinbaseBody = (boundary: number, close: number) => JSON.stringify([[boundary - 60, 1, 2, 1.5, close, 3]]);
const e8 = (n: number) => BigInt(Math.round(n * 100)) * 1_000_000n;

function item(oracle: string, price: number, payload: string): EvidenceItem {
  return { oracle, priceE8: e8(price), payloadHash: sha256Hex(payload), fetchedAtSec: T + 10 };
}

function resolution(over: Partial<ProofResolution> = {}): ProofResolution {
  const open = [item(CB, 100, "o1"), item(KR, 100.01, "o2"), item(BS, 99.99, "o3")];
  const close = [item(CB, 101, "c1"), item(KR, 101.02, "c2"), item(BS, 100.98, "c3")];
  return {
    symbol: "BTC", openBoundarySec: T, closeBoundarySec: T + 60, quorum: 2, maxDeviationBps: 50, tieUp: false,
    openPriceE8: e8(100), closePriceE8: e8(101), openEvidence: open, closeEvidence: close, outcome: "up", voidReason: null, ...over,
  };
}

describe("the integer rule", () => {
  it("takes the lower median, an observed price", () => {
    expect(lowerMedian([3n, 1n, 2n])).toBe(2n);
    expect(lowerMedian([4n, 1n, 3n, 2n])).toBe(2n);
    expect(lowerMedian([])).toBeNull();
  });

  it("disagrees only strictly past the limit: (max − min) × 10 000 > bps × median", () => {
    // spread 50 on a median of 10 000 is exactly 50 bps: not over.
    expect(disagrees(50, [10_000n, 10_050n, 10_020n])).toBe(false);
    expect(disagrees(50, [10_000n, 10_051n, 10_020n])).toBe(true);
    expect(spreadBps([10_000n, 10_051n, 10_020n])).toBe(50n);
  });

  it("names a missing slot the ledger's way, and breaks ties by tieUp", () => {
    expect(missingReason(2, 0, "close")).toEqual({ kind: "MissingPrint", slot: "close" });
    expect(missingReason(2, 1, "open")).toEqual({ kind: "QuorumNotMet", slot: "open" });
    expect(missingReason(2, 3, "open")).toEqual({ kind: "ResolverAbsent", slot: "open" });
    expect(winnerOf(5n, 5n, true)).toBe("up");
    expect(winnerOf(5n, 5n, false)).toBe("down");
    expect(parseVoidDetail("SourceDisagreement:CloseSlot")).toEqual({ kind: "SourceDisagreement", slot: "close" });
    expect(parseVoidDetail(null)).toBeNull();
  });
});

describe("recount", () => {
  it("agrees with a resolved Window", () => {
    const report = reverify(resolution(), []);
    expect(report.verdict).toBe("pass");
    expect(report.checks.map((c) => c.id)).toEqual(["median:open", "spread:open", "median:close", "spread:close", "outcome"]);
  });

  it("fails when the ledger's median or outcome is not what the evidence gives", () => {
    const wrongMedian = reverify(resolution({ closePriceE8: e8(101.02) }), []);
    expect(wrongMedian.checks.find((c) => c.id === "median:close")?.status).toBe("fail");
    const wrongSide = reverify(resolution({ outcome: "down" }), []);
    expect(wrongSide.verdict).toBe("fail");
    expect(wrongSide.checks.find((c) => c.id === "outcome")?.found).toBe("resolved up");
  });

  it("confirms a source-disagreement void and a quorum void", () => {
    const far = [item(CB, 101, "c1"), item(KR, 103, "c2"), item(BS, 101.5, "c3")];
    const sd = resolution({ closeEvidence: far, closePriceE8: null, outcome: null, voidReason: { kind: "SourceDisagreement", slot: "close" } });
    expect(reverify(sd, []).verdict).toBe("pass");
    const one = resolution({ closeEvidence: [item(CB, 101, "c1")], closePriceE8: null, outcome: null, voidReason: { kind: "QuorumNotMet", slot: "close" } });
    expect(recountResolution(one).void).toEqual({ kind: "QuorumNotMet", slot: "close" });
    expect(reverify(one, []).verdict).toBe("pass");
    // A ledger claiming disagreement over prices that agree is caught.
    const lie = resolution({ closePriceE8: null, outcome: null, voidReason: { kind: "SourceDisagreement", slot: "close" } });
    expect(reverify(lie, []).verdict).toBe("fail");
  });
});

describe("archive and exchange", () => {
  const boundary = T + 60;
  const payload = coinbaseBody(boundary, 101);
  const evidence = item(CB, 101, payload);

  it("names the exchange from the archive whose hash matches, else from the party hint", () => {
    expect(exchangeOfParty(KR)).toBe("kraken");
    expect(exchangeOfParty("someone::1220")).toBeNull();
    expect(identifySource(evidence, [{ exchange: "kraken", payload: "x" }, { exchange: "coinbase", payload }])).toEqual({ exchange: "coinbase", archive: payload, hashMatches: true });
    expect(identifySource(evidence, [{ exchange: "coinbase", payload: "tampered" }])).toEqual({ exchange: "coinbase", archive: "tampered", hashMatches: false });
  });

  function run(input: Omit<SourceInput, "slot" | "item">) {
    const r = resolution({ closeEvidence: [evidence, item(KR, 101.02, "c2"), item(BS, 100.98, "c3")] });
    return reverify(r, [{ slot: "close", item: evidence, ...input }]).checks.filter((c) => c.oracle === CB);
  }
  const status = (checks: ReturnType<typeof run>) => Object.fromEntries(checks.map((c) => [c.kind, c.status]));

  it("passes when the hash, the archived close and the live candle all match", () => {
    expect(status(run({ source: { exchange: "coinbase", archive: payload, hashMatches: true }, refetch: { kind: "ok", payload } }))).toEqual({ hash: "pass", archive: "pass", exchange: "pass" });
  });

  it("fails a tampered archive and a live candle with another close", () => {
    const checks = run({ source: { exchange: "coinbase", archive: "tampered", hashMatches: false }, refetch: { kind: "ok", payload: coinbaseBody(boundary, 101.5) } });
    expect(status(checks)).toEqual({ hash: "fail", archive: "unavailable", exchange: "fail" });
  });

  it("says can't check, never fail, when the exchange no longer serves the candle or cannot be reached", () => {
    const gone = run({ source: { exchange: "coinbase", archive: payload, hashMatches: true }, refetch: { kind: "ok", payload: "[]" } });
    expect(gone.find((c) => c.kind === "exchange")).toMatchObject({ status: "unavailable", note: "the exchange no longer serves this candle" });
    const down = run({ source: { exchange: "coinbase", archive: null, hashMatches: false }, refetch: { kind: "unavailable", why: "HTTP 429" } });
    expect(status(down)).toEqual({ hash: "unavailable", archive: "unavailable", exchange: "unavailable" });
    expect(reverify(resolution(), [{ slot: "close", item: evidence, source: { exchange: null, archive: null, hashMatches: false }, refetch: null }]).verdict).toBe("pass");
  });
});
