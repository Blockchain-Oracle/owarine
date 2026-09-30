import { eventLabelOf } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { formatWallClock } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { EVENT_BOARD, EVENT_SIDE_WORD } from "@/features/markets/events/copy";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { MARKETS } from "@/lib/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import { HeroPanel } from "../hero/HeroChart";
import { Countdown } from "../parts/Countdown";
import { openTicket, useWords, wq, WqButton } from "../words/parts";

const cents = (value: number | null, hydrating: boolean): string => (value === null ? (hydrating ? "…" : MARKETS.noBook) : `${value}¢`);

/**
 * web's events/EventHero on a phone (C6e, K-070): the hero panel holding the event's question, the clock to its lock, how
 * the committee settles it, and Yes/No into the ticket drawer. An event has no chart and no opening print.
 */
export function EventHero({ market, nowMs }: { market: EventMarket; nowMs: number }) {
  const { color } = useWords();
  const { upCents, downCents, hydrating } = useTopOfBook(market);
  const label = eventLabelOf(market.asset);
  const locked = nowMs > 0 && Math.floor(nowMs / 1000) >= market.lockAtSec;
  return (
    <HeroPanel>
      <View style={styles.body}>
        <View style={wq.top}>
          <AssetDisc asset={label} size={28} />
          <Text style={[wq.meta, { color: color.inkMuted }]}>{EVENT_BOARD.meta(label)}</Text>
          <View style={styles.push} />
          {locked ? null : <Countdown expirySec={market.lockAtSec} intervalSec={Math.max(60, market.lockAtSec - market.tradingStartSec)} nowMs={nowMs} style={styles.clock} />}
        </View>
        <Text style={[styles.q, { color: color.ink }]} accessibilityRole="header">
          {market.question}
        </Text>
        <Text style={[styles.meta, { color: color.inkSecondary }]}>{locked ? EVENT_BOARD.locked : EVENT_BOARD.answers(formatWallClock(market.expirySec * 1000))}</Text>
        <Text style={[styles.how, { color: color.inkMuted }]}>{EVENT_BOARD.steps.join(" ")}</Text>
        {locked ? null : (
          <View style={wq.actions}>
            <WqButton side="up" word={EVENT_SIDE_WORD.up} cents={cents(upCents, hydrating)} label={`${EVENT_SIDE_WORD.up} ${cents(upCents, hydrating)}`} onPress={() => openTicket(market.marketId, "up")} />
            <WqButton side="down" word={EVENT_SIDE_WORD.down} cents={cents(downCents, hydrating)} label={`${EVENT_SIDE_WORD.down} ${cents(downCents, hydrating)}`} onPress={() => openTicket(market.marketId, "down")} />
          </View>
        )}
      </View>
    </HeroPanel>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, gap: 12 },
  push: { flex: 1 },
  clock: { fontFamily: FONT.dataStrong, fontSize: 13, lineHeight: 20.8 },
  q: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  meta: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20 },
  how: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
});
