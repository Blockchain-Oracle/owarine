import { isOk } from "@owarine/core/schemas";
import { formatBaseUnits } from "@owarine/core/units";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useBalancePlate } from "@/features/markets/balance/useBalancePlate";
import { FONT, useTheme } from "~/theme";
import { walletTokens } from "~/theme/web/portfolio-wallet";
import { SEAT } from "~/wallet/seat-copy";

const AMOUNT_DP = 2;

/**
 * web `FundingProgress`'s two balance cells (`.fund-progress`), for a seat: its demo credits as the balance plate reads
 * them ("—" while nothing can be read), and their cash value, which is none. No network-fee cell: a seat pays no fees.
 */
export function FundingFacts() {
  const { color, name } = useTheme();
  const t = walletTokens(name);
  const balance = useBalancePlate();
  const sheet = balance.kind === "connected" && balance.reading && isOk(balance.reading) ? balance.reading.value : null;
  const credits = sheet ? formatBaseUnits(sheet.spendableBase + (sheet.vaultBase ?? 0n), sheet.decimals, { maxDp: AMOUNT_DP, minDp: AMOUNT_DP }) : "—";
  const cell = (label: string, value: string) => (
    <View style={[styles.cell, { borderColor: t.fundCell }]}>
      <Text style={[styles.dt, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.dd, { color: color.ink }]}>{value}</Text>
    </View>
  );
  return (
    <View style={styles.progress} accessibilityLiveRegion="polite">
      <View style={styles.balances}>
        {cell(SEAT.funds.credits, credits)}
        {cell(SEAT.funds.cashValue, SEAT.funds.none)}
      </View>
    </View>
  );
}

/** `.fund-foot-line`: mono 11, gray-500. */
export function FootLine({ text }: { text: string | null | undefined }) {
  const { color } = useTheme();
  return text ? <Text style={[fundStyles.foot, { color: color.inkMuted }]}>{text}</Text> : null;
}

/** `.fund-foot-link`: mono 11, gray-500, vermilion while pressed. */
export function FootText({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={6}>
      {({ pressed }) => <Text style={[fundStyles.foot, { color: pressed ? color.accent : color.inkMuted }]}>{label}</Text>}
    </Pressable>
  );
}

export const fundStyles = StyleSheet.create({
  foot: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  msg: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2, marginTop: 12, textAlign: "center" },
});

const styles = StyleSheet.create({
  progress: { gap: 10, marginVertical: 16 },
  balances: { flexDirection: "row", gap: 12 },
  cell: { flex: 1, minWidth: 0, padding: 10, borderWidth: 1, borderRadius: 8 },
  dt: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  dd: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, marginTop: 5 },
});
