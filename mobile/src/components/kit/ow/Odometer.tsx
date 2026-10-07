import { useEffect } from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { OW_TYPE, useTheme } from "~/theme";
import { formatOdometer, type OdometerKind } from "./odometer-format";

export { formatOdometer, type OdometerKind };

/**
 * Rolling digits for every live number (web components/kit/Odometer, which uses NumberFlow). Each digit is a column
 * of 0–9 clipped to one line and slid with Reanimated, keyed from the right so the units stay put when the number
 * grows. `pnl` and `pct` are signed and flip green/red with their sign. Display only: money stays bigint upstream.
 */
export function Odometer({ value, kind = "usd", decimals, signed, tone, size = 16, weight = "700", style }: { value: number; kind?: OdometerKind; decimals?: number; signed?: boolean; tone?: boolean; size?: number; weight?: "400" | "500" | "600" | "700" | "800"; style?: TextStyle }) {
  const { color } = useTheme();
  const dp = decimals ?? (kind === "pnl" ? 4 : kind === "plain" ? 0 : 2);
  const isSigned = kind === "pnl" || kind === "pct" || signed === true;
  const colour = tone ?? (kind === "pnl" || kind === "pct");
  const text = formatOdometer(value, kind, dp, isSigned);
  const base = OW_TYPE.num(size, weight);
  const ink = colour && value > 0 && text.startsWith("+") ? color.ow.up : colour && text.startsWith("−") ? color.ow.down : (style?.color as string | undefined) ?? color.ow.ink;
  const lineHeight = base.lineHeight ?? size;
  const chars = [...text];
  return (
    <View accessible accessibilityLabel={text} style={styles.row}>
      {chars.map((ch, i) => {
        const key = chars.length - i;
        return /\d/.test(ch) ? (
          <Digit key={key} digit={Number(ch)} lineHeight={lineHeight} style={[base, style, { color: ink }]} />
        ) : (
          <Text key={key} style={[base, style, { color: ink }]}>
            {ch}
          </Text>
        );
      })}
    </View>
  );
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function Digit({ digit, lineHeight, style }: { digit: number; lineHeight: number; style: (TextStyle | undefined)[] }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(-digit * lineHeight);
  useEffect(() => {
    const to = -digit * lineHeight;
    y.value = reduce ? to : withTiming(to, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [digit, lineHeight, reduce, y]);
  const column = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ height: lineHeight, overflow: "hidden" }}>
      {/* An invisible sizer keeps the column one digit wide. */}
      <Text style={[...style, styles.sizer]}>0</Text>
      <Animated.View style={[styles.column, column]}>
        {DIGITS.map((d) => (
          <Text key={d} style={[...style, { height: lineHeight }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  sizer: { opacity: 0 },
  column: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
});
