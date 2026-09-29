import type { WritePhase } from "@agari/core/ports";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { QUOTE_TTL_SEC, TICKET_CANTON } from "@/features/canton-ux/ticket/copy";
import { StepProgress } from "~/features/desk/kit";
import { FONT, useTheme } from "~/theme";
import { tkType, useTk } from "./tk";

const T = TICKET_CANTON;
const URGENT_AT_SEC = 5;
const RING = 36;
const STROKE = 3;
const noop = () => undefined;

/** Where each `WritePhase` sits on the four steps (web's `WriteProgress`); the two failures stop where they failed. */
const STEP_OF: Record<WritePhase, number> = { composing: 1, submitted: 2, confirming: 3, confirmed: 5, reverted: 3, unknown: 3 };

/** web's `QuoteRing`: the firm quote's 20 s on a ring, accent in the last five, whole seconds in its middle. */
function QuoteRing({ remainingSec }: { remainingSec: number }) {
  const { color } = useTheme();
  const left = Math.max(0, Math.ceil(remainingSec));
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const urgent = left > 0 && left <= URGENT_AT_SEC;
  return (
    <View style={styles.ring} accessibilityRole="image" accessibilityLabel={T.ring.held(left)}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={color.hairline} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={urgent ? color.accent : color.inkSecondary}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - left / QUOTE_TTL_SEC)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text style={[styles.ringSec, { color: color.ink }]} importantForAccessibility="no">
        {left}
      </Text>
    </View>
  );
}

/**
 * web's `HeldPriceRow` (K-010a, direction B): the firm price on its own row with the ring beside it; after a requote,
 * the fresh price and the one that ran out, and no ring.
 */
export function HeldPriceRow({ priceCents, remainingSec, expired }: { priceCents: number; remainingSec: number | null; expired?: { fromCents: number; toCents: number } }) {
  const tk = useTk();
  const { color } = useTheme();
  const held = !expired && (remainingSec ?? 0) > 0;
  return (
    <View
      style={[styles.held, { borderColor: expired ? color.warning : tk.hairline, backgroundColor: color.surface2 }]}
      accessibilityLiveRegion={expired ? "polite" : "none"}
    >
      {held ? <QuoteRing remainingSec={remainingSec ?? 0} /> : null}
      <Text style={[styles.price, { color: color.ink }]}>{T.ring.price(expired?.toCents ?? priceCents)}</Text>
      <Text style={[tkType.caption, styles.heldNote, { color: color.inkMuted }]}>{expired ? T.expired.fresh(expired.fromCents, expired.toCents) : T.ring.heldShort}</Text>
    </View>
  );
}

/** web's `WriteProgress` at `variant="block"`: the desk kit's StepProgress in the Buy button's place, and one status line. */
export function WriteProgress({ phase }: { phase: WritePhase }) {
  const tk = useTk();
  const { color } = useTheme();
  const current = STEP_OF[phase];
  const error = phase === "reverted" || phase === "unknown";
  const tone = phase === "unknown" ? color.warning : error ? color.loss : color.inkSecondary;
  return (
    <View style={[styles.write, { borderColor: tk.hairline, backgroundColor: color.surface2 }]} pointerEvents="none">
      <StepProgress steps={T.steps} current={current} onPick={noop} label={T.progressLabel} />
      <Text style={[tkType.body, { color: tone }]} accessibilityLiveRegion="polite">
        {T.status[phase]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ringSec: { fontFamily: FONT.dataStrong, fontSize: 11, fontVariant: ["tabular-nums"] },
  held: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, borderWidth: 1, borderRadius: 10 },
  price: { fontFamily: FONT.dataStrong, fontSize: 18, fontVariant: ["tabular-nums"] },
  heldNote: { flex: 1, textAlign: "right" },
  write: { gap: 10, padding: 14, borderWidth: 1, borderRadius: 12, minHeight: 52 },
});
