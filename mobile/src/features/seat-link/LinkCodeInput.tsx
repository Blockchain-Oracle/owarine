import { SEAT_LINK_CODE_LENGTH } from "@agari/markets";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { FONT, RADIUS, useTheme } from "~/theme";

export type LinkCodeStatus = "idle" | "error" | "success";

/**
 * web's adapted OTP Input (21st #23543, `components/ui/otp-input.tsx`) on the phone: one box per character (eight, C4c) over one hidden field,
 * letters and numbers, upper-cased as typed, so the system keyboard, paste and autofill all work. The box under the
 * caret takes the accent ring; an error or success tints every box and says why underneath.
 */
export function LinkCodeInput({
  value,
  onChange,
  onComplete,
  status,
  label,
  hint,
  message,
  editable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  status: LinkCodeStatus;
  label: string;
  hint: string;
  message: string | null;
  editable?: boolean;
}) {
  const { color } = useTheme();
  const field = useRef<TextInput>(null);
  const ring = status === "error" ? color.loss : status === "success" ? color.profit : color.accent;
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => field.current?.focus()} accessible={false} style={styles.row}>
        {Array.from({ length: SEAT_LINK_CODE_LENGTH }, (_, i) => {
          const char = value[i] ?? "";
          const caret = editable && i === Math.min(value.length, SEAT_LINK_CODE_LENGTH - 1) && status === "idle";
          return (
            <View
              key={i}
              style={[styles.box, { borderColor: status !== "idle" ? ring : caret ? color.accent : color.borderStrong, backgroundColor: color.surface2 }]}
            >
              <Text style={[styles.char, { color: color.ink }]}>{char}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={field}
        value={value}
        onChangeText={(text) => {
          const next = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SEAT_LINK_CODE_LENGTH);
          onChange(next);
          if (next.length === SEAT_LINK_CODE_LENGTH) onComplete(next);
        }}
        editable={editable}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={SEAT_LINK_CODE_LENGTH + 2}
        accessibilityLabel={label}
        accessibilityHint={hint}
        style={styles.hidden}
      />
      <Text style={[styles.note, { color: status === "error" ? color.loss : status === "success" ? color.profit : color.inkSecondary }]} accessibilityLiveRegion="polite">
        {message ?? hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "center", gap: 6 },
  // Eight boxes share the card's width (C4c), each at most the old 44.
  box: { flex: 1, maxWidth: 44, height: 52, borderWidth: 1, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  char: { fontFamily: FONT.dataStrong, fontSize: 22, lineHeight: 26 },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
  note: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
