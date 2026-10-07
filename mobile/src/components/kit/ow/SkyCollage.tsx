import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { G, Path } from "react-native-svg";
import { FLUENT, type FluentName } from "~/lib/art/fluent";
import { useTheme } from "~/theme";

/** One Fluent Emoji 3D object (MIT, Microsoft; web/public/art/fluent/SOURCES.md). */
export function FluentArt({ name, size = 96, style }: { name: FluentName; size?: number; style?: StyleProp<ImageStyle> }) {
  const art = FLUENT[name];
  return <Image source={art.src} style={[{ width: size, height: (size * art.h) / art.w }, style]} contentFit="contain" accessible={false} />;
}

export interface CollageObject {
  name: FluentName;
  /** Centre, in % of the box. */
  x: number;
  y: number;
  size: number;
  rotate?: number;
  /** Drift gently (off under Reduce Motion); the number staggers the phase. */
  float?: number;
}

/**
 * UGLYCASH's sky (web components/kit/SkyCollage): saturated blue paling to the horizon, soft clouds, objects floating
 * in it. The drift animates the wrapping view, never the SVG (the app's svg-motion rule).
 */
export function SkyCollage({ objects = [], children, style }: { objects?: readonly CollageObject[]; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  return (
    <View style={[styles.sky, style]}>
      <LinearGradient colors={[color.ow.skyTop, color.ow.sky, color.ow.skyMid, color.ow.skyHorizon]} locations={[0, 0.38, 0.78, 1]} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <G fill={color.ow.white}>
          <Path opacity={0.9} d="M-40 690c40-70 140-90 200-50 30-80 160-110 230-40 40-50 150-40 170 40 70-10 120 40 110 100H-60c-10-20 0-40 20-50z" />
          <Path opacity={0.75} d="M760 720c20-60 100-80 150-40 30-70 140-90 200-30 50-30 130 0 130 70 40 10 50 50 30 80H740c-20-30-10-60 20-80z" />
          <Path opacity={0.55} d="M820 150c20-40 80-50 110-20 20-50 100-60 140-10 40-10 80 20 70 60H800c-10-20 0-30 20-30z" />
          <Path opacity={0.45} d="M90 210c15-35 70-45 95-15 20-40 85-45 115-5 35-5 60 20 55 50H75c-5-15 0-25 15-30z" />
        </G>
      </Svg>
      {objects.map((o, i) => (
        <Floating key={`${o.name}-${i}`} object={o} />
      ))}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

function Floating({ object }: { object: CollageObject }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce || object.float === undefined) return;
    y.value = withDelay(object.float * 650, withRepeat(withTiming(-10, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [object.float, reduce, y]);
  const drift = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${object.rotate ?? 0}deg` }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.object, { left: `${object.x}%`, top: `${object.y}%`, marginLeft: -object.size / 2, marginTop: -object.size / 2 }, drift]}
    >
      <FluentArt name={object.name} size={object.size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sky: { overflow: "hidden" },
  object: { position: "absolute" },
  content: { zIndex: 1 },
});
