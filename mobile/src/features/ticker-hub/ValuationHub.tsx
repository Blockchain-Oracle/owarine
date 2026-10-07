import { TICKERS, type TickerSymbol } from "@owarine/core/market";
import { useLanes } from "@owarine/markets/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tradingBasketWindow } from "@/features/baskets/basket-window";
import { usdLine } from "@/features/markets/hero/units";
import { assetSourceLabel } from "@/features/markets/price-source/source-label";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import type { IndexState } from "@/features/ticker-hub/index-state";
import { haptic } from "~/components/kit";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { MarketCard } from "~/features/markets/board/MarketCard";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products";
import { SourceCaption, Stat, StatBar, TabLink } from "./HubParts";

/**
 * web's `ValuationHub` + `ValuationHubView` (features/ticker-hub/ValuationHub.tsx, C8d): while ops' probe says the
 * venue may read Pyth's index, Pyth index · Token price · Token vs Pyth · Index age over the source caption, then 01 the
 * lane's live Window; while it may not, the shell's pending block (`.capability-pending`) naming the gate and why, with
 * the way to the token's own hub.
 */
export function ValuationHub({ symbol, state }: { symbol: TickerSymbol; state: IndexState | null }) {
  const { color, name } = useTheme();
  const V = TICKER_HUB.valuation;
  const ticker = TICKERS[symbol];
  const of = ticker.valuationOf;
  const company = of ? TICKERS[of].name : ticker.name;
  const venue = useVenue();
  const lanes = useLanes(state?.kind === "readable" ? venue.venueId : null);
  const nowMs = useChainNowMs();
  const window = state?.kind === "readable" ? tradingBasketWindow(lanes?.ok ? lanes.value : null, symbol, nowMs) : null;
  const toToken = () => {
    if (of) router.push(`/tickers/${of}`);
  };
  if (state === null) return <Text style={[styles.quiet, { color: color.inkDisabled }]}>{TICKER_HUB.dash}</Text>;
  if (state.kind === "absent") {
    return (
      <View style={styles.pending} accessibilityLabel={V.pendingTitle(ticker.name)}>
        <Text style={[styles.cpEyebrow, { color: color.accent }]}>{V.laneEyebrow}</Text>
        <Text style={[styles.cpTitle, { color: color.ink }]} accessibilityRole="header">
          {V.pendingTitle(ticker.name)}
        </Text>
        <Text style={[styles.cpP, { color: color.inkSecondary }]}>{V.pendingBody(state.why)}</Text>
        <Text style={[styles.cpMeta, { color: color.inkMuted, borderTopColor: basketsShortTokens(name).pendingRule }]}>Not connected yet · waiting on {state.gate}</Text>
        {of ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              toToken();
            }}
            accessibilityRole="link"
            hitSlop={8}
            style={styles.cpActionHit}
          >
            <Text style={[styles.cpAction, { color: color.accent }]}>{V.tokenHub(company)} →</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const { row } = state;
  return (
    <>
      <StatBar
        foot={<SourceCaption label={assetSourceLabel(symbol, null)} tail={V.source} />}
        actions={
          <>
            {of ? <TabLink label={`${V.tokenHub(company)} →`} onPress={toToken} /> : null}
            <TabLink label={TICKER_HUB.trade} onPress={() => router.navigate("/markets")} />
          </>
        }
      >
        <Stat label={row.fresh ? V.index : `${V.index} · ${TICKER_HUB.spotStale}`} value={usdLine(row.indexE8)} />
        <Stat label={V.token} value={row.tokenPriceE8 === null ? TICKER_HUB.dash : usdLine(row.tokenPriceE8)} />
        <Stat label={V.tokenVsIndex} value={row.premiumBps === null ? TICKER_HUB.dash : TICKER_HUB.preIpo.premiumLine(row.premiumBps)} />
        <Stat label={V.age} value={V.ageLine(row.ageSec)} />
      </StatBar>
      <SectionHeader index="01" title={V.window.title} style={styles.head} />
      {window ? (
        <View style={styles.window}>
          <MarketCard market={window} nowMs={nowMs} />
        </View>
      ) : (
        <Text style={[styles.quiet, { color: color.inkDisabled }]}>{V.window.none}</Text>
      )}
    </>
  );
}

/** The pre-IPO bar's caption under the source line when the index rows are left out (web's `.tkh-index-absent`). */
export function IndexAbsentCaption({ why }: { why: string }) {
  const { color } = useTheme();
  return <Text style={[styles.caption, { color: color.inkMuted }]}>{TICKER_HUB.preIpo.indexAbsent(why)}</Text>;
}

const styles = StyleSheet.create({
  head: { marginTop: 48 },
  window: { marginTop: 24 },
  quiet: { marginTop: 64, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  caption: { marginTop: -16, fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  pending: { paddingTop: 24, paddingBottom: 8 },
  cpEyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.76, textTransform: "uppercase" },
  cpTitle: { marginTop: 12, fontFamily: FONT.headingHeavy, fontSize: 28, lineHeight: 32.2, letterSpacing: -0.56 },
  cpP: { marginTop: 12, fontFamily: FONT.body, fontSize: 15, lineHeight: 24 },
  cpMeta: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  cpActionHit: { marginTop: 16, alignSelf: "flex-start" },
  cpAction: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.76, textTransform: "uppercase" },
});
