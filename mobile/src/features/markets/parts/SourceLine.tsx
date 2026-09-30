import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import type { SourceLabel } from "@/features/markets/price-source/source-label";
import { openExternal } from "~/lib/external";
import { useMk } from "../hero/mk";

/**
 * web's price-source SourceLine (source-line.css): the container's own type (`.pair-meta` in the hero head), the source
 * by its plain name, and — where the feed has a public page — the text as a hairline-underlined link with its ↗, opened
 * outside the app.
 */
export function SourceLine({ label, textStyle }: { label: SourceLabel | null; textStyle: StyleProp<TextStyle> }) {
  const mk = useMk();
  if (!label) return null;
  const line = (
    <Text style={textStyle}>
      {label.href ? (
        <Text style={[styles.link, { textDecorationColor: mk.gray700 }]}>
          {label.text}
          <Text style={styles.arrow}> ↗</Text>
        </Text>
      ) : (
        label.text
      )}
    </Text>
  );
  if (!label.href) return line;
  const href = label.href;
  return (
    <Pressable onPress={() => openExternal(href)} accessibilityRole="link" accessibilityLabel={label.text} hitSlop={8}>
      {line}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { textDecorationLine: "underline" },
  arrow: { textDecorationLine: "none" },
});
