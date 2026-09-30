/**
 * The venue's Windows by the app's market id, for the offer route. A `MarketTerms` is never archived, so the ACS grows
 * with every Window ever opened (the pricer reads it the same way, and only when it meets a Window it has not seen): a
 * miss reloads it at most every few seconds, and a Window that expired long ago is dropped from the cache.
 */
import { marketIdFromDaml } from "@agari/core/market";
import { TEMPLATE_IDS } from "@agari/daml";
import { decodeTerms, pick, readActive, type Active, type RoleSession, type TermsC } from "@agari/markets/ops/canton";

const RELOAD_MS = 5_000;
const KEEP_AFTER_EXPIRY_SEC = 3_600;

export function createTermsBook(venue: RoleSession, o: { nowMs?: () => number; read?: () => Promise<Active<TermsC>[]> } = {}) {
  const nowMs = o.nowMs ?? Date.now;
  const read = o.read ?? (async () => pick(await readActive(venue, [TEMPLATE_IDS.MarketTerms]), TEMPLATE_IDS.MarketTerms, decodeTerms));
  const byMarket = new Map<string, Active<TermsC>>();
  let loadedAt = 0;
  let inFlight: Promise<void> | null = null;

  const reload = () => {
    inFlight ??= read()
      .then((all) => {
        const nowSec = Math.floor(nowMs() / 1000);
        byMarket.clear();
        for (const t of all) if (t.data.expirySec + KEEP_AFTER_EXPIRY_SEC >= nowSec) byMarket.set(marketIdFromDaml(t.data.marketId), t);
        loadedAt = nowMs();
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    /** The Window's terms, or null when the venue holds none (asks the ledger again at most every few seconds). */
    async find(marketId: string): Promise<Active<TermsC> | null> {
      const hit = byMarket.get(marketId);
      if (hit) return hit;
      if (nowMs() - loadedAt >= RELOAD_MS) await reload();
      else if (inFlight) await inFlight;
      return byMarket.get(marketId) ?? null;
    },
  };
}
