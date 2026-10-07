import { venueFactsWire, marketFactsWire } from "@owarine/markets";
import { describe, expect, it } from "vitest";
import { marketFacts, policySources, seriesFacts, sourceOf, venueFacts, venueIdFromParty } from "./venue-facts";

const VENUE = "owarine-venue-mum6iua9::1220d061948d597f97645e8ad8ac39c57c7b2ba56450f292e74f9009bc1cca48a23b";

describe("/api/venue facts from projection rows", () => {
  it("derives the venue's ids from its party, the same on every host", () => {
    const facts = venueFacts(VENUE);
    expect(facts.config).toBe(venueIdFromParty(VENUE));
    expect(facts.config).not.toBe(facts.collateralMint);
    expect(venueIdFromParty(`${VENUE}x`)).not.toBe(facts.config);
    expect(facts).toMatchObject({ decimals: 6, mode: 0, programSeats: [] });
  });

  it("names each policy version's print source, and nothing it does not know", () => {
    expect(sourceOf("attested:coinbase,kraken,bitstamp 1m candle close")).toBe(4);
    expect(sourceOf("pyth")).toBe(1);
    expect(sourceOf("something else")).toBe(0);
    expect(policySources([{ version: 1, printSource: "attested:coinbase" }])).toEqual([{ primary: 0, check: 0 }, { primary: 4, check: 0 }]);
    expect(policySources("garbage")).toEqual([]);
  });

  it("answers in the wire the read runtime parses", () => {
    const series = seriesFacts({
      series: "JDJZRfApSz6uZzQrQ1h1CBUavbHbgX5mKgyChVBMu5L6", series_key: "BTC-5m", symbol: "BTC", basis: 0, cadence_sec: 300,
      cash_unit: "1000", lot_base: "1000000", tick_base: "1000", policy_versions: [{ version: 1, printSource: "attested:x" }],
    });
    const parsed = venueFactsWire.parse({ venue: venueFacts(VENUE), series: [series] });
    expect(parsed.series[0]).toMatchObject({ lotBase: 1_000_000n, tickBase: 1_000n, cashUnit: 1_000n, minLots: 1n, seatBond: 0n });
  });

  it("maps a Window's row, with the winner's payout only once it resolved", () => {
    const row = {
      market: "GwyZ6uFwjJAfw5qVRmBJcMV8KrquwwEYMSavpjkzXMiQ", series: "JDJZRfApSz6uZzQrQ1h1CBUavbHbgX5mKgyChVBMu5L6", terms_cid: "00ad41",
      market_index: "2", trading_start_sec: "1790656800", lock_at_sec: "1790657070", expiry_sec: "1790657100", backing_lots: "9",
    };
    const resolved = marketFactsWire.parse({ market: marketFacts({ ...row, state: "resolved", winner: 0 }) }).market!;
    expect(resolved.data).toMatchObject({ book: "00ad41", ledger: row.market, state: 1, payoutYes: 10_000_000, payoutNo: 0, expirySec: 1_790_657_100n });
    expect(marketFacts({ ...row, state: "voided", winner: 2 }).data).toMatchObject({ state: 2, payoutYes: 0, payoutNo: 0 });
    expect(marketFacts({ ...row, state: "open", winner: null }).data.state).toBe(0);
  });
});
