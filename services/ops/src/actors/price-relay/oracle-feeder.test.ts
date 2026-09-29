import { describe, expect, it, vi } from "vitest";
import type { LedgerClient } from "@agari/ledger";
import { candleUrl, closeFromPayload, decimalToE8, type Fetch } from "../../prices/candles";
import { boundaryFor, feederPass, payloadHash } from "./oracle-feeder";

const T = 1_790_000_040 - (1_790_000_040 % 60);

describe("exchange candles", () => {
  it("reads the close of the candle starting at T − 60 on each exchange, and nothing still forming", () => {
    const coinbase = JSON.stringify([[T, 1, 2, 1.5, 112345.67, 3], [T - 60, 1, 2, 1.5, 112000.1, 3]]);
    expect(closeFromPayload("coinbase", coinbase, T + 60)).toBe("112345.67");
    expect(closeFromPayload("coinbase", coinbase, T + 120)).toBeNull();
    const kraken = (last: number) => JSON.stringify({ error: [], result: { XXBTZUSD: [[T - 60, "1", "2", "1", "111999.9", "0", "0", 1], [T, "1", "2", "1", "112001.2", "0", "0", 1]], last } });
    expect(closeFromPayload("kraken", kraken(T), T + 60)).toBe("112001.2");
    expect(closeFromPayload("kraken", kraken(T - 60), T + 60)).toBeNull();
    const timestamp = String(T);
    const bitstamp = JSON.stringify({ data: { ohlc: [{ timestamp, close: "112003" }], pair: "BTC/USD" } });
    expect(closeFromPayload("bitstamp", bitstamp, T + 60)).toBe("112003");
    expect(candleUrl("kraken", "BTC", T + 60)).toContain("pair=XBTUSD");
  });

  it("converts a decimal close to × 10⁸ exactly", () => {
    expect(decimalToE8("112345.67")).toBe(11_234_567_000_000n);
    expect(decimalToE8("4123")).toBe(412_300_000_000n);
    expect(decimalToE8("0.123456789")).toBe(12_345_678n);
    expect(() => decimalToE8("-1")).toThrow();
  });

  it("posts at T + 10 s: the boundary a pass works on", () => {
    expect(boundaryFor(T + 9)).toBe(T - 60);
    expect(boundaryFor(T + 10)).toBe(T);
    expect(boundaryFor(T + 69)).toBe(T);
  });
});

describe("feeder pass", () => {
  const bodies: Record<string, (b: number) => string> = {
    BTC: (b) => JSON.stringify([[b - 60, 1, 2, 1, 65000.5, 1]]),
    ETH: (b) => JSON.stringify([[b - 60, 1, 2, 1, 2500.25, 1]]),
  };
  const fetchImpl: Fetch = async (url) => {
    const symbol = url.includes("BTC") ? "BTC" : "ETH";
    return { ok: true, status: 200, text: async () => bodies[symbol]!(T) };
  };

  it("posts one command for every symbol under print:<oracle>:<T>, hashing the exact payload, once", async () => {
    const submitAndWaitForTransaction = vi.fn(async () => ({ transaction: { events: [], updateId: "u", offset: 1, effectiveAt: "", synchronizerId: "", recordTime: "" }, submissionId: "s", attempts: 1, recovered: false }));
    const client = { submitAndWaitForTransaction } as unknown as LedgerClient;
    const state = {
      role: "oracle-coinbase" as const, exchange: "coinbase" as const, session: { role: "oracle-coinbase", party: "o::1220ab", client, dryRun: false },
      venue: "v::1220ab", resolver: "r::1220ab", policyVersion: 1, settings: { symbols: ["BTC", "ETH"], retainSec: 7200, fetchImpl, nowSec: () => T + 11 },
      done: new Set<number>(), pending: new Map(), lastRetireMs: Date.now(), counters: { posted: 0, recovered: 0, partial: 0, missed: 0, failed: 0, retired: 0 }, log: () => {},
    };
    const r = await feederPass(state);
    expect(r.why).toMatch(/^posted @\d\d:\d\dZ T\+11s BTC 65000\.5, ETH 2500\.25/);
    expect(submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
    const call = (submitAndWaitForTransaction.mock.calls[0] as unknown as [{ commandId: string; actAs: string[]; commands: Array<{ CreateCommand: { createArguments: Record<string, unknown> } }> }])[0];
    expect(call.commandId).toBe(`print:coinbase:${T}`);
    expect(call.actAs).toEqual(["o::1220ab"]);
    expect(call.commands.map((c) => c.CreateCommand.createArguments.symbol)).toEqual(["BTC", "ETH"]);
    expect(call.commands[0]!.CreateCommand.createArguments).toMatchObject({ priceE8: "6500050000000", payloadHash: payloadHash(bodies.BTC!(T)), barLenSec: "60", policyVersion: "1" });
    // The same boundary is never posted twice by this process.
    await feederPass(state);
    expect(submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
  });
});
