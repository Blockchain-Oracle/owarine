import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { EVENT_BOARD } from "@/features/markets/events/copy";
import { WORD_BOARD } from "@/lib/copy";
import { FONT } from "~/theme";
import { useWords } from "../words/parts";

/** `.wq-kind` for a committee event: the card's and the hero's "Committee" chip. */
export function CommitteeChip() {
  const { color, t } = useWords();
  return <Text style={[styles.kind, { color: color.accent, borderColor: t.wqKindBorder }]}>{EVENT_BOARD.committee}</Text>;
}

/**
 * The book's lean as the word card draws it (`.wq-oddsbar` and `.wq-oddsrow`): UP's share of the two asks as a bar
 * (flat until both asks rest) and, under it, when trading ends and the implied share in words. The event card and the
 * event hero both draw it; the hero's row has no space under it (`.ev-hero-lean .wq-oddsrow`).
 */
export function EventLean({ share, closeText, flush = false }: { share: number | null; closeText: string; flush?: boolean }) {
  const { color, t } = useWords();
  return (
    <>
      <View style={[styles.bar, { backgroundColor: share === null ? t.wqTrackUnknown : t.wqTrack }]} accessibilityElementsHidden importantForAccessibility="no">
        {share === null ? null : (
          <LinearGradient colors={[t.wqFillFrom, t.wqFillTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${share}%`, shadowColor: t.wqFillGlow }]} />
        )}
      </View>
      <View style={[styles.row, flush && styles.flush]}>
        <Text style={[styles.close, { color: color.inkDisabled }]}>{closeText}</Text>
        <Text style={[styles.lead, { color: color.inkMuted }]}>{share === null ? WORD_BOARD.noLean : WORD_BOARD.implied(share)}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  kind: { marginLeft: 6, paddingVertical: 2, paddingHorizontal: 8, borderWidth: 1, borderRadius: 9999, fontFamily: FONT.body, fontSize: 10, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  bar: { height: 6, borderRadius: 4, marginBottom: 10, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 4, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  flush: { marginBottom: 0 },
  close: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
  lead: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
});
