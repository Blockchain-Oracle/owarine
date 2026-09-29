import { eventLabelOf } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { formatWallClock } from "@agari/core/units";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EVENT_BOARD, EVENT_SIDE_WORD } from "@/features/markets/events/copy";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { MARKETS, WORD_BOARD } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import { Countdown } from "../parts/Countdown";
import { openTicket, openWindow, useWords, wq, WqButton, WqCard } from "../words/parts";
import { impliedUpShare } from "../words/WordCard";

const cents = (value: number | null, hydrating: boolean): string => (value === null ? (hydrating ? "…" : MARKETS.noBook) : `${value}¢`);

/**
 * web's events/EventCard on a phone (C6e, K-070): one committee event in the word card's kit (`WqCard`, the odds bar,
 * `WqButton`), with the event's own question. Yes/No opens the ticket drawer on it; the question and "Open" select it into
 * the hero. The clock counts to the lock; a locked event says when the committee answers.
 */
export function EventCard({ market, nowMs }: { market: EventMarket; nowMs: number }) {
  const { color, t } = useWords();
  const { upCents, downCents, hydrating } = useTopOfBook(market);
  const nowSec = Math.floor(nowMs / 1000);
  const upcoming = nowMs > 0 && nowSec < market.tradingStartSec;
  const locked = nowMs > 0 && nowSec >= market.lockAtSec;
  const share = impliedUpShare(upCents, downCents);
  const unquoted = !hydrating && upCents === null && downCents === null;
  const label = eventLabelOf(market.asset);

  return (
    <WqCard>
      <View style={wq.top}>
        <AssetDisc asset={label} size={28} />
        <Text style={[wq.meta, { color: color.inkMuted }]}>{EVENT_BOARD.meta(label)}</Text>
        <Text style={[styles.kind, { color: color.accent, borderColor: t.wqKindBorder }]}>{EVENT_BOARD.committee}</Text>
        <View style={styles.push} />
        {locked ? null : (
          <Countdown
            expirySec={upcoming ? market.tradingStartSec : market.lockAtSec}
            intervalSec={Math.max(60, market.lockAtSec - market.tradingStartSec)}
            nowMs={nowMs}
            style={styles.clock}
          />
        )}
      </View>

      <Pressable onPress={() => openWindow(market.marketId)} accessibilityRole="link">
        <Text style={[wq.q, { color: t.wqInk }]}>{market.question}</Text>
      </Pressable>

      {locked || unquoted ? null : (
        <>
          <View style={[styles.bar, { backgroundColor: share === null ? t.wqTrackUnknown : t.wqTrack }]} accessibilityElementsHidden importantForAccessibility="no">
            {share === null ? null : (
              <LinearGradient colors={[t.wqFillFrom, t.wqFillTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${share}%`, shadowColor: t.wqFillGlow }]} />
            )}
          </View>
          <View style={styles.oddsRow}>
            <Text style={[styles.close, { color: color.inkDisabled }]}>
              {upcoming ? EVENT_BOARD.opens(formatWallClock(market.tradingStartSec * 1000)) : EVENT_BOARD.locks(formatWallClock(market.lockAtSec * 1000))}
            </Text>
            <Text style={[styles.lead, { color: color.inkMuted }]}>{share === null ? WORD_BOARD.noLean : WORD_BOARD.implied(share)}</Text>
          </View>
        </>
      )}

      {locked || unquoted ? (
        <View style={[styles.unquoted, { borderColor: color.hairline }]}>
          <View style={[styles.dot, { backgroundColor: color.inkMuted }]} />
          <Text style={[styles.unquotedText, { color: color.inkMuted }]}>{locked ? EVENT_BOARD.answers(formatWallClock(market.expirySec * 1000)) : CLOSED.noQuotes}</Text>
          <Pressable onPress={() => openWindow(market.marketId)} accessibilityRole="link" hitSlop={10}>
            <Text style={[styles.open, { color: color.inkSecondary }]}>{EVENT_BOARD.open}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={wq.actions}>
          <WqButton side="up" word={EVENT_SIDE_WORD.up} cents={cents(upCents, hydrating)} label={`${EVENT_SIDE_WORD.up} ${cents(upCents, hydrating)}: ${market.question}`} onPress={() => openTicket(market.marketId, "up")} />
          <WqButton side="down" word={EVENT_SIDE_WORD.down} cents={cents(downCents, hydrating)} label={`${EVENT_SIDE_WORD.down} ${cents(downCents, hydrating)}: ${market.question}`} onPress={() => openTicket(market.marketId, "down")} />
        </View>
      )}
    </WqCard>
  );
}

const styles = StyleSheet.create({
  kind: { marginLeft: 6, paddingVertical: 2, paddingHorizontal: 8, borderWidth: 1, borderRadius: 9999, fontFamily: FONT.body, fontSize: 10, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  push: { flex: 1 },
  clock: { fontFamily: FONT.dataStrong, fontSize: 13, lineHeight: 20.8 },
  bar: { height: 6, borderRadius: 4, marginBottom: 10, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 4, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  oddsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  close: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
  lead: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  unquoted: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderStyle: "dashed", borderRadius: 10 },
  dot: { width: 7, height: 7, borderRadius: 9999 },
  unquotedText: { flex: 1, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  open: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
});
