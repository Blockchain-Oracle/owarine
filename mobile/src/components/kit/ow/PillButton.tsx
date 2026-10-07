import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { OW_TYPE, useTheme, type Palette } from "~/theme";
import { haptic } from "../haptics";

/**
 * UGLYCASH's buttons (web components/kit/PillButton): always a pill, never a shadow. Black is the default action,
 * Power Pink is THE action on a screen, white sits on the canvas, ghost sits on a card. Pressing sinks it slightly.
 */
export type PillTone = "black" | "pink" | "white" | "ghost" | "up" | "down";
export type PillSize = "sm" | "md" | "lg";

const HEIGHT: Record<PillSize, number> = { sm: 36, md: 48, lg: 56 };
const FONT_SIZE: Record<PillSize, number> = { sm: 14, md: 16, lg: 18 };
const PAD: Record<PillSize, number> = { sm: 16, md: 20, lg: 28 };

function tones(tone: PillTone, ow: Palette["ow"]) {
  switch (tone) {
    case "black":
      return { bg: ow.ink, pressed: ow.muted, ink: ow.inverse };
    case "pink":
      return { bg: ow.pink, pressed: ow.pinkPressed, ink: ow.onPink };
    case "white":
      return { bg: ow.card, pressed: ow.recessed, ink: ow.ink };
    case "ghost":
      return { bg: ow.recessed, pressed: ow.hairline, ink: ow.ink };
    case "up":
      return { bg: ow.upLine, pressed: ow.up, ink: ow.white };
    case "down":
      return { bg: ow.downLine, pressed: ow.down, ink: ow.white };
  }
}

export function PillButton({ label, onPress, tone = "black", size = "md", icon: Icon, loading, disabled, block, style }: { label: string; onPress?: () => void; tone?: PillTone; size?: PillSize; icon?: LucideIcon; loading?: boolean; disabled?: boolean; block?: boolean; style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  const t = tones(tone, color.ow);
  const inert = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inert, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size], paddingHorizontal: PAD[size], backgroundColor: pressed ? t.pressed : t.bg, opacity: disabled ? 0.4 : 1 },
        block ? styles.block : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={t.ink} /> : Icon ? <Icon size={FONT_SIZE[size] + 2} color={t.ink} strokeWidth={2.5} /> : null}
      <Text numberOfLines={1} style={[OW_TYPE.body(FONT_SIZE[size], "700"), { color: t.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999 },
  block: { flex: 1, alignSelf: "stretch" },
  pressed: { transform: [{ scale: 0.97 }] },
});
