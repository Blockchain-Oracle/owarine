import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { OW_TYPE, useTheme } from "~/theme";
import { featureColors, type FeatureTone } from "./Card";

/** A die-cut sticker (web components/kit/Sticker): condensed caps on a bright tone, white cut line, tilted. */
export type StickerTone = Exclude<FeatureTone, "white"> | "white";

const SIZE = { sm: 15, md: 22, lg: 32 } as const;

export function Sticker({ children, tone = "lime", tilt = -4, icon, size = "md" }: { children: string; tone?: StickerTone; tilt?: number; icon?: ReactNode; size?: keyof typeof SIZE }) {
  const { color } = useTheme();
  const c = tone === "white" ? { bg: color.ow.white, ink: color.ow.black } : featureColors(tone, color.ow);
  return (
    <View style={[styles.box, { backgroundColor: c.bg, borderColor: color.ow.white, transform: [{ rotate: `${tilt}deg` }], paddingHorizontal: SIZE[size] * 0.6 }]}>
      {icon}
      <Text style={[OW_TYPE.display(SIZE[size]), { color: c.ink }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 14, borderWidth: 3, paddingTop: 7, paddingBottom: 5 },
});
