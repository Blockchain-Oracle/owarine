import { Eye, EyeOff } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { togglePrivacy, usePrivacy } from "@/lib/privacy";
import { OW_TYPE, useTheme } from "~/theme";
import { haptic } from "../haptics";
import { FluentArt } from "./SkyCollage";

/**
 * Privacy mode (web components/kit/PrivacyMask, shared store @/lib/privacy): with it on, a money figure becomes the
 * chosen sticker and dots — the real value is not rendered, so a screenshot or a shoulder cannot read it.
 */
const SIZES = { sm: { art: 18, text: 14 }, md: { art: 30, text: 22 }, lg: { art: 56, text: 44 } } as const;

export function PrivacyMask({ children, size = "md" }: { children: ReactNode; size?: keyof typeof SIZES }) {
  const { on, sticker } = usePrivacy();
  const { color } = useTheme();
  if (!on) return <>{children}</>;
  const s = SIZES[size];
  return (
    <View accessible accessibilityLabel="Hidden in privacy mode" style={styles.row}>
      <FluentArt name={sticker} size={s.art} style={styles.tilt} />
      <Text style={[OW_TYPE.num(s.text, "700"), styles.dots, { color: color.ow.ink }]}>••••</Text>
    </View>
  );
}

export function PrivacyToggle() {
  const { on } = usePrivacy();
  const { color } = useTheme();
  const Icon = on ? EyeOff : Eye;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        togglePrivacy();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? "Show balances" : "Hide balances"}
      hitSlop={8}
      style={[styles.toggle, { backgroundColor: color.ow.recessed }]}
    >
      <Icon size={18} color={color.ow.ink} strokeWidth={2.25} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  tilt: { transform: [{ rotate: "-6deg" }] },
  dots: { letterSpacing: 2 },
  toggle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
