"use client";

import { isTickerSymbol } from "@owarine/core/market";
import { marketsProvider } from "@owarine/markets";
import { useAssetPrice } from "@owarine/markets/react";
import { useEffect, useState } from "react";
import { basisRaw, feedRawToOracleRaw, ORACLE_SCALE, assetPriceLine } from "@/features/markets/hero/units";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { notify } from "@/lib/toast";
import { ALERTS } from "./copy";
import { sendNotification } from "./notifications";
import { alertBasisOf } from "./basis";
import { centsToRaw, checkAlerts, loadAlerts, pendingAssets, subscribeAlerts, type AlertBasis } from "./store";

/** Spec §1.5: a Regular-basis rule reads only a tick the source published within the last minute. */
const FRESH_TICK_SEC = 60;

/**
 * One asset's watch. Reads the same live price every other surface reads, on the oracle's
 * display scale, and runs the stored rules against it on every tick that moves — only a tick that
 * is fresh and inside today's regular session, so a closed or stale print never fires a rule.
 */
function AssetWatch({ asset, closesAtSec, basis = "regular" }: { asset: string; closesAtSec: number | null; basis?: AlertBasis }) {
  // A stored rule for an asset Owarine doesn't list reads nothing rather than a wrong price.
  const reading = useAssetPrice(isTickerSymbol(asset) ? asset : null);
  const price = reading?.ok && !reading.stale ? reading.value : null;
  const raw = price ? feedRawToOracleRaw(basisRaw(price), price.decimals) : null;
  const publishTimeSec = price?.publishTimeSec ?? null;

  useEffect(() => {
    if (raw === null || publishTimeSec === null) return;
    const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
    // The session poll can trail the bell by a minute; the close itself is known, so a post-market tick never counts.
    // A 24/7 rule has no close (`closesAtSec` null): only the tick's freshness gates it.
    if ((closesAtSec !== null && nowSec >= closesAtSec) || nowSec - publishTimeSec > FRESH_TICK_SEC) return;
    const fired = checkAlerts(asset, basis, raw, ORACLE_SCALE);
    for (const alert of fired) {
      const title = ALERTS.fired.title(asset, alert.direction, assetPriceLine(asset, centsToRaw(alert.targetCents, ORACLE_SCALE)));
      const body = ALERTS.fired.body(assetPriceLine(asset, raw));
      sendNotification(title, body);
      notify.neutral(title, body);
    }
  }, [asset, raw, publishTimeSec, closesAtSec, basis]);

  return null;
}

/** Regular-basis rules wait for the open: no price watch runs outside the NYSE session, or while it is unknown (24/7 rules do not, `AlertsWatcher`). */
function SessionWatch({ assets }: { assets: string[] }) {
  const session = useMarketSession();
  const closesAtSec = session?.open ? session.status.closesAtSec : null;
  if (closesAtSec === null) return null;
  return (
    <>
      {assets.map((asset) => (
        <AssetWatch key={asset} asset={asset} closesAtSec={closesAtSec} />
      ))}
    </>
  );
}

/**
 * The market-stream evaluator — ours, not the reference's.
 *
 * The reference stores rules and exposes `checkAlerts`, but in the pinned source nothing
 * calls it, so an alert could be set and never fire. This mounts once, inside the shared
 * read runtime, and keeps one price watch per asset that still has a pending rule. A rule
 * saved by the button is picked up through the store's subscription, not a reload. With no
 * pending rule it reads nothing at all, not even the session.
 */
export function AlertsWatcher() {
  const [assets, setAssets] = useState<string[]>([]);
  const [allDay, setAllDay] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      const alerts = loadAlerts();
      setAssets(pendingAssets(alerts, "regular"));
      // C9e: 24/7 rules (BTC, ETH, pre-IPO, baskets) watch at any hour; a stock's 24/7 token basis is not offered yet.
      setAllDay(pendingAssets(alerts, "token").filter((asset) => alertBasisOf(asset) === "token"));
    };
    sync();
    return subscribeAlerts(sync);
  }, []);

  return (
    <>
      {assets.length > 0 && <SessionWatch assets={assets} />}
      {allDay.map((asset) => (
        <AssetWatch key={`24/7:${asset}`} asset={asset} closesAtSec={null} basis="token" />
      ))}
    </>
  );
}
