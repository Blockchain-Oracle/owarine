import { ArrowRight, Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { OW_TYPE, useTheme } from "~/theme";
import { haptic } from "../haptics";

/**
 * UGLYCASH's money gesture (web components/kit/SwipeToConfirm): drag the thumb to the end to confirm; let go early
 * and it springs home. Release is judged by how far and how fast the finger went, not the last painted frame.
 * VoiceOver / TalkBack users get a plain "activate" action — the gesture is a guard, not a gate.
 */
const THUMB = 56;
const PAD = 4;
const SPRING = { damping: 38, stiffness: 520 } as const;

export function SwipeToConfirm({ label, onConfirm, state = "idle", doneLabel = "Confirmed", busyLabel = "Confirming…", tone = "pink", disabled }: { label: string; onConfirm: () => void; state?: "idle" | "busy" | "done"; doneLabel?: string; busyLabel?: string; tone?: "pink" | "black"; disabled?: boolean }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const max = Math.max(0, width - THUMB - PAD * 2);
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const locked = state !== "idle" || disabled === true;

  useEffect(() => {
    const to = state === "idle" ? 0 : max;
    x.value = reduce ? to : withSpring(to, SPRING);
  }, [state, max, reduce, x]);

  const confirm = () => {
    haptic.success();
    onConfirm();
  };

  const pan = Gesture.Pan()
    .enabled(!locked)
    .activeOffsetX(4)
    .onBegin(() => {
      start.value = x.value;
    })
    .onUpdate((e) => {
      x.value = Math.min(max, Math.max(0, start.value + e.translationX));
    })
    .onEnd((e) => {
      const reached = Math.max(x.value, start.value + e.translationX);
      if (reached >= max * 0.86 || (reached >= max * 0.5 && e.velocityX > 900)) {
        x.value = max;
        runOnJS(confirm)();
      } else x.value = withSpring(0, SPRING);
    });

  const fill = tone === "pink" ? color.ow.pink : color.ow.black;
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + THUMB + PAD }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: state === "idle" ? interpolate(x.value, [0, Math.max(1, max * 0.6)], [1, 0], "clamp") : 1 }));
  const text = state === "busy" ? busyLabel : state === "done" ? doneLabel : label;

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: locked, busy: state === "busy" }}
      accessibilityActions={[{ name: "activate", label }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "activate" && !locked) {
          x.value = max;
          confirm();
        }
      }}
      style={[styles.track, { backgroundColor: tone === "pink" ? color.ow.pinkWash : color.ow.recessed, opacity: disabled ? 0.4 : 1 }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: fill }, fillStyle]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.labelBox, labelStyle]} pointerEvents="none">
        <Text style={[OW_TYPE.body(17, "700"), { color: state === "idle" ? color.ow.ink : color.ow.white }]}>{text}</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, { backgroundColor: color.ow.white }, thumbStyle]}>
          {state === "busy" ? <ActivityIndicator color={color.ow.black} /> : state === "done" ? <Check size={24} color={color.ow.black} strokeWidth={3} /> : <ArrowRight size={24} color={color.ow.black} strokeWidth={2.75} />}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 64, borderRadius: 32, overflow: "hidden", justifyContent: "center" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 32 },
  labelBox: { alignItems: "center", justifyContent: "center", paddingLeft: 48 },
  thumb: { position: "absolute", left: PAD, top: PAD, width: THUMB, height: THUMB, borderRadius: THUMB / 2, alignItems: "center", justifyContent: "center" },
});
