import { basketOf, TICKERS, type TickerSymbol } from "@owarine/core/market";
import { z } from "zod";
import { webEnv } from "@/lib/env";
import { assetPriceLine, FEED_DECIMALS_DEFAULT, feedRawToOracleRaw } from "../../markets/hero/units";
import { absentWhy } from "../../ticker-hub/index-state";
import { withinBudget } from "./read-budget";

/**
 * A 24/7 name's link preview (C8d, C-MKT-01): a crypto asset, a pre-IPO name, a basket or a valuation lane has no NYSE
 * close, so its card reads the live print ops publishes (`/prices/latest`, the same stream the hub reads) and names it
 * in its own unit: points for a basket (D-124), dollars otherwise. A valuation lane reads ops' entitlement probe first
 * (`/pyth-index/latest`): while the venue may not read the index it is not listed, and the card says so, never a price.
 */

const PRICE_REVALIDATE_SEC = 60;

const spotSchema = z.record(z.string(), z.object({ priceE8: z.string().regex(/^\d+$/), publishTimeSec: z.number(), fresh: z.boolean() }).passthrough());
const entitlementSchema = z.object({
  entitlement: z.record(z.string(), z.object({ state: z.enum(["entitled", "denied", "unknown"]), status: z.number().nullable(), checkedAtSec: z.number().nullable(), reason: z.string().nullable() }).passthrough()),
});

export type TickerLive =
  | { kind: "price"; price: string; atUtc: string; basket: boolean }
  /** A valuation lane the probe says the venue may not read: the reason, finishing "not listed: …". */
  | { kind: "unlisted"; why: string };

const hhmm = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 16);

async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
  const base = webEnv.markets.priceFeedUrl;
  if (!base) return null;
  const response = await fetch(`${base}${path}`, { next: { revalidate: PRICE_REVALIDATE_SEC } });
  if (!response.ok) return null;
  const parsed = schema.safeParse(await response.json());
  return parsed.success ? parsed.data : null;
}

async function readLive(symbol: TickerSymbol): Promise<TickerLive | null> {
  const ticker = TICKERS[symbol];
  if (ticker.kind === "valuation" && ticker.valuationOf) {
    const probe = await readJson("/pyth-index/latest", entitlementSchema);
    const entitlement = probe?.entitlement[ticker.valuationOf];
    if (!entitlement) return null;
    if (entitlement.state !== "entitled") return { kind: "unlisted", why: absentWhy(entitlement) };
  }
  const spot = (await readJson("/prices/latest", spotSchema))?.[symbol];
  if (!spot || !spot.fresh) return null;
  const raw = feedRawToOracleRaw(BigInt(spot.priceE8), FEED_DECIMALS_DEFAULT);
  return { kind: "price", price: assetPriceLine(symbol, raw), atUtc: hhmm(spot.publishTimeSec), basket: basketOf(symbol) !== null };
}

export function readTickerLive(symbol: TickerSymbol): Promise<TickerLive | null> {
  return withinBudget(readLive(symbol));
}
