import { countdown } from "@owarine/core/lifecycle";
import { Armchair } from "lucide-react-native";
import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useNowMs } from "@/components/data/useNowMs";
import { SEAT } from "@/features/canton-ux/seat/copy";
import { Countdown } from "~/features/markets/parts/Countdown";
import { StatusDot } from "~/features/desk/kit";
import { FONT, useTheme } from "~/theme";

const P = SEAT.pool;
const RING = 56;
/** web's ring is drawn on a 100-unit box with a 46 radius and a 6 stroke; the same proportions at 56pt. */
const RADIUS = 46;
const STROKE = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * web's `PoolFullPlate` (C-ADD-10) for the phone's Take a seat sheet: the kit's empty-state plate with the countdown
 * ring around a seat, the same title and "This page will take the next free seat for you" body, the clock to the
 * next free seat, and a warn `StatusDot` with the reader's place in line. Nothing here is pressed: the app keeps
 * the place and asks again by itself (`useSeatLeaseController`), so there is no button but the sheet's own.
 */
export function PoolFullPlate({ atSec, spanSec, ahead }: { atSec: number | null; spanSec: number; ahead: number }) {
  const { color } = useTheme();
  const now = useNowMs();
  const state = atSec !== null && now > 0 ? countdown(now, atSec, spanSec) : null;
  // The sheet's content changed under the reader: `accessibilityLiveRegion` is Android-only, so say it.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${P.fullTitle}. ${P.fullBody}`);
  }, []);
  const fraction = Math.min(1, Math.max(0, state?.fraction ?? 1));
  const urgent = state?.urgent ?? false;
  return (
    <View style={[styles.plate, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityLabel={P.fullTitle}>
      <View style={styles.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={RING} height={RING} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
          <Circle cx={50} cy={50} r={RADIUS} stroke={color.hairline} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={50}
            cy={50}
            r={RADIUS}
            stroke={urgent ? color.accent : color.inkSecondary}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            transform="rotate(-90 50 50)"
          />
        </Svg>
        <Armchair size={20} color={color.inkSecondary} />
      </View>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {P.fullTitle}
      </Text>
      <Text style={[styles.body, { color: color.inkSecondary }]}>{P.fullBody}</Text>
      <View style={styles.meta}>
        <Text style={[styles.clock, { color: color.inkSecondary }]}>
          {P.nextFrees}{" "}
          {atSec !== null ? <Countdown expirySec={atSec} intervalSec={spanSec} nowMs={now} style={styles.time} /> : "–:––"}
        </Text>
        <StatusDot tone="warn" label={`${P.waiting} · ${P.inLine(ahead)}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { alignItems: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 16, borderWidth: 1, borderStyle: "dashed", borderRadius: 14 },
  ring: { width: RING, height: RING, marginBottom: 4, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24, textAlign: "center" },
  body: { maxWidth: 280, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, textAlign: "center" },
  meta: { alignItems: "center", gap: 10, marginTop: 8 },
  clock: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 18 },
  time: { fontFamily: FONT.dataStrong, fontSize: 13 },
});
