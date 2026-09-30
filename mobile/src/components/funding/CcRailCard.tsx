import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { depositAmount, withdrawUnits } from "@/features/funding/cc-panel";
import { FUNDING } from "@/features/funding/copy";
import { useCcRail } from "@/features/funding/useCcRail";
import { FONT, useTheme } from "~/theme";
import { walletTokens } from "~/theme/web/portfolio-wallet";

const C = FUNDING.cc;

/**
 * web `CcRailPanel` for the funds drawer (C7b): the Canton Coin path under the demo credits, drawn from the same view model
 * (`cc-panel.ts`) so the phone and the web say the same thing. While the capability is not-live the card says "Not live",
 * says why in one sentence and offers nothing, and no figure appears; once live it states the listing's fixed rate and the
 * exact step, and offers a deposit and a take-back form whose amounts are already exact.
 */
export function CcRailCard() {
  const { color, name } = useTheme();
  const t = walletTokens(name);
  const cc = useCcRail();
  const { panel } = cc;
  const [amount, setAmount] = useState("");
  const [credits, setCredits] = useState("");
  const listing = cc.view?.listing ?? null;
  const dep = listing ? depositAmount(amount, listing.unitsPerCoin) : null;
  const out = listing ? withdrawUnits(credits, panel, listing.unitsPerCoin) : null;
  const input = [styles.input, { borderColor: t.fundLine, color: color.ink }];
  const cta = (label: string, disabled: boolean, onPress: () => void) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled, busy: cc.busy }} style={({ pressed }) => [styles.cta, { borderColor: t.fundLine }, (pressed || disabled) && styles.inert]}>
      <Text style={[styles.ctaText, { color: color.ink }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.card, { borderColor: t.fundLine }]} accessibilityLabel={C.title}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: color.inkMuted }]}>{C.title}</Text>
        <Text style={[styles.badge, { color: color.inkMuted, borderColor: t.fundLine }]}>{panel.badge}</Text>
      </View>
      <Text style={[styles.headline, { color: color.ink }]}>{panel.headline}</Text>
      {panel.lines.map((line) => (
        <Text key={line} style={[styles.line, { color: color.inkMuted }]}>
          {line}
        </Text>
      ))}
      {cc.readError ? <Text style={[styles.line, { color: color.loss }]}>{cc.readError}</Text> : null}
      {panel.canDeposit ? (
        <View style={styles.form}>
          <Text style={[styles.label, { color: color.inkMuted }]}>{C.depositLabel}</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={color.inkDisabled} style={input} autoCorrect={false} />
          {cta(cc.busy ? C.sending : dep ? C.depositCta(dep.amount) : C.depositCta("…"), !dep || cc.busy, () => dep && void cc.deposit(dep.amount))}
          {dep?.changed ? <Text style={[styles.line, { color: color.inkMuted }]}>{C.step(panel.step ?? "")}</Text> : null}
        </View>
      ) : null}
      {panel.canWithdraw ? (
        <View style={styles.form}>
          <Text style={[styles.label, { color: color.inkMuted }]}>{C.withdrawLabel}</Text>
          <TextInput value={credits} onChangeText={setCredits} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={color.inkDisabled} style={input} autoCorrect={false} />
          {cta(cc.busy ? C.sending : out ? C.withdrawCta(credits.trim(), out.coin) : C.withdrawCta("…", "…"), !out || cc.busy, () => out && void cc.withdraw(out.units))}
        </View>
      ) : null}
      {cc.notice ? (
        <Text style={[styles.line, { color: cc.notice.tone === "ok" ? color.profit : color.loss }]} accessibilityLiveRegion="polite">
          {cc.notice.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, marginTop: 20, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderRadius: 12 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  title: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase" },
  badge: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  headline: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21 },
  line: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18.6 },
  form: { gap: 8, marginTop: 8 },
  label: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase" },
  input: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontFamily: FONT.dataRegular, fontSize: 14 },
  cta: { alignSelf: "stretch", borderWidth: 1, borderRadius: 999, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 22 },
  inert: { opacity: 0.5 },
});
