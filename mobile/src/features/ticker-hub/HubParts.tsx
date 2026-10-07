import { sessionStateWord } from "@owarine/core/copy";
import { haltLabel } from "@owarine/core/market";
import { marketsProvider } from "@owarine/markets";
import { useTick } from "@owarine/markets/react";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import type { SourceLabel } from "@/features/markets/price-source/source-label";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useSessionPhrase } from "@/lib/when";
import { haptic } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { tickerHubTokens } from "~/theme/web/ticker-hub";

const PHRASE_TICK_MS = 30_000;

/** web profile.css `.prf-stat`: the mono caps label, then the display figure (`.tkh-stat-long` sets it smaller). */
export function Stat({ label, value, long = false }: { label: string; value: string; long?: boolean }) {
  const { color } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.dt, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[long ? styles.bigLong : styles.big, { color: color.ink }]}>{value}</Text>
    </View>
  );
}

/** web profile.css `.prf-bar`: the figures, the caption and the actions, 24 apart over the page's hairline rule. */
export function StatBar({ children, foot, actions }: { children: ReactNode; foot?: ReactNode; actions?: ReactNode }) {
  const { name } = useTheme();
  return (
    <View style={[styles.bar, { borderBottomColor: tickerHubTokens(name).barRule }]}>
      <View style={styles.stats}>{children}</View>
      {foot}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/**
 * The hub's caption (`.type-caption.text-ink-muted`) carrying web's price-source `SourceLine`: the source by its plain
 * name, the feed's page as an underlined link with its ↗ where one is pinned, then the trailing words.
 */
export function SourceCaption({ label, tail }: { label: SourceLabel | null; tail?: string }) {
  const { name, color } = useTheme();
  if (!label && !tail) return null;
  const ink = color.inkMuted;
  const href = label?.href ?? null;
  return (
    <View style={styles.captionRow}>
      <Text style={[styles.caption, { color: ink }]}>
        {label ? (
          href ? (
            <Text
              style={{ textDecorationLine: "underline", textDecorationColor: tickerHubTokens(name).underline }}
              accessibilityRole="link"
              onPress={() => {
                haptic.tap();
                void openExternal(href);
              }}
            >
              {label.text}
              <Text style={styles.arrow}> ↗</Text>
            </Text>
          ) : (
            label.text
          )
        ) : null}
        {label && tail ? " · " : ""}
        {tail}
      </Text>
    </View>
  );
}

/**
 * web's `MarketSessionChip` at phone width (market-session.css under 639 px): the dot carries the state and the phrase's
 * tail follows it; a halt is the reason, said once. Nothing while the session is unknown.
 */
export function SessionChip() {
  const { name, color } = useTheme();
  useTick(PHRASE_TICK_MS);
  const session = useMarketSession();
  const phraseOf = useSessionPhrase();
  if (!session) return null;
  const t = tickerHubTokens(name);
  const state = session.status.state;
  if (session.halt && state === "halted") {
    const label = haltLabel(session.halt.reason);
    return (
      <View style={styles.chip} accessibilityRole="text" accessibilityLabel={label}>
        <View style={[styles.chipDot, { backgroundColor: color.accentFill }]} />
        <Text style={[styles.chipText, { color: color.accent }]}>{label}</Text>
      </View>
    );
  }
  const now = Math.floor(marketsProvider.nowMs() / 1000);
  const word = sessionStateWord(session.status);
  const phrase = phraseOf(session.status, now);
  const tail = phrase.startsWith(`${word} · `) ? phrase.slice(word.length + 3) : session.label;
  const open = state === "regular" || state === "early-close";
  const dot = open ? color.accent : state === "pre" || state === "post" ? t.chipDotLit : state === "holiday" ? t.chipDotHoliday : color.inkDisabled;
  return (
    <View style={styles.chip} accessibilityRole="text" accessibilityLabel={`${word}, ${tail}`}>
      {open ? <PulseDot color={dot} /> : <View style={[styles.chipDot, { backgroundColor: dot }]} />}
      <Text style={[styles.chipText, { color: color.inkMuted }]}>{tail}</Text>
    </View>
  );
}

/** market-session.css `pulseDot`: the open session's dot breathes. */
function PulseDot({ color }: { color: string }) {
  const reduce = useReducedMotion();
  const fade = useSharedValue(1);
  useEffect(() => {
    if (!reduce) fade.value = withRepeat(withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduce, fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value }));
  return <Animated.View style={[styles.chipDot, { backgroundColor: color }, style]} />;
}

/** desk-kit.css `.dkit-status[data-tone=live]`: "● Trading 24/7" in profit ink, the dot pinging. */
export function LiveStatus({ label }: { label: string }) {
  const { name, color } = useTheme();
  const reduce = useReducedMotion();
  const ping = useSharedValue(0);
  useEffect(() => {
    if (!reduce) ping.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.bezier(0, 0, 0.2, 1) }), -1, false);
  }, [reduce, ping]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.75 * (1 - ping.value), transform: [{ scale: 1 + ping.value }] }));
  return (
    <View style={[styles.status, { borderColor: tickerHubTokens(name).liveBorder }]} accessibilityRole="text" accessibilityLabel={label}>
      <View style={[styles.statusDot, { backgroundColor: color.profit }]}>
        {reduce ? null : <Animated.View style={[StyleSheet.absoluteFill, styles.statusPing, { backgroundColor: color.profit }, ring]} />}
      </View>
      <Text style={[styles.statusText, { color: color.profit }]}>{label}</Text>
    </View>
  );
}

/** `.asset-tab` as the hub's "Trade it →" and the quiet board line's link. */
export function TabLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={label.replace(/\s*→$/, "")}
      hitSlop={8}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.tabText, { color: color.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { marginTop: 32, paddingBottom: 24, borderBottomWidth: 1, gap: 24 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  dt: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
  big: { marginTop: 8, fontFamily: FONT.heading, fontSize: 28, lineHeight: 28, letterSpacing: -0.56, fontVariant: ["tabular-nums"] },
  bigLong: { marginTop: 8, fontFamily: FONT.heading, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.36, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 20 },
  captionRow: { flexDirection: "row" },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85, flexShrink: 1 },
  arrow: { fontSize: 11.7 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipDot: { width: 5, height: 5, borderRadius: 2.5 },
  chipText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
  status: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingLeft: 8, paddingRight: 10, borderRadius: 9999, borderWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPing: { borderRadius: 4 },
  statusText: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66, textTransform: "uppercase" },
  tab: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "transparent" },
  tabText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
});
