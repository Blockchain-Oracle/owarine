import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { OW_TYPE, useTheme } from "~/theme";
import { haptic } from "../haptics";

/** UGLYCASH's top navigation (web components/kit/TextTabs): words, the active one ink with a short bar under it. */
export interface TextTab<T extends string> {
  value: T;
  label: string;
}

const SPRING = { damping: 32, stiffness: 420 } as const;

export function TextTabs<T extends string>({ value, onChange, tabs, label, size = "md" }: { value: T; onChange: (v: T) => void; tabs: readonly TextTab<T>[]; label: string; size?: "md" | "lg" }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const frames = useRef(new Map<T, { x: number; w: number }>());
  const [ready, setReady] = useState(false);
  const left = useSharedValue(0);
  const width = useSharedValue(0);

  useEffect(() => {
    const f = frames.current.get(value);
    if (!f) return;
    left.value = reduce ? f.x : withSpring(f.x, SPRING);
    width.value = reduce ? f.w : withSpring(f.w, SPRING);
  }, [value, ready, reduce, left, width]);

  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: left.value }], width: width.value }));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label} contentContainerStyle={styles.list}>
      <View style={styles.row}>
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onLayout={(e) => {
                frames.current.set(t.value, { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width });
                if (frames.current.size === tabs.length) setReady(true);
              }}
              onPress={() => {
                if (!active) haptic.select();
                onChange(t.value);
              }}
            >
              <Text style={[OW_TYPE.body(size === "lg" ? 20 : 16, "700"), { color: active ? color.ow.ink : color.ow.helper }]}>{t.label}</Text>
            </Pressable>
          );
        })}
        <Animated.View style={[styles.bar, { backgroundColor: color.ow.ink }, bar]} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 2 },
  row: { flexDirection: "row", gap: 20, paddingBottom: 8 },
  bar: { position: "absolute", left: 0, bottom: 0, height: 3, borderRadius: 2 },
});
