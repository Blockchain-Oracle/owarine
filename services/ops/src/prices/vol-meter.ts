/**
 * The crypto lanes' realised volatility (C6, plan "Prices and lanes": BTC/ETH re-measure before fair values go live).
 * Every `everyMin` minutes it pulls the last `windowMin` minutes of 1-minute closes from each oracle exchange, measures
 * the annualised σ of each (core `realisedVol`, 24/7 calendar year) and keeps the median across the exchanges. The
 * pricer reads `sigmaBps(symbol)`: until a crypto symbol has a measurement it is not priced at all, so no crypto fair
 * value ever runs on the old 60 % placeholder. `MM_SIGMA_BPS` still overrides per symbol.
 */
import { CALENDAR_YEAR_SEC, CRYPTO_SYMBOLS, medianSigmaBps, realisedVol, type CryptoSymbol } from "@owarine/core/market";
import { EXCHANGES, type Exchange, type Fetch } from "./candles";
import { fetchCloseHistory } from "./candle-history";
import { runActor } from "../runtime/actor";
import { errorText } from "../runtime/env";

export interface VolReading {
  symbol: CryptoSymbol;
  /** Median across the exchanges that measured, annualised bps. */
  sigmaBps: number;
  perExchange: Partial<Record<Exchange, { sigmaBps: number; returns: number } | { error: string }>>;
  windowMin: number;
  measuredAtSec: number;
}

export interface VolBoard {
  /** The latest measured σ for a crypto symbol, or null before the first measurement (or for any other symbol). */
  sigmaBps(symbol: string): number | null;
  readings(): VolReading[];
}

export interface VolMeterSettings {
  symbols: readonly CryptoSymbol[];
  windowMin: number;
  everyMin: number;
  fetchImpl?: Fetch;
}

export function readVolMeterSettings(env: NodeJS.ProcessEnv = process.env): VolMeterSettings {
  const n = (raw: string | undefined, fallback: number, min: number) => (Number.isInteger(Number(raw)) && Number(raw) >= min ? Number(raw) : fallback);
  return { symbols: CRYPTO_SYMBOLS, windowMin: n(env.VOL_WINDOW_MIN, 1_440, 180), everyMin: n(env.VOL_EVERY_MIN, 30, 1) };
}

/** One measurement of one symbol across the exchanges. */
export async function measureSymbol(symbol: CryptoSymbol, windowMin: number, nowSec: number, fetchImpl?: Fetch): Promise<VolReading | { symbol: CryptoSymbol; error: string }> {
  const toSec = Math.floor(nowSec / 60) * 60;
  const fromSec = toSec - windowMin * 60;
  const perExchange: VolReading["perExchange"] = {};
  const sigmas = await Promise.all(
    EXCHANGES.map(async (ex) => {
      try {
        const v = realisedVol(await fetchCloseHistory(ex, symbol, fromSec, toSec, fetchImpl), 60, CALENDAR_YEAR_SEC);
        perExchange[ex] = v ? { sigmaBps: v.sigmaBps, returns: v.returns } : { error: "too few bars" };
        return v?.sigmaBps ?? null;
      } catch (error) {
        perExchange[ex] = { error: errorText(error) };
        return null;
      }
    }),
  );
  const sigmaBps = medianSigmaBps(sigmas);
  if (sigmaBps === null) return { symbol, error: `no exchange measured ${symbol}: ${JSON.stringify(perExchange)}` };
  return { symbol, sigmaBps, perExchange, windowMin, measuredAtSec: Math.floor(nowSec) };
}

export function startVolMeter(log: (why: string) => void, settings: VolMeterSettings = readVolMeterSettings()): VolBoard & { stop: () => void } {
  const latest = new Map<string, VolReading>();
  const { stop } = runActor({
    name: "vol-meter",
    log,
    dryRun: false,
    everyMs: settings.everyMin * 60_000,
    pass: async () => {
      const nowSec = Date.now() / 1000;
      const out = await Promise.all(settings.symbols.map((s) => measureSymbol(s, settings.windowMin, nowSec, settings.fetchImpl)));
      const words: string[] = [];
      for (const r of out) {
        if ("error" in r) words.push(r.error);
        else {
          latest.set(r.symbol, r);
          const each = Object.entries(r.perExchange).map(([ex, v]) => `${ex} ${"sigmaBps" in v! ? `${(v.sigmaBps / 100).toFixed(1)}%` : v!.error}`).join(", ");
          words.push(`${r.symbol} σ ${(r.sigmaBps / 100).toFixed(1)}% (${each})`);
        }
      }
      const failed = out.every((r) => "error" in r);
      if (failed && latest.size === 0) throw new Error(words.join("; "));
      return { why: `${words.join(" · ")} · 1-minute closes over ${settings.windowMin} min, 365-day year`, detail: { readings: [...latest.values()] } };
    },
  });
  return { sigmaBps: (symbol) => latest.get(symbol)?.sigmaBps ?? null, readings: () => [...latest.values()], stop };
}
