import { ArrowDown, ArrowUp, Waves, X } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from "react-native-reanimated";
import { OW_TYPE, useTheme } from "~/theme";
import { haptic } from "../haptics";
import { Odometer } from "./Odometer";

/**
 * Tradash's two buttons (web components/kit/DirectionPill): UP and DOWN while flat; once in, the same slots become
 * TRAIL and CLOSE, and CLOSE carries the live PnL — what tapping it pays over what you paid.
 */
export type DirectionPillProps =
  | { mode: "flat"; upSub?: string; downSub?: string; onUp: () => void; onDown: () => void; busy?: "up" | "down" | null; disabled?: boolean }
  | { mode: "open"; pnl: number; trailArmed: boolean; onTrail: () => void; onClose: () => void; busy?: "trail" | "close" | null; disabled?: boolean };

export function DirectionPill(props: DirectionPillProps) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const enter = reduce ? undefined : FadeInDown.springify().damping(40).stiffness(520);
  const exit = reduce ? undefined : FadeOutUp.duration(140);
  const inert = props.disabled || props.busy != null;
  const white = color.ow.white;

  const slot = (key: string, bg: string, ink: string, label: string, onPress: () => void, icon: React.ReactNode, sub?: React.ReactNode, flex = 1, pressed?: boolean) => (
    <Pressable
      key={key}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, selected: pressed }}
      style={({ pressed: down }) => [styles.slot, { flex, backgroundColor: bg, opacity: props.disabled ? 0.4 : 1 }, down ? styles.down : null]}
    >
      {icon}
      <View>
        <Text style={[OW_TYPE.body(18, "800"), { color: ink }]}>{label}</Text>
        {sub}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {props.mode === "flat" ? (
        <Animated.View key="flat" entering={enter} exiting={exit} style={styles.row}>
          {slot("up", color.ow.upLine, white, "UP", props.onUp, props.busy === "up" ? <ActivityIndicator color={white} /> : <ArrowUp size={20} color={white} strokeWidth={3} />, props.upSub ? <Text style={[OW_TYPE.body(12, "600"), { color: white }]}>{props.upSub}</Text> : null)}
          {slot("down", color.ow.downLine, white, "DOWN", props.onDown, props.busy === "down" ? <ActivityIndicator color={white} /> : <ArrowDown size={20} color={white} strokeWidth={3} />, props.downSub ? <Text style={[OW_TYPE.body(12, "600"), { color: white }]}>{props.downSub}</Text> : null)}
        </Animated.View>
      ) : (
        <Animated.View key="open" entering={enter} exiting={exit} style={styles.row}>
          {slot(
            "trail",
            props.trailArmed ? color.ow.pink : color.ow.recessed,
            props.trailArmed ? color.ow.onPink : color.ow.ink,
            props.trailArmed ? "TRAILING" : "TRAIL",
            props.onTrail,
            props.busy === "trail" ? <ActivityIndicator color={color.ow.ink} /> : <Waves size={20} color={props.trailArmed ? color.ow.onPink : color.ow.ink} strokeWidth={2.75} />,
            undefined,
            0.8,
            props.trailArmed,
          )}
          {slot(
            "close",
            color.ow.black,
            white,
            "CLOSE",
            props.onClose,
            props.busy === "close" ? <ActivityIndicator color={white} /> : <X size={20} color={white} strokeWidth={3} />,
            <OdometerOnBlack value={props.pnl} />,
          )}
        </Animated.View>
      )}
    </View>
  );
}

function OdometerOnBlack({ value }: { value: number }) {
  const { color } = useTheme();
  return <Odometer value={value} kind="pnl" decimals={2} size={14} tone={false} style={{ color: value > 0 ? color.ow.upOnBlack : value < 0 ? color.ow.downOnBlack : color.ow.white }} />;
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", gap: 8 },
  slot: { height: 64, borderRadius: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  down: { transform: [{ scale: 0.97 }] },
});
