import type { Basket } from "@owarine/core/market";
import { useAssetPrice, useLanes } from "@owarine/markets/react";
import { StyleSheet, Text, View } from "react-native";
import { tradingBasketWindow } from "@/features/baskets/basket-window";
import { bpsPct, windowText } from "@/features/baskets/format";
import { basisRaw, feedRawToOracleRaw, pointsLine } from "@/features/markets/hero/units";
import { assetSourceLabel } from "@/features/markets/price-source/source-label";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import { usePreIpoFacts } from "@/features/ticker-hub/usePreIpoFacts";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { MarketCard } from "~/features/markets/board/MarketCard";
import { FONT, useTheme } from "~/theme";
import { BasketMembers } from "./BasketMembers";
import { SourceCaption, Stat, StatBar } from "./HubParts";

const signedPct = (bps: number): string => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${(Math.abs(bps) / 100).toFixed(1)}%`;

/**
 * web's `BasketHub` + `BasketHubView` (features/ticker-hub/BasketHub.tsx): Index · Members · Moved over the source
 * caption, 01 the members table, 02 the live basket Window (its lane card) or the quiet line.
 */
export function BasketHub({ basket }: { basket: Basket }) {
  const { color } = useTheme();
  const B = TICKER_HUB.basket;
  const price = useAssetPrice(basket.symbol);
  const facts = usePreIpoFacts(basket.symbol);
  const venue = useVenue();
  const lanes = useLanes(venue.venueId);
  const nowMs = useChainNowMs();

  const laneSet = lanes?.ok ? lanes.value : null;
  const live = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  const factsRow = facts?.ok ? facts.value : null;
  const indexRaw = live ?? factsRow?.indexE8 ?? null;
  const indexStale = price?.ok === true && price.stale;
  const window = tradingBasketWindow(laneSet, basket.symbol, nowMs);
  const move = factsRow?.move ?? null;

  return (
    <>
      <StatBar foot={<SourceCaption label={assetSourceLabel(basket.symbol, null)} tail={B.source} />}>
        <Stat label={indexStale ? `${B.index} · ${TICKER_HUB.spotStale}` : B.index} value={indexRaw === null ? TICKER_HUB.dash : pointsLine(indexRaw)} />
        <Stat label={B.members} value={B.membersLine(basket.members.length)} />
        <Stat label={B.moved(move ? windowText(move.windowSec) : "")} value={move ? B.movedLine(bpsPct(move.rangeBps), signedPct(move.changeBps)) : B.quiet} long />
      </StatBar>

      <SectionHeader index="01" title={B.table.title} style={styles.head} />
      <BasketMembers basket={basket} members={factsRow?.members ?? null} />

      <SectionHeader index="02" title={B.window.title} style={styles.head} />
      {window ? (
        <View style={styles.window}>
          <MarketCard market={window} nowMs={nowMs} />
        </View>
      ) : (
        <Text style={[styles.quiet, { color: color.inkDisabled }]}>{B.window.none}</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 48 },
  window: { marginTop: 24 },
  quiet: { marginTop: 64, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
});
