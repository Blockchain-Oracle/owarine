#!/usr/bin/env node
/**
 * How soon after a minute boundary T does each exchange publish the closed 1-minute candle that ends at T?
 *
 * The oracle feeders post the close of the candle ending at each boundary, so this lag sets their `minDelaySec`
 * and how fast the 1-minute demo lane can resolve. For each boundary it asks every exchange at T+2, T+5, T+10,
 * T+20 and T+40 s whether the candle starting at T−60 is there, and prints one JSON line per check.
 *
 * Usage: node scripts/probes/candle-lag.mjs [minutes=60] [symbol=BTC]
 */
const minutes = Number(process.argv[2] ?? 60);
const sym = (process.argv[3] ?? "BTC").toUpperCase();
const OFFSETS_SEC = [2, 5, 10, 20, 40];

const sources = {
  coinbase: async (startSec) => {
    const r = await fetch(`https://api.exchange.coinbase.com/products/${sym}-USD/candles?granularity=60&start=${new Date(startSec * 1000).toISOString()}&end=${new Date((startSec + 60) * 1000).toISOString()}`, { headers: { "user-agent": "candle-lag-probe" } });
    const rows = await r.json();
    const hit = Array.isArray(rows) && rows.find((c) => c[0] === startSec);
    return hit ? String(hit[4]) : null;
  },
  kraken: async (startSec) => {
    const pair = sym === "BTC" ? "XBTUSD" : `${sym}USD`;
    const r = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1&since=${startSec - 120}`);
    const body = await r.json();
    const key = Object.keys(body.result ?? {}).find((k) => k !== "last");
    const rows = key ? body.result[key] : [];
    // Kraken's `last` is the start of the newest committed candle; the row after it is still forming.
    const last = Number(body.result?.last ?? 0);
    const hit = rows.find((c) => c[0] === startSec);
    return hit && last >= startSec ? String(hit[4]) : null;
  },
  bitstamp: async (startSec) => {
    const r = await fetch(`https://www.bitstamp.net/api/v2/ohlc/${sym.toLowerCase()}usd/?step=60&limit=3&end=${startSec + 60}`);
    const body = await r.json();
    const rows = body?.data?.ohlc ?? [];
    const hit = rows.find((c) => Number(c.timestamp) === startSec);
    return hit ? String(hit.close) : null;
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let i = 0; i < minutes; i++) {
  const nowSec = Math.floor(Date.now() / 1000);
  const boundarySec = (Math.floor(nowSec / 60) + 1) * 60;
  const startSec = boundarySec - 60;
  for (const off of OFFSETS_SEC) {
    await sleep(Math.max(0, (boundarySec + off) * 1000 - Date.now()));
    const checks = await Promise.all(
      Object.entries(sources).map(async ([name, fn]) => {
        try {
          return [name, await fn(startSec)];
        } catch (e) {
          return [name, `error: ${e instanceof Error ? e.message : String(e)}`];
        }
      }),
    );
    console.log(JSON.stringify({ boundaryUtc: new Date(boundarySec * 1000).toISOString(), offsetSec: off, symbol: sym, closes: Object.fromEntries(checks) }));
  }
}
