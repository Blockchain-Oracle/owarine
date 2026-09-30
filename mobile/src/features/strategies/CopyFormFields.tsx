import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import type { CopyFormCheck } from "@/features/strategies/copy-form";
import { COPY_FORM } from "@/features/strategies/copy-form-copy";
import { money } from "@/features/strategies/format";
import { FONT } from "~/theme";
import { DeskPill, PrimaryButton, ST, StratInput, useStrat } from "./ui";

/** A budget / per-trade field (copy-form.css `.copy-field-*`): the label with its symbol, the Max, the red reason. */
function Field({ label, symbol, value, onChange, error, disabled, onMax, maxDisabled }: {
  label: string; symbol: string; value: string; onChange: (v: string) => void; error: string | null; disabled: boolean; onMax: () => void; maxDisabled: boolean;
}) {
  const { t, color } = useStrat();
  const off = disabled || maxDisabled;
  return (
    <View>
      <Text style={[ST.fieldLabel, { color: color.inkMuted }]}>
        {label} · <Text style={styles.keepCase}>{symbol}</Text>
      </Text>
      <View style={styles.fieldRow}>
        <StratInput value={value} onChangeText={onChange} editable={!disabled} keyboardType="decimal-pad" placeholder="0.00" invalid={Boolean(error)} accessibilityLabel={label} style={styles.fieldInput} />
        <Pressable onPress={onMax} disabled={off} accessibilityRole="button" style={[styles.max, { borderColor: t.ink(0.3), backgroundColor: color.surface2, opacity: off ? 0.4 : 1 }]}>
          <Text style={[styles.maxText, { color: color.ink }]}>{COPY_FORM.max}</Text>
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: color.loss }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}


export interface CopyFormFieldsProps {
  check: CopyFormCheck;
  budget: string;
  perTrade: string;
  setBudget: (text: string) => void;
  setPerTrade: (text: string) => void;
  fixed: { budget: string; perTrade: string } | null;
  fieldsDisabled: boolean;
  decimals: number;
  symbol: string;
  walletBase: bigint | null;
  vaultAvailableBase: bigint;
  feeBase: bigint | null;
  confirmLabel: string;
  confirmBusy: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}

/**
 * web's features/strategies/CopyFormFields.tsx: the money strip, the two fields, the way to add credits (the funds sheet),
 * the limits and fee lines passed in, and the confirm that always says why it is off — an invalid press shakes.
 */
