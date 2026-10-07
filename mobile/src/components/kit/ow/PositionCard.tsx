import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { OW_TYPE, useTheme } from "~/theme";
import { Odometer } from "./Odometer";
import { PrivacyMask } from "./PrivacyMask";

/** UGLYCASH's position card (web components/kit/PositionCard): worth now (what Close pays), avg in, invested, PnL. */
export function PositionCard({ title, side, value, invested, avgIn, meta, action }: { title: string; side: "up" | "down"; value: number; invested: number; avgIn: string; meta?: string; action?: ReactNode }) {
  const { color } = useTheme();
  const pnl = value - invested;
  const pct = invested > 0 ? (pnl / invested) * 100 : 0;
  return (
    <View style={[styles.card, { backgroundColor: color.ow.card }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text numberOfLines={1} style={[OW_TYPE.body(16, "700"), { color: color.ow.ink }]}>
            {title}
          </Text>
          {meta ? <Text style={[OW_TYPE.body(13), { color: color.ow.muted }]}>{meta}</Text> : null}
        </View>
        <View style={[styles.side, { backgroundColor: side === "up" ? color.ow.upLine : color.ow.downLine }]}>
          <Text style={[OW_TYPE.display(15), { color: color.ow.white }]}>{side === "up" ? "UP" : "DOWN"}</Text>
        </View>
      </View>
      <Text style={[OW_TYPE.body(13, "500"), styles.label, { color: color.ow.muted }]}>Worth now</Text>
      <PrivacyMask size="lg">
        <Odometer value={value} kind="usd" size={40} weight="800" />
      </PrivacyMask>
      <View style={styles.pnl}>
        <PrivacyMask size="sm">
          <Odometer value={pnl} kind="pnl" decimals={2} size={15} />
        </PrivacyMask>
        <Odometer value={pct} kind="pct" size={13} weight="600" />
      </View>
      <View style={[styles.grid, { borderTopColor: color.ow.hairline }]}>
        <View style={styles.cell}>
          <Text style={[OW_TYPE.body(14), { color: color.ow.muted }]}>Avg in</Text>
          <Text style={[OW_TYPE.num(14, "700"), { color: color.ow.ink }]}>{avgIn}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={[OW_TYPE.body(14), { color: color.ow.muted }]}>Invested</Text>
          <PrivacyMask size="sm">
            <Odometer value={invested} kind="usd" size={14} />
          </PrivacyMask>
        </View>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 20 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  side: { borderRadius: 999, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 },
  label: { marginTop: 16, marginBottom: 2 },
  pnl: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  grid: { flexDirection: "row", marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  cell: { flex: 1, gap: 2 },
  action: { marginTop: 16, flexDirection: "row" },
});
