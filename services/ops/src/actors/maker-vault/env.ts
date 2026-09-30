/**
 * `MAKER_MODE=vault` (the reference's name for the Earn vault's maker): on Canton it turns the maker vault's book on
 * inside the venue, so the issuer draws the quotes the vault's bounds allow from `reserve:maker` shards. The lanes it
 * quotes keep the reference's knobs (`MM_ASSETS`, `MM_INTERVALS`); its bounds are the reference's `MakerParams`, each
 * overridable (`MAKER_MAX_EXPOSURE_BPS`, `MAKER_MIN_SPREAD_RAW`, `MAKER_MIN_PRICE_RAW`, `MAKER_MAX_PRICE_RAW`,
 * `MAKER_MAX_QUANTITY_RAW`, `MAKER_MAX_WINDOW_DEPLOYED_BASE`, `MAKER_MAX_OPEN_WINDOWS`, `MAKER_MIN_TIME_LEFT_SEC`).
 * Off, the vault still reads, publishes its statement and pays providers; it only takes no new quotes.
 */
import type { MakerParams } from "@agari/core/maker";
import { DEFAULT_MAKER_PARAMS } from "@agari/markets/ops/book";

export interface MakerVaultEnv {
  enabled: boolean;
  params: MakerParams;
  /** Upper-case assets; empty = every asset. */
  assets: string[];
  intervals: number[];
  /** How often the reserve reporter publishes the statement when it moved (ms). */
  navEveryMs: number;
}

const DEFAULT_INTERVALS = [300, 900, 3600];
const list = (raw: string | undefined) => (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function num(raw: string | undefined, fallback: number, min = 0): number {
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

function big(raw: string | undefined, fallback: bigint): bigint {
  return raw !== undefined && /^\d{1,19}$/.test(raw) ? BigInt(raw) : fallback;
}

export function readMakerVaultEnv(env: NodeJS.ProcessEnv = process.env): MakerVaultEnv {
  const d = DEFAULT_MAKER_PARAMS;
  const intervals = list(env.MM_INTERVALS).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return {
    enabled: env.MAKER_MODE === "vault",
    params: {
      maxExposureBps: Math.min(10_000, num(env.MAKER_MAX_EXPOSURE_BPS, d.maxExposureBps)),
      minSpreadRaw: big(env.MAKER_MIN_SPREAD_RAW, d.minSpreadRaw),
      minPriceRaw: big(env.MAKER_MIN_PRICE_RAW, d.minPriceRaw),
      maxPriceRaw: big(env.MAKER_MAX_PRICE_RAW, d.maxPriceRaw),
      maxQuantityRaw: big(env.MAKER_MAX_QUANTITY_RAW, d.maxQuantityRaw),
      maxWindowDeployedBase: big(env.MAKER_MAX_WINDOW_DEPLOYED_BASE, d.maxWindowDeployedBase),
      maxOpenWindows: num(env.MAKER_MAX_OPEN_WINDOWS, d.maxOpenWindows, 1),
      minTimeLeftSec: num(env.MAKER_MIN_TIME_LEFT_SEC, d.minTimeLeftSec),
    },
    assets: list(env.MM_ASSETS).map((a) => a.toUpperCase()),
    intervals: intervals.length > 0 ? intervals : DEFAULT_INTERVALS,
    navEveryMs: num(env.MAKER_NAV_MS, 5_000, 1_000),
  };
}
