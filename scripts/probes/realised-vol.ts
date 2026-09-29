/**
 * The C6 realised-vol re-measure for BTC and ETH (plan "Prices and lanes"): annualised σ of 1-minute log returns from
 * each oracle exchange over the last day and the last week, on the 24/7 calendar year, beside what the equity-hours
 * clock and the 60 % placeholder would have said. Prints one JSON object; `docs/evidence/c6-realised-vol-*.md` records it.
 *
 *   pnpm --filter @agari/scripts exec tsx probes/realised-vol.ts [--days 1,7]
 */
import { CALENDAR_YEAR_SEC, CRYPTO_SYMBOLS, medianSigmaBps, realisedVol } from "@agari/core/market";
import { EXCHANGES } from "../../services/ops/src/prices/candles";
import { fetchCloseHistory } from "../../services/ops/src/prices/candle-history";
import { TRADING_YEAR_SEC } from "../../services/ops/src/actors/market-maker/seat/fair";
import { arg } from "../drive/cli";

const days = arg("--days", "1,7").split(",").map(Number).filter((d) => d > 0);
const nowSec = Math.floor(Date.now() / 60_000) * 60;
const out: Record<string, unknown> = { measuredAt: new Date(nowSec * 1000).toISOString(), bar: "1m close", year: "365 d (24/7)", placeholderBps: 6_000, rows: [] as unknown[] };

for (const symbol of CRYPTO_SYMBOLS) {
  for (const d of days) {
    const fromSec = nowSec - d * 86_400;
    const per: Record<string, unknown> = {};
    const sigmas: (number | null)[] = [];
    for (const ex of EXCHANGES) {
      try {
        const closes = await fetchCloseHistory(ex, symbol, fromSec, nowSec);
        const v = realisedVol(closes, 60, CALENDAR_YEAR_SEC);
        const eq = realisedVol(closes, 60, TRADING_YEAR_SEC);
        per[ex] = v ? { sigmaBps: v.sigmaBps, returns: v.returns, bars: closes.length, from: new Date(v.fromSec * 1000).toISOString(), equityClockBps: eq?.sigmaBps ?? null } : { bars: closes.length, sigmaBps: null };
        sigmas.push(v?.sigmaBps ?? null);
      } catch (error) {
        per[ex] = { error: error instanceof Error ? error.message : String(error) };
        sigmas.push(null);
      }
    }
    (out.rows as unknown[]).push({ symbol, days: d, medianBps: medianSigmaBps(sigmas), per });
  }
}
console.log(JSON.stringify(out, null, 2));
