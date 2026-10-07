import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { OW_TYPE, useTheme, type Palette } from "~/theme";

/** A white card on the ice canvas (web components/kit/Card): radius 16, no shadow. */
export function Card({ children, flat, style }: { children: ReactNode; flat?: boolean; style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  return <View style={[styles.card, { backgroundColor: color.ow.card }, !flat && styles.pad, style]}>{children}</View>;
}

export type FeatureTone = "pink" | "sky" | "lime" | "cream" | "black" | "white";

export function featureColors(tone: FeatureTone, ow: Palette["ow"]): { bg: string; ink: string } {
  switch (tone) {
    case "pink":
      return { bg: ow.pink, ink: ow.onPink };
    case "sky":
      return { bg: ow.sky, ink: ow.black };
    case "lime":
      return { bg: ow.lime, ink: ow.black };
    case "cream":
      return { bg: ow.cream, ink: ow.black };
    case "black":
      return { bg: ow.black, ink: ow.white };
    case "white":
      return { bg: ow.card, ink: ow.ink };
  }
}

/** UGLYCASH's feature card: the big rounded (46) slab that carries one idea. Coloured tones are fixed in both themes. */
export function FeatureCard({ children, tone = "white", style }: { children: ReactNode; tone?: FeatureTone; style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  return <View style={[styles.feature, { backgroundColor: featureColors(tone, color.ow).bg }, style]}>{children}</View>;
}

/** The small muted label above a figure (14, never uppercase). */
export function Eyebrow({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return <Text style={[OW_TYPE.body(14, "500"), { color: color.ow.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 16 },
  pad: { padding: 20 },
  feature: { borderRadius: 46, padding: 28, overflow: "hidden" },
});
