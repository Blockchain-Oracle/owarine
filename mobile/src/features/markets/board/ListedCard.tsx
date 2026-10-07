import type { TickerSymbol } from "@owarine/core/market";
import type { EventMarket, LaneBasis, MarketId } from "@owarine/core/types";
import { Pressable, View } from "react-native";
import { laneAssetLabel, laneCadenceLabel, pausedCopy } from "@/features/markets/lanes/lane-view";
import { LANE_STATE, MARKETS, PREOPEN } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { haptic } from "~/components/kit";
import { useTheme } from "~/theme";
import { lanesTokens } from "~/theme/web/markets-lanes";
import { card } from "./card-styles";
import { CardHead, Pending, RoomStrip } from "./CardParts";

/**
 * A listed Window before its open on the Regular or Gap lane (D-088) — web's ListedCard: the between-rounds slot
 * (`.market-card-pending`) as a button, "Schedule a call · opens 14:30 (09:30 ET)." and why, and the Room strip's slot
 * carrying the one action it has. A Gap keeps its own words (when calls open, when it locks, which print settles it).
 */
export function ListedCard({ market, selected = false, onSelect, schedulable = true }: { market: EventMarket; selected?: boolean; onSelect: (marketId: MarketId) => void; schedulable?: boolean }) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  const when = useWhen();
  const gap = market.lane === "gap";
  const asset = laneAssetLabel(market.asset, market.lane);
  const opens = when(market.tradingStartSec);
  const open = () => {
    haptic.tap();
    onSelect(market.marketId);
  };
  if (!schedulable) {
    // C6: a 4 h or 1 d 24/7 Window listed a cadence ahead: it names its open, with nothing to schedule.
    return (
      <View style={[card.article, { backgroundColor: t.pendingBg, borderColor: t.pendingBorder }]}>
        <CardHead asset={market.asset} ticker={asset} cadence={laneCadenceLabel(market.lane, market.intervalSec)} clockTone="quiet" clock={PREOPEN.card.clock} />
        <Pending strong={`${LANE_STATE.longListed.headline(opens)}.`} rest={` ${LANE_STATE.longListed.why(when(market.expirySec))}`} />
      </View>
    );
  }
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={PREOPEN.card.aria(asset)}
      accessibilityState={{ selected }}
      style={[card.article, { backgroundColor: t.pendingBg, borderColor: t.pendingBorder }]}
    >
      <CardHead asset={market.asset} ticker={asset} cadence={laneCadenceLabel(market.lane, market.intervalSec)} clockTone="quiet" clock={PREOPEN.card.clock} />
      <Pending
        strong={`${gap ? LANE_STATE.gap.listed(opens) : PREOPEN.card.headline(opens)}.`}
        rest={` ${gap ? LANE_STATE.gap.listedWhy(when(market.lockAtSec), when(market.expirySec, { seconds: true })) : PREOPEN.card.why}`}
      />
      <RoomStrip label={PREOPEN.card.cta} hint={PREOPEN.card.hint} onPress={open} />
    </Pressable>
  );
}

/**
 * A ticker the roller has paused, in the lane where its Window would sit — web's PausedCard (Yosuku's between-rounds
 * slot). Not a button: there is nothing to open.
 */
export function PausedCard({ asset, basis, intervalSec, state }: { asset: TickerSymbol; basis: LaneBasis; intervalSec: number; state: string }) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  const label = laneAssetLabel(asset, basis);
  const { headline, why } = pausedCopy(state, label, basis, intervalSec);
  return (
    <View style={[card.article, { backgroundColor: t.pendingBg, borderColor: t.pendingBorder }]}>
      <CardHead asset={asset} ticker={label} cadence={laneCadenceLabel(basis, intervalSec)} clockTone="quiet" clock={MARKETS.paused.clock} />
      <Pending strong={`${headline}.`} rest={` ${why}`} />
    </View>
  );
}
