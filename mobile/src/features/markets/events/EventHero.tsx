import { eventLabelOf } from "@owarine/core/market";
import type { EventMarket } from "@owarine/core/types";
import { formatClock, formatWallClock } from "@owarine/core/units";
import { StyleSheet, Text, View } from "react-native";
import { eventClockOf } from "@/features/markets/events/clock";
import { EVENT_BOARD, EVENT_SIDE_WORD } from "@/features/markets/events/copy";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { MARKETS } from "@/lib/copy";
import { FONT } from "~/theme";
import { HeroPanel } from "../hero/HeroChart";
import { AssetRow, HeadShell, Settles } from "../hero/HeroHead";
import { mkType, useMk } from "../hero/mk";
import { openTicket, useWords, wq, WqButton } from "../words/parts";
import { impliedUpShare } from "../words/WordCard";
import { CommitteeChip, EventLean } from "./EventParts";

const cents = (value: number | null, hydrating: boolean): string => (value === null ? (hydrating ? "…" : MARKETS.noBook) : `${value}¢`);

/**
 * web's events/EventHero on a phone (C6e, K-070), in the price hero's own frame: the head (asset row with the Committee
 * chip, the question, when the committee answers, and "Trading ends in" over the clock, which flips vermilion as it runs
 * out), the canvas holding the book's lean (the odds bar, when trading ends, the implied share) or the note that trading
 * has ended, "How it settles" with its three steps, and Yes/No into the ticket drawer. An event has no chart and no
 * opening print.
 */
export function EventHero({ market, nowMs }: { market: EventMarket; nowMs: number }) {
  const mk = useMk();
  const { color } = useWords();
  const { upCents, downCents, hydrating } = useTopOfBook(market);
  const label = eventLabelOf(market.asset);
  const { locked, state: clock, urgent } = eventClockOf(market, nowMs);
  const share = impliedUpShare(upCents, downCents);
  return (
    <HeroPanel>
      <HeadShell clock={<Settles label={EVENT_BOARD.endsIn} value={locked ? "00:00" : clock ? formatClock(clock.remainingSec) : "—"} urgent={urgent} />}>
        <AssetRow asset={label} label={EVENT_BOARD.meta(label)}>
          <CommitteeChip />
        </AssetRow>
        <Text style={[mkType.question, { color: mk.ink }]} accessibilityRole="header">
          {market.question}
        </Text>
        <Text style={[mkType.pairMeta, { color: mk.gray400 }]}>{EVENT_BOARD.answers(formatWallClock(market.expirySec * 1000))}</Text>
      </HeadShell>

      <View style={styles.body}>
        {locked ? (
          <Text style={[styles.note, { color: color.inkSecondary }]} accessibilityRole="summary">
            {EVENT_BOARD.locked}
          </Text>
        ) : (
          <View>
            <EventLean share={share} closeText={EVENT_BOARD.locks(formatWallClock(market.lockAtSec * 1000))} flush />
          </View>
        )}
        <View style={[styles.how, { borderTopColor: color.hairline }]}>
          <Text style={[styles.howLabel, { color: color.inkMuted }]}>{EVENT_BOARD.howItSettles}</Text>
          <View style={styles.steps} accessibilityRole="list">
            {EVENT_BOARD.steps.map((step, i) => (
              <View key={step} style={styles.step}>
                <Text style={[styles.marker, { color: color.inkMuted }]}>{i + 1}.</Text>
                <Text style={[styles.stepText, { color: color.inkSecondary }]}>{step}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {locked ? null : (
        <View style={[wq.actions, styles.actions]}>
          <WqButton side="up" word={EVENT_SIDE_WORD.up} cents={cents(upCents, hydrating)} label={`${EVENT_SIDE_WORD.up} ${cents(upCents, hydrating)}`} onPress={() => openTicket(market.marketId, "up")} />
          <WqButton side="down" word={EVENT_SIDE_WORD.down} cents={cents(downCents, hydrating)} label={`${EVENT_SIDE_WORD.down} ${cents(downCents, hydrating)}`} onPress={() => openTicket(market.marketId, "down")} />
        </View>
      )}
    </HeroPanel>
  );
}

// web event-board.css `.ev-hero-body` at phone width (gap 14, padding 8 14 18), `.ev-hero-note`, `.ev-hero-how`, `.ev-hero-steps`.
const styles = StyleSheet.create({
  body: { gap: 14, paddingTop: 8, paddingHorizontal: 14, paddingBottom: 18 },
  note: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22.5 },
  how: { paddingTop: 16, borderTopWidth: 1 },
  howLabel: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase" },
  steps: { gap: 6, marginTop: 10 },
  step: { flexDirection: "row", gap: 8 },
  marker: { minWidth: 18, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18 },
  stepText: { flex: 1, fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  actions: { paddingHorizontal: 14, paddingBottom: 14 },
});