export function CopyFormFields(p: CopyFormFieldsProps) {
  const { color } = useStrat();
  const reduce = useReducedMotion();
  const shakeX = useSharedValue(0);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const [adding, setAdding] = useState(false);
  const { check } = p;
  const text = (base: bigint) => money(base, p.decimals).replace(/,/g, "");
  const press = () => {
    if (check.blockedBy === null) return p.onConfirm();
    if (!reduce) shakeX.value = withSequence(...[-7, 7, -5, 5, 0].map((x) => withTiming(x, { duration: 72 })));
  };
  const cell = [styles.cell, { backgroundColor: color.surface1 }];
  const cellLabel = [styles.cellLabel, { color: color.inkMuted }];
  const cellValue = [styles.cellValue, { color: color.ink }];
  return (
    <Animated.View style={[styles.stack, shake]}>
      <View accessibilityLabel={COPY_FORM.strip.pulls} style={[styles.strip, { borderColor: color.hairline, backgroundColor: color.hairline }]}>
        <View style={styles.stripRow}>
          <View style={cell}>
            <Text style={cellLabel}>{COPY_FORM.strip.wallet}</Text>
            <Text style={cellValue}>{p.walletBase === null ? "—" : money(p.walletBase, p.decimals, p.symbol)}</Text>
          </View>
          <View style={cell}>
            <Text style={cellLabel}>{COPY_FORM.strip.vault}</Text>
            <Text style={cellValue}>{money(p.vaultAvailableBase, p.decimals, p.symbol)}</Text>
          </View>
        </View>
        <View style={cell}>
          <Text style={cellLabel}>{COPY_FORM.strip.pulls}</Text>
          <Text style={[cellValue, check.budgetError ? { color: color.loss } : null]}>{money(check.topUpBase + (p.feeBase ?? 0n), p.decimals, p.symbol)}</Text>
          <Text style={[styles.small, { color: color.inkMuted }]}>{COPY_FORM.strip.pullsDetail(p.feeBase ? money(p.feeBase, p.decimals, p.symbol) : null)}</Text>
        </View>
      </View>
      <Field label="Total budget" symbol={p.symbol} value={p.fixed?.budget ?? p.budget} onChange={p.setBudget} error={check.budgetError} disabled={p.fieldsDisabled} maxDisabled={check.maxBudgetBase === null || check.maxBudgetBase <= 0n} onMax={() => check.maxBudgetBase !== null && p.setBudget(text(check.maxBudgetBase))} />
      <Field label="Most per trade" symbol={p.symbol} value={p.fixed?.perTrade ?? p.perTrade} onChange={p.setPerTrade} error={check.perTradeError} disabled={p.fieldsDisabled} maxDisabled={check.maxPerTradeBase <= 0n} onMax={() => p.setPerTrade(text(check.maxPerTradeBase))} />
      <View style={[styles.add, { borderColor: color.hairline }]}>
        <Pressable onPress={() => setAdding((a) => !a)} accessibilityRole="button" accessibilityState={{ expanded: adding }}>
          <Text style={[styles.addToggle, { color: color.accent }]}>
            {adding ? "−" : "+"} {COPY_FORM.addFunds.toggle}
          </Text>
        </Pressable>
        {adding ? (
          <View style={styles.addBody}>
            {/* C8g: the seat's cash IS the Trading Balance on Canton (K-087); more credits come from the funds sheet. */}
            <Text style={[styles.small, { color: color.inkSecondary }]}>{COPY_FORM.addFunds.sameCash}</Text>
            <DeskPill label={COPY_FORM.addFunds.deposit} style={styles.depositPill} onPress={() => router.push("/funds")} />
          </View>
        ) : null}
      </View>
      {p.children}
      <View>
        <PrimaryButton block label={p.confirmLabel} blocked={check.blockedBy !== null} disabled={p.confirmBusy} onPress={press} />
        {check.blockedBy ? (
          <Text accessibilityRole="text" style={[styles.blocked, { color: color.warning }]}>
            {check.blockedBy}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  keepCase: { textTransform: "none" },
  fieldRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  fieldInput: { flex: 1, paddingRight: 60, fontSize: 14, height: 42 },
  max: { position: "absolute", right: 6, height: 28, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, justifyContent: "center" },
  maxText: { fontFamily: FONT.dataStrong, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  error: { marginTop: 6, marginBottom: 4, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  strip: { borderWidth: 1, borderRadius: 12, overflow: "hidden", gap: 1 },
  stripRow: { flexDirection: "row", gap: 1 },
  cell: { flex: 1, gap: 3, paddingVertical: 10, paddingHorizontal: 12, minWidth: 0 },
  cellLabel: { fontFamily: FONT.dataRegular, fontSize: 9.5, lineHeight: 15.2, letterSpacing: 1.33, textTransform: "uppercase" },
  cellValue: { fontFamily: FONT.dataStrong, fontSize: 13, lineHeight: 20.8, fontVariant: ["tabular-nums"] },
  small: { fontFamily: FONT.body, fontSize: 10.5, lineHeight: 16.8 },
  add: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  addToggle: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
  addBody: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 10, marginTop: 10 },
  amount: { flexGrow: 1, flexBasis: 200, gap: 4, minWidth: 0 },
  vaultInput: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, paddingLeft: 12, paddingRight: 56, fontFamily: FONT.dataRegular, fontSize: 14 },
  vaultMax: { position: "absolute", right: 6, height: 30, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, justifyContent: "center" },
  hint: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  depositPill: { height: 44, justifyContent: "center" },
  blocked: { marginTop: 8, fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18.75 },
});
