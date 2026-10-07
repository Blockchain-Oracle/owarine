import { SEAT_LINK_CODE_LENGTH } from "@owarine/markets";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { FONT, RADIUS, useTheme } from "~/theme";
import { SEAT } from "~/wallet/seat-copy";
import { spokenCode } from "./code-speech";

export type LinkCodeStatus = "idle" | "error" | "success";

/**
 * web's adapted OTP Input (21st #23543, `components/ui/otp-input.tsx`) on the phone: one box per character (eight, C4c, in two
 * groups of four) drawn over one real field, letters and numbers, upper-cased as typed, so the system keyboard, paste and
 * autofill all work. The box under the caret takes the accent ring; an error or success tints every box, says why underneath
 * and (as on web) puts the caret back after a refusal. To a screen reader it is one text field: labelled, with the code spelled
 * out as its value; the boxes are hidden from it.
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
  onFocusChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  status: LinkCodeStatus;
  label: string;
  hint: string;
  message: string | null;
  editable?: boolean;
  /** The field took or lost the keyboard: a page that scrolls keeps the boxes above it (`/seat/link`). */
  onFocusChange?: (focused: boolean) => void;
}) {
  const { color } = useTheme();
  const field = useRef<TextInput>(null);
  const ring = status === "error" ? color.loss : status === "success" ? color.profit : color.accent;
  // As web's OTP Input does (`focusOnError`): a refused code puts the caret back in the field to type it again.
  useEffect(() => {
    if (status === "error") field.current?.focus();
  }, [status]);
  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        {/* The boxes are a picture of the field's value: not read one by one (each filled box would be its own VoiceOver stop) and not tapped
            (the field above them takes the touch, so a tap, a long-press Paste and autofill all land in it). */}
        <View style={styles.row} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: SEAT_LINK_CODE_LENGTH }, (_, i) => {
            const char = value[i] ?? "";
            const caret = editable && i === Math.min(value.length, SEAT_LINK_CODE_LENGTH - 1) && status === "idle";
            return (
              <View
                key={i}
                // web's `groupEvery`: four and four, so a code read aloud or copied by eye keeps its place.
                style={[styles.box, i === SEAT_LINK_CODE_LENGTH / 2 && styles.groupGap, { borderColor: status !== "idle" ? ring : caret ? color.accent : color.borderStrong, backgroundColor: color.surface2 }]}
              >
                <Text style={[styles.char, { color: color.ink }]}>{char}</Text>
              </View>
            );
          })}
        </View>
        {/* The one real control: full size over the boxes (a 1pt, alpha-0 field is not a dependable VoiceOver stop), its text and caret
            clear because the boxes draw the code. Its label names it, its value is the code spelled out, and typing is echoed by the keyboard. */}
        <TextInput
          ref={field}
          value={value}
          onChangeText={(text) => {
            const next = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SEAT_LINK_CODE_LENGTH);
            onChange(next);
            if (next.length === SEAT_LINK_CODE_LENGTH) onComplete(next);
          }}
          editable={editable}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={SEAT_LINK_CODE_LENGTH + 2}
          caretHidden
          selectionColor="transparent"
          underlineColorAndroid="transparent"
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityValue={{ text: spokenCode(value, SEAT_LINK_CODE_LENGTH, SEAT.link.code) }}
          style={styles.input}
        />
      </View>
      <Text style={[styles.note, { color: status === "error" ? color.loss : status === "success" ? color.profit : color.inkSecondary }]} accessibilityLiveRegion="polite">
        {message ?? hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  field: { minHeight: 52 },
  row: { flexDirection: "row", justifyContent: "center", gap: 6 },
  // Eight boxes share the card's width (C4c), each at most the old 44; the gap between the two groups is one more step.
  box: { flex: 1, maxWidth: 44, height: 52, borderWidth: 1, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  groupGap: { marginLeft: 6 },
  char: { fontFamily: FONT.dataStrong, fontSize: 22, lineHeight: 26 },
  input: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, padding: 0, color: "transparent", fontSize: 22, textAlign: "center" },
  note: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
